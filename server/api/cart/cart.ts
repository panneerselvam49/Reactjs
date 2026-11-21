import cart from '../../models/cart.ts';
import products from '../../models/products.ts';
import type { Request, Response } from 'express';
import db from '../../config/db.ts';
import user from '../../models/user.ts';


export const addToCart = async (req: Request, res: Response): Promise<void> => {
	try {
		const { userId, productId, quantity } = req.body;

		if (!userId || !productId || !quantity) {
			res.status(400).json({ success: false, message: 'Some details are missing' });
			return;
		}

		const users = await user.findOne({
			where: {
				id: userId
			}
		});

		if (!users) {
			res.status(401).json({ success: false, message: "Unauthorized!" });
			return;
		}

		const product = await products.findOne({
			where: {
				isAvailableToBuy: true,
				id: productId,
			}
		});

		if (!product) {
			res.status(400).json({ success: false, message: "Product not found." });
			return;
		}

		if (product.getDataValue("stock") < quantity) {
			res.status(400).json({ success: false, message: "Product not in stock." });
			return;
		}

		const existingCart = await cart.findOne({ where: { userId, productId } });
		if (existingCart) {
			existingCart.quantity += quantity;
			await existingCart.save();
			res.status(200).json({ success: true, message: 'Product added to cart successfully' });
			return;
		}

		const addCart = db.transaction(async (t) => {
			const cartItem = await cart.create({
				userId,
				productId,
				quantity,
			}, { transaction: t })

			return cartItem;
		})

		if (!addCart) {
			throw new Error('Failed to add cart');
		}
		res.status(201).json({ success: true, message: 'Product added to cart successfully' });

	} catch (error) {
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
		let userId = Number(res.locals.userId);
		const {cartId, quantity } = req.body;

		if (!userId || !cartId || !quantity) {
			res.status(400).json({ success: false, message: 'Some details are missing' });
			return;
		}

		let users = await user.findOne({ where: {id: userId}});
		
		if (!users) {
			res.status(401).json({ success: false, message: "Unauthorized!" });
			return;
		}

		let findCart = await cart.findOne({ where: { userId, id: cartId } });
		if (!findCart) {
			res.status(400).json({ success: false, message: "Cart not found." });
			return;
		}

		if (findCart.getDataValue("quantity") < quantity) {
			res.status(400).json({ success: false, message: "Product not in stock." });
			return;
		}

		if (findCart.getDataValue("quantity") === quantity) {
			await findCart.destroy();
			res.status(200).json({ success: true, message: 'Product removed from cart successfully' });
			return;
		}

		findCart.quantity -= quantity;
		await findCart.save();
		res.status(200).json({ success: true, message: 'Product removed from cart successfully' });
	} catch (error) {
		console.log('removeFromCart error:', error);
		res.status(500).json({ success: false, message: 'Internal Server Error' });
	}
}