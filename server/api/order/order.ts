import type { Request, Response } from 'express';
import db from '../../config/db.ts';
import order from '../../models/order.ts';
import orderItem from '../../models/orderItem.ts';
import products from '../../models/products.ts';
import { publishOrderMessage } from '../../mqWorker/orderProducer.ts';

interface OrderItemInput {
	productId: number;
	quantity: number;
}

export const placeOrder = async (req: Request, res: Response): Promise<void> => {
	try {
		const userId = Number(res.locals.userId);
		const { address, items } = req.body as {
			userId: number;
			address: string;
			items: OrderItemInput[];
		};

		if (!userId || !address || !items || !Array.isArray(items) || items.length === 0) {
			res.status(400).json({
				success: false,
				message: 'Some details are missing',
			});
			return;
		}

		for (const item of items) {
			if (!item.productId || !item.quantity || item.quantity < 1) {
				res.status(400).json({
					success: false,
					message: 'Order items are missing',
				});
				return;
			}
		}

		const productIds = items.map((i) => i.productId);
		const foundProducts = await products.findAll({
			where: { id: productIds },
		});

		if (foundProducts.length !== productIds.length) {
			res.status(404).json({
				success: false,
				message: 'Products are out of stock',
			});
			return;
		}

		const productMap = new Map(foundProducts.map((p) => [p.getDataValue('id'), p]));

		for (const item of items) {
			const product = productMap.get(item.productId);
			if (!product) continue;

			if (!product.getDataValue('isAvailableToBuy')) {
				res.status(409).json({
					success: false,
					message: `Product "${product.getDataValue('name')}" is currently unavailable.`,
				});
				return;
			}

			if (product.getDataValue('stock') < item.quantity) {
				res.status(409).json({
					success: false,
					message: `Insufficient stock for "${product.getDataValue('name')}".`,
				});
				return;
			}
		}

		let totalAmount = 0;
		for (const item of items) {
			const price = Number(productMap.get(item.productId)!.getDataValue('price'));
			totalAmount += price * item.quantity;
		}

		const newOrder = await db.transaction(async (transaction) => {
			const createdOrder = await order.create(
				{
					userId,
					address,
					totalAmount: totalAmount.toFixed(2),
					status: 'ordered',
					orderedAt: new Date(),
				},
				{ transaction },
			);

			for (const item of items) {
				const product = productMap.get(item.productId)!;
				const unitPrice = Number(product.getDataValue('price'));

				await orderItem.create(
					{
						orderId: createdOrder.getDataValue('id'),
						productId: item.productId,
						quantity: item.quantity,
						unitPrice,
					},
					{ transaction },
				);

				// Decrement product stock
				await product.decrement('stock', { by: item.quantity, transaction });

				// Mark as unavailable if stock reaches zero
				const newStock = product.getDataValue('stock') - item.quantity;
				if (newStock === 0) {
					await product.update({ isAvailableToBuy: false }, { transaction });
				}
			}

			return createdOrder;
		});

		// Publish order to RabbitMQ
		await publishOrderMessage({
			orderId: newOrder.getDataValue('id'),
			productName: foundProducts.map((p) => p.getDataValue('name')),
			userId,
			userEmail: res.locals.userEmail,
			userName: res.locals.userName,
			totalAmount: totalAmount.toFixed(2),
			itemCount: items.length,
			placedAt: new Date().toISOString(),
		});

		res.status(201).json({
			success: true,
			message: 'Order placed successfully.',
			orderId: newOrder.getDataValue('id'),
			totalAmount,
		});
	} catch (error) {
		console.error('placeOrder error:', error);
		res.status(500).json({ success: false, message: 'Internal Server Error' });
	}
};

export const getOrders = async (_req: Request, res: Response): Promise<void> => {
	try {
		const userId = Number(res.locals.userId);

		if (!userId || isNaN(userId)) {
			res.status(401).json({ success: false, message: 'Not authorized' });
			return;
		}

		const orders = await order.findAll({
			where: { userId },
			include: [
				{
					model: orderItem,
					as: 'items',
					required: false,
					include: [
						{
							model: products,
							as: 'product',
							attributes: ['id', 'name', 'price', 'images'],
							required: false,
						},
					],
				},
			],
			order: [['createdAt', 'DESC']],
		});

		res.status(200).json({
			success: true,
			orders: orders.map((existingOrder) => existingOrder.toJSON()),
		});
	} catch (error) {
		console.error('getOrders error:', error);
		res.status(500).json({ success: false, message: 'Internal Server Error' });
	}
};

export const cancelOrder = async (req: Request, res: Response): Promise<void> => {
	try {
		const orderId = Number(req.params.orderId);
		const userId = Number(res.locals.userId);

		if (!orderId || isNaN(orderId)) {
			res.status(400).json({ success: false, message: 'Order data is missing' });
			return;
		}

		if (!userId) {
			res.status(400).json({ success: false, message: 'user details are missing.' });
			return;
		}

		const existingOrder = await order.findOne({
			where: { id: orderId, userId },
			include: [{ model: orderItem, as: 'items' }],
		});

		if (!existingOrder) {
			res.status(404).json({ success: false, message: 'Order not found.' });
			return;
		}

		// cancel only order status with 'order
		if (existingOrder.getDataValue('status') !== 'ordered') {
			res.status(409).json({
				success: false,
				message: 'Cannot cancel this order',
			});
			return;
		}

		await db.transaction(async (transaction) => {
			await existingOrder.update({ status: 'cancelled', cancelledAt: new Date() }, { transaction });

			const items: any[] = (existingOrder.get('items') as any[]) ?? existingOrder.getDataValue('items') ?? [];

			const productIds = items.map((item) => item.productId).filter(Boolean);
			const productList = await products.findAll({
				where: { id: productIds },
				transaction,
			});
			const productMap = new Map(productList.map((p) => [p.getDataValue('id'), p]));

			const update = items.flatMap((item) => {
				const product = productMap.get(item.productId);
				if (!product) return [];

				const stockUpdate: Promise<any>[] = [
					product.increment('stock', { by: item.quantity, transaction }),
				];

				if (!product.getDataValue('isAvailableToBuy')) {
					stockUpdate.push(product.update({ isAvailableToBuy: true }, { transaction }));
				}

				return stockUpdate;
			});

			await Promise.all(update);
		});

		res.status(200).json({ success: true, message: 'Order cancelled successfully.' });
	} catch (error) {
		console.error('cancelOrder error:', error);
		res.status(500).json({ success: false, message: 'Internal Server Error' });
	}
};

export const updateOrderStatus = async (req: Request, res: Response): Promise<void> => {
	try {
		const orderId = Number(req.params.orderId);
		const nextStatus = req.body?.status as string;
		const allowedStatuses = ['shipped', 'delivered'] as const;

		if (!orderId || !allowedStatuses.includes(nextStatus as (typeof allowedStatuses)[number])) {
			res.status(400).json({ success: false, message: 'A valid order status is required' });
			return;
		}

		const existingOrder = await order.findByPk(orderId);
		if (!existingOrder) {
			res.status(404).json({ success: false, message: 'Order not found' });
			return;
		}

		const currentStatus = existingOrder.getDataValue('status') as string;
		const validTransition =
			(nextStatus === 'shipped' && currentStatus === 'ordered') ||
			(nextStatus === 'delivered' && currentStatus === 'shipped');

		if (!validTransition) {
			res.status(409).json({
				success: false,
				message: `Cannot change an ${currentStatus} order to ${nextStatus}`,
			});
			return;
		}

		const timestampField = nextStatus === 'shipped' ? 'shippedAt' : 'deliveredAt';
		await existingOrder.update({
			status: nextStatus,
			[timestampField]: new Date(),
		});

		res.status(200).json({
			success: true,
			message: `Order marked as ${nextStatus}`,
		});
	} catch (error) {
		console.error('updateOrderStatus error:', error);
		res.status(500).json({ success: false, message: 'Failed to update order status' });
	}
};

export const getAllOrderDetails = async (_req: Request, res: Response): Promise<void> => {
	try {
		const role = res.locals.role;

		const includeOptions: any[] = [
			{
				model: orderItem,
				as: 'items',
				include: [
					{
						model: products,
						as: 'product',
						...(role === 'seller' ? {
							where: {
								createdBy: res.locals.name,
							},
							required: true,
						} : {}),
					},
				],
			},
		];

		const orders = await order.findAll({
			include: includeOptions,
			order: [['createdAt', 'DESC']],
		});

		res.status(200).json({ success: true, orders });
	} catch (err) {
		console.error(err);

		res.status(500).json({
			success: false,
			message: 'Failed to fetch orders',
		});
	}
};