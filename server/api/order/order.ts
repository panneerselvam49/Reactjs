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

class InsufficientStockError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'InsufficientStockError';
	}
}

class InvalidStatusTransitionError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'InvalidStatusTransitionError';
	}
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
			if (
				!Number.isInteger(Number(item.productId))
				|| !Number.isInteger(Number(item.quantity))
				|| Number(item.productId) < 1
				|| Number(item.quantity) < 1
			) {
				res.status(400).json({
					success: false,
					message: 'Order items are missing',
				});
				return;
			}
		}

		let totalAmount = 0;
		let orderedProducts: Array<{ name: string }> = [];

		const newOrder = await db.transaction(async (transaction) => {
			const aggregatedItems = new Map<number, number>();
			for (const item of items) {
				const productId = Number(item.productId);
				const quantity = Number(item.quantity);
				aggregatedItems.set(productId, (aggregatedItems.get(productId) ?? 0) + quantity);
			}

			const productIds = [...aggregatedItems.keys()];
			const foundProducts = await products.findAll({
				where: { id: productIds },
				transaction,
				lock: transaction.LOCK.UPDATE,
			});

			if (foundProducts.length !== productIds.length) {
				throw new InsufficientStockError('One or more products are out of stock.');
			}

			const productMap = new Map(foundProducts.map((product) => [product.getDataValue('id'), product]));

			for (const [productId, quantity] of aggregatedItems) {
				const product = productMap.get(productId);
				if (!product) {
					throw new InsufficientStockError('One or more products are out of stock.');
				}

				const name = product.getDataValue('name') as string;
				const stock = Number(product.getDataValue('stock'));

				if (!product.getDataValue('isAvailableToBuy')) {
					throw new InsufficientStockError(`Product "${name}" is currently unavailable.`);
				}

				if (stock < quantity) {
					throw new InsufficientStockError(`Insufficient stock for "${name}".`);
				}
			}

			orderedProducts = foundProducts.map((product) => ({
				name: product.getDataValue('name') as string,
			}));

			for (const [productId, quantity] of aggregatedItems) {
				const product = productMap.get(productId)!;
				totalAmount += Number(product.getDataValue('price')) * quantity;
			}

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
				const productId = Number(item.productId);
				const quantity = Number(item.quantity);
				const product = productMap.get(productId)!;
				const unitPrice = Number(product.getDataValue('price'));

				await orderItem.create(
					{
						orderId: createdOrder.getDataValue('id'),
						productId,
						quantity,
						unitPrice,
					},
					{ transaction },
				);
			}

			for (const [productId, quantity] of aggregatedItems) {
				const product = productMap.get(productId)!;
				const newStock = Number(product.getDataValue('stock')) - quantity;
				await product.update({
					stock: newStock,
					isAvailableToBuy: newStock > 0,
				}, { transaction });
			}

			return createdOrder;
		});

		// Publish order to RabbitMQ
		await publishOrderMessage({
			orderId: newOrder.getDataValue('id'),
			productName: orderedProducts.map((product) => product.name),
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
		if (error instanceof InsufficientStockError) {
			res.status(409).json({ success: false, message: error.message });
			return;
		}
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

		await db.transaction(async (transaction) => {
			const existingOrder = await order.findOne({
				where: { id: orderId, userId, status: 'ordered' },
				include: [{ model: orderItem, as: 'items' }],
				transaction,
				lock: transaction.LOCK.UPDATE,
			});

			if (!existingOrder) {
				throw new InvalidStatusTransitionError('Cannot cancel this order');
			}

			await existingOrder.update({ status: 'cancelled', cancelledAt: new Date() }, { transaction });

			const items: any[] = (existingOrder.get('items') as any[]) ?? existingOrder.getDataValue('items') ?? [];

			const quantities = new Map<number, number>();
			for (const item of items) {
				const productId = Number(item.productId);
				if (!productId) continue;
				quantities.set(productId, (quantities.get(productId) ?? 0) + Number(item.quantity));
			}

			const productIds = [...quantities.keys()];
			const productList = await products.findAll({
				where: { id: productIds },
				transaction,
				lock: transaction.LOCK.UPDATE,
			});
			const productMap = new Map(productList.map((p) => [p.getDataValue('id'), p]));

			for (const [productId, quantity] of quantities) {
				const product = productMap.get(productId);
				if (!product) continue;
				await product.update({
					stock: Number(product.getDataValue('stock')) + quantity,
					isAvailableToBuy: true,
				}, { transaction });
			}
		});

		res.status(200).json({ success: true, message: 'Order cancelled successfully.' });
	} catch (error) {
		if (error instanceof InvalidStatusTransitionError) {
			res.status(409).json({ success: false, message: error.message });
			return;
		}
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

		const timestampField = nextStatus === 'shipped' ? 'shippedAt' : 'deliveredAt';
		const updatedCount = await db.transaction(async (transaction) => {
			const existingOrder = await order.findByPk(orderId, {
				transaction,
				lock: transaction.LOCK.UPDATE,
			});
			if (!existingOrder) return -1;

			const currentStatus = existingOrder.getDataValue('status') as string;
			const validTransition =
				(nextStatus === 'shipped' && currentStatus === 'ordered') ||
				(nextStatus === 'delivered' && currentStatus === 'shipped');

			if (!validTransition) {
				throw new InvalidStatusTransitionError(
					`Cannot change an ${currentStatus} order to ${nextStatus}`
				);
			}

			await existingOrder.update({
				status: nextStatus,
				[timestampField]: new Date(),
			}, { transaction });
			return 1;
		});

		if (updatedCount === -1) {
			res.status(404).json({ success: false, message: 'Order not found' });
			return;
		}
		res.status(200).json({
			success: true,
			message: `Order marked as ${nextStatus}`,
		});
	} catch (error) {
		if (error instanceof InvalidStatusTransitionError) {
			res.status(409).json({ success: false, message: error.message });
			return;
		}
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