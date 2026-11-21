import express from 'express';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import cors from 'cors';
import db from './config/db.ts';
import user, { associcateUser } from './models/user.ts';
import cart, { associateCart } from './models/cart.ts';
import products, { associateProducts } from './models/products.ts';
import order, { associateOrder } from './models/order.ts';
import orderItem, { associateOrderItem } from './models/orderItem.ts';
import { associateProductReview } from './models/productReview.ts';
import './models/refreshToken.ts';
import userRouter from './api/user/index.ts';
import productRouter from './api/product/index.ts';
import orderRouter from './api/order/index.ts';
import cartRoute from './api/cart/index.ts';
import redisClient, { connectRedis } from './config/redis.ts';
import connectToMQ from './config/rabbitmq.ts';
import startOrderConsumer from './consumer/orderConsumer.ts';
import './cronjob/dailyjob.ts';
import { RedisStore } from 'rate-limit-redis';
dotenv.config();

const app = express();

async function startServer(): Promise<void> {
	try {
		associcateUser();
		associateCart();
		associateProducts();
		associateOrder();
		associateOrderItem();
		associateProductReview();
		await db.authenticate();
		console.log("PostgreSQL connected successfully");
		await db.sync();
		await connectRedis();
	} catch (error) {
		console.error("Failed to connect to required services:", error);
		throw error;
	}
}

const start = async (): Promise<void> => {
	await startServer();

	const limit = rateLimit({
		windowMs: 15 * 60 * 1000,
		limit: 100,
		message: "Too many requests, Please try again after 15 minutes",
		store: new RedisStore({
			sendCommand: (...args: string[]) => redisClient.sendCommand(args),
		}),
	});

	app.use(limit);
	app.use(cors({
		origin: process.env.FRONTEND_URL,
		credentials: true,
	}));
	app.use(express.json());
	app.use('/api/user', userRouter);
	app.use('/api/product', productRouter);
	app.use('/api/order', orderRouter);
	app.use('/api/cart', cartRoute);

	await connectToMQ();
	await startOrderConsumer();

	const port = Number(process.env.PORT || process.env.port || 4000);
	app.listen(port, () => {
		console.log(`Server running on port ${port}`);
	});
};

start().catch((error) => {
	console.error('Failed to start server:', error);
	process.exit(1);
});