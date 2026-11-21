import type { Request, Response } from 'express';
import products from '../../models/products.ts';
import Cart from '../../models/cart.ts';
import db from '../../config/db.ts';
import { Op } from "sequelize";
import productReviewModel from '../../models/productReview.ts';
import order from '../../models/order.ts';
import orderItem from '../../models/orderItem.ts';
import {
	getProductByIdCacheKey,
	getProductCache,
	getProductListCacheKey,
	getProductSearchCacheKey,
	invalidateProductCache,
	setProductCache,
} from '../../utils/productCache.ts';

export const getProducts = async (req: Request, res: Response): Promise<void> => {
	try {
		const pageParam = Number(req.query.page ?? 1);
		const limitParam = Number(req.query.limit ?? 10);

		if (!Number.isInteger(pageParam) || pageParam < 1 ||
			!Number.isInteger(limitParam) || limitParam < 1) {
			res.status(400).json({
				success: false,
				message: "page and limit must be positive integers"
			});
			return;
		}

		const cart = res.locals.userId
			? await Cart.findAll({ where: { userId: res.locals.userId } })
			: [];
		const totalCartItems = cart.reduce((acc, cur) => {
			return acc + cur.quantity;
		}, 0);

		const page = pageParam;
		const limit = Math.min(limitParam, 100);
		const offset = (page - 1) * limit;
		const cacheKey = await getProductListCacheKey(page, limit);
		let product = await getProductCache<Array<Record<string, unknown>>>(cacheKey);

		if (!product) {
			const result = await products.findAndCountAll({
				limit,
				offset,
				order: [['id', 'ASC']]
			});
			product = result.rows.map((item) => item.toJSON() as Record<string, unknown>);
			await setProductCache(cacheKey, product);
		}

		res.status(200).json({ product, totalCartItems });
	} catch (error) {
		console.log("Error", error);
		res.status(500).json({ success: false, message: "Internal Server Error" });
	}
}

export const getProductById = async (req: Request, res: Response): Promise<void> => {
	try {
		const productId = Number(req.params.id);

		if (!Number.isInteger(productId) || productId < 1) {
			res.status(400).json({ success: false, message: "Invalid request" });
			return;
		}

		const cacheKey = getProductByIdCacheKey(productId);
		const cachedProduct = await getProductCache<Record<string, unknown>>(cacheKey);
		if (cachedProduct) {
			res.status(200).json(cachedProduct);
			return;
		}

		const findProduct = await products.findOne({ where: { id: productId } });
		
		if (!findProduct) {
			res.status(404).json({ success: false, message: "Product not found" });
			return;
		}
		const product = findProduct.toJSON();
		await setProductCache(cacheKey, product);
		res.status(200).json(product);
	} catch (err) {
		console.error("getProductById error:", err);
		res.status(500).json({ success: false, message: "Internal Server Error" });
	}
}

export const createProduct = async (req: Request, res: Response): Promise<void> => {
	try {

		const { name, stock, price, description, images, category } = req.body;

		if (!name || !stock || !price || !category) {
			res.status(400).json({
				success: false,
				message: "Please enter all required fields"
			});
			return;
		}

		if (images !== undefined) {
			if (!Array.isArray(images) || images.some((img: unknown) => typeof img !== 'string')) {
				res.status(400).json({
					success: false,
					message: "images must be an array URL"
				});
				return;
			}
		}

		const existing = await products.findOne({ where: { name } });
		if (existing) {
			res.status(409).json({ success: false, message: "A product with this name already exists" });
			return;
		}

		const createProduct = await db.transaction(async (t) => {
			const createProduct = await products.create({
				name,
				stock,
				price,
				description,
				images,
				createdBy: res.locals.name,
				category: category
			}, { transaction: t });
			return createProduct;
		});
		await invalidateProductCache();

		res.status(201).json({
			success: true,
			message: "Product created successfully",
			data: createProduct,
		});
	} catch (error) {
		console.error("createProduct error:", error);
		res.status(500).json({ success: false, message: "Internal Server Error" });
	}
}

export const searchProducts = async (req: Request, res: Response): Promise<void> => {
	try {
		const searchProduct = typeof req.query.productName === 'string'
			? req.query.productName.trim()
			: '';
		if (!searchProduct) {
			res.status(400).json({
				success: false,
				message: "productName is required"
			});
			return;
		}

		const cart = res.locals.userId
			? await Cart.findAll({ where: { userId: res.locals.userId } })
			: [];
		const totalCartItems = cart.reduce((acc, cur) => acc + cur.quantity, 0);

		const cacheKey = await getProductSearchCacheKey(searchProduct);
		let product = await getProductCache<Array<Record<string, unknown>>>(cacheKey);

		if (!product) {
			const result = await products.findAll({
				where: {
					[Op.or]: [
						{ name: { [Op.iLike]: `%${searchProduct}%` } },
						{ description: { [Op.iLike]: `%${searchProduct}%` } }
					]
				},
				order: [['id', 'ASC']]
			});
			product = result.map((item) => item.toJSON() as Record<string, unknown>);
			await setProductCache(cacheKey, product);
		}

		res.status(200).json({ product, totalCartItems });

	} catch (err) {
		console.error("searchProducts error:", err);
		res.status(500).json({ success: false, message: "Internal Server Error" });
	}
}

export const getAllProducts = async (req: Request, res: Response): Promise<void> => {
	try {
		let userRole = res.locals.role;

		if (userRole === "seller") {
			let productCreatedBySeller = await products.findAll({
				where: {
					createdBy: res.locals.name
				}
			});

			res.status(200).json({ success: true, productCreatedBySeller });
			return;
		}

		if (userRole === "admin") {
			let allProducts = await products.findAll();
			res.status(200).json({ success: true, allProducts });
		}
	} catch (err) {
		res.status(500).json({ success: false, message: err });
		return;
	}
}


export const deleteProduct = async (req: Request, res: Response): Promise<void> => {
	try {
		const userRole = res.locals.role;

		if (!userRole) {
			res.status(401).json({
				success: false,
				message: "Unauthorized"
			});
			return;
		}

		if (userRole !== "seller" && userRole !== "admin") {
			res.status(403).json({
				success: false,
				message: "Access denied"
			});
			return;
		}

		const deletedProduct = await db.transaction(async (transaction) => {
			const product = await products.findOne({
				where: { id: req.params.id },
				transaction,
			});

			if (!product) {
				return 0;
			}

			const where = userRole === "seller"
				? { id: req.params.id, createdBy: res.locals.name }
				: { id: req.params.id };

			return products.destroy({ where, transaction });
		});

		if (deletedProduct === 0) {
			res.status(404).json({
				success: false,
				message: "Product not found"
			});
			return;
		}
		await invalidateProductCache(Number(req.params.id));

		res.status(200).json({
			success: true,
			message: "Product deleted successfully"
		});

	} catch (error) {
		console.error(error);

		res.status(500).json({
			success: false,
			message: "Internal server error"
		});
	}
};

export const upateProduct = async (req: Request, res: Response): Promise<void> => {
	try {
		const { productName, stock, price, category, description, images, productStatus } = req.body;

		if (!productName || stock === undefined || stock === null || price === undefined || price === null || !category ) {
			res.status(400).json({ success: false, message: "Please enter required data to update" });
			return;
		}

		if (!Number.isInteger(Number(stock)) || Number(stock) < 0 || Number(price) <= 0 ||
			(images !== undefined && (!Array.isArray(images) || images.some((img: unknown) => typeof img !== 'string')))) {
			res.status(400).json({ success: false, message: "Invalid product data" });
			return;
		}

		let product = await products.findOne({ 
			where: {
				id: req.params.id
			},
		});

		if (!product) {
			res.status(404).json({ success: false, message: "Product not found" });
			return;
		}

		const { role, name } = res.locals;

		if (role === "seller" && product.createdBy !== name) {
			res.status(403).json({ success: false, message: "You are not authorized to update this product" });
			return;
		}

		if (role !== "seller" && role !== "admin") {
            res.status(403).json({
                success: false,
                message: "You do not have permission to update products"
            });
            return;
        }

		await db.transaction(async (t) => {
			await products.update ({
				name: productName,
				stock,
				price,
				category,
				description,
				images: images ?? product.images,
				isAvailableToBuy: productStatus === undefined ? product.isAvailableToBuy : productStatus
			},
			{
				where: {
					id: req.params.id,
					...(role === "seller" && { createdBy: name})
					
				},
				transaction: t
			}
		)
		});
		await invalidateProductCache(Number(req.params.id));

		res.status(200).json({ success: true, message: "Product updated successfully" });
		return;
	} catch (err) {
		console.error(err);
		res.status(500).json({ success: false, message: "Internal server error" });
	}
}

export const getProductReviews = async (req: Request, res: Response): Promise<void> => {
	try {
		const productId = Number(req.params.id);

		if (!Number.isInteger(productId) || productId < 1) {
			res.status(400).json({ success: false, message: "Invalid product id" });
			return;
		}

		const product = await products.findByPk(productId);
		if (!product) {
			res.status(404).json({ success: false, message: "Product not found" });
			return;
		}

		const reviews = await productReviewModel.findAll({
			where: { productId },
			include: [{
				model: db.models.User,
				as: 'user',
				attributes: ['id', 'name'],
			}],
			order: [['createdAt', 'DESC']],
		});

		const ratings = reviews.map((review) => Number(review.getDataValue('rating')));
		const ratingBreakdown = ratings.reduce<Record<string, number>>((breakdown, rating) => {
			breakdown[String(rating)] = (breakdown[String(rating)] ?? 0) + 1;
			return breakdown;
		}, { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 });

		res.status(200).json({
			success: true,
			reviews,
			summary: {
				averageRating: ratings.length
					? Number((ratings.reduce((total, rating) => total + rating, 0) / ratings.length).toFixed(1))
					: 0,
				ratingCount: ratings.length,
				ratingBreakdown,
			},
		});
	} catch (error) {
		console.error("getProductReviews error:", error);
		res.status(500).json({ success: false, message: "Internal server error" });
	}
};

export const reviewProduct = async (req: Request, res: Response): Promise<void> => {
	try {
		const productId = Number(req.params.id);
		const { rating, comment } = req.body as { rating?: number; comment?: string };
		const userId = Number(res.locals.userId);

		if (!Number.isInteger(productId) || productId < 1 ||
			typeof rating !== 'number' || !Number.isInteger(rating) || rating < 1 || rating > 5) {
			res.status(400).json({ success: false, message: "Rating must be an integer between 1 and 5" });
			return;
		}

		if (!userId) {
			res.status(401).json({ success: false, message: "Not authorized" });
			return;
		}

		const product = await products.findByPk(productId);
		if (!product) {
			res.status(404).json({ success: false, message: "Product not found" });
			return;
		}

		const purchasedProduct = await order.findOne({
			where: { userId, status: 'delivered' },
			include: [{
				model: orderItem,
				as: 'items',
				where: { productId },
				required: true,
			}],
		});

		if (!purchasedProduct) {
			res.status(403).json({
				success: false,
				message: "You can review this product after a delivered purchase",
			});
			return;
		}

		const existingReview = await productReviewModel.findOne({
			where: { productId, userId },
		});

		if (existingReview) {
			res.status(409).json({ success: false, message: "You have already reviewed this product" });
			return;
		}

		await db.transaction(async (t) => {
			await productReviewModel.create({
				productId,
				userId,
				rating,
				comment: comment?.trim() ?? null,
			}, { transaction: t
			})
		})

		res.status(201).json({
			success: true,
			message: "Review submitted successfully",
		});
	} catch (error) {
		console.error("reviewProduct error:", error);
		res.status(500).json({ success: false, message: "Internal server error" });
	}
};