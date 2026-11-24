import cart from '../../models/cart.ts';
import products from '../../models/products.ts';
import type { Request, Response } from 'express';
import db from '../../config/db.ts';
import user from '../../models/user.ts';


export const addToCart = async (req: Request, res: Response): Promise<void> => {
	try {
		const userId = Number(res.locals.userId);
		const { productId, quantity } = req.body;

		if (
			!Number.isInteger(Number(userId))
			|| !Number.isInteger(Number(productId))
			|| !Number.isInteger(Number(quantity))
			|| Number(quantity) < 1
		) {
			res.status(400).json({ success: false, message: 'Some details are missing' });
			return;
		}

		const users = await user.findOne({
			where: {
				id: Number(userId)
			}
		});

		if (!users) {
			res.status(401).json({ success: false, message: "Unauthorized!" });
			return;
		}

		await db.transaction(async (transaction) => {
			const product = await products.findOne({
				where: {
					isAvailableToBuy: true,
					id: Number(productId),
				},
				transaction,
				lock: transaction.LOCK.UPDATE,
			});

			if (!product) {
				throw new Error('PRODUCT_NOT_FOUND');
			}

			const existingCart = await cart.findOne({
				where: {
					userId: Number(userId),
					productId: Number(productId),
				},
				transaction,
				lock: transaction.LOCK.UPDATE,
			});

			const requestedQuantity = existingCart
				? Number(existingCart.getDataValue('quantity')) + Number(quantity)
				: Number(quantity);

			if (Number(product.getDataValue('stock')) < requestedQuantity) {
				throw new Error('OUT_OF_STOCK');
			}

			if (existingCart) {
				await existingCart.increment('quantity', {
					by: Number(quantity),
					transaction,
				});
				return;
			}

			await cart.create({
				userId: Number(userId),
				productId: Number(productId),
				quantity: Number(quantity),
			}, { transaction });
		});
		res.status(201).json({ success: true, message: 'Product added to cart successfully' });

	} catch (error) {
		if (error instanceof Error && error.message === 'PRODUCT_NOT_FOUND') {
			res.status(404).json({ success: false, message: 'Product not found.' });
			return;
		}
		if (error instanceof Error && error.message === 'OUT_OF_STOCK') {
			res.status(409).json({ success: false, message: 'Product not in stock.' });
			return;
		}
		console.error('addToCart error:', error);
		res.status(500).json({ success: false, message: 'Internal Server Error' });
	}
}

export const getCartItems = async (req: Request, res: Response): Promise<void> => {
	try {
		const userId = Number(res.locals.userId);

		const cartItems = await cart.findAll({
			where: { userId },
			include: [{ model: products, as: 'product' }],
			order: [['createdAt', 'ASC']],
		});

		res.status(200).json({ success: true, cartItems });
	} catch (error) {
		console.error('getCartItems error:', error);
		res.status(500).json({ success: false, message: 'Internal Server Error' });
	}
}

export const removeFromCart = async (req: Request, res: Response): Promise<void> => {
	try {
		const userId = Number(res.locals.userId);
		const { cartId, quantity } = req.body;

		if (
			!userId
			|| !Number.isInteger(Number(cartId))
			|| !Number.isInteger(Number(quantity))
			|| Number(quantity) < 1
		) {
			res.status(400).json({ success: false, message: 'Some details are missing' });
			return;
		}

		const users = await user.findOne({ where: { id: userId } });
		
		if (!users) {
			res.status(401).json({ success: false, message: "Unauthorized!" });
			return;
		}

		await db.transaction(async (transaction) => {
			const findCart = await cart.findOne({
				where: { userId, id: Number(cartId) },
				transaction,
				lock: transaction.LOCK.UPDATE,
			});
			if (!findCart) {
				throw new Error('CART_NOT_FOUND');
			}

			const currentQuantity = Number(findCart.getDataValue('quantity'));
			const removeQuantity = Number(quantity);
			if (currentQuantity < removeQuantity) {
				throw new Error('INVALID_QUANTITY');
			}

			if (currentQuantity === removeQuantity) {
				await findCart.destroy({ transaction });
				return;
			}

			await findCart.decrement('quantity', {
				by: removeQuantity,
				transaction,
			});
		});
		res.status(200).json({ success: true, message: 'Product removed from cart successfully' });
	} catch (error) {
		if (error instanceof Error && error.message === 'CART_NOT_FOUND') {
			res.status(400).json({ success: false, message: 'Cart not found.' });
			return;
		}
		if (error instanceof Error && error.message === 'INVALID_QUANTITY') {
			res.status(400).json({ success: false, message: 'Product not in stock.' });
			return;
		}
		console.log('removeFromCart error:', error);
		res.status(500).json({ success: false, message: 'Internal Server Error' });
	}
}