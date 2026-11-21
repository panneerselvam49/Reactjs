import connectToMQ, { ORDER_QUEUE, ORDER_STATUS_QUEUE } from '../config/rabbitmq.ts';

export interface OrderMessage {
	orderId: number;
	productName: string[];
	userId: number;
	userEmail?: string;
	userName?: string;
	totalAmount: string;
	itemCount: number;
	placedAt: string;
}

export const publishOrderMessage = async (payload: OrderMessage): Promise<void> => {
	const channel = await connectToMQ();

	channel.sendToQueue(
		ORDER_QUEUE,
		Buffer.from(JSON.stringify(payload)),
		{ persistent: true },
	);

	console.log(`[Producer] Order ${payload.orderId} published to "${ORDER_QUEUE}"`);
};

export interface OrderStatusMessage {
	orderId: number;
	status: 'shipped' | 'delivered';
}

export const publishOrderStatusMessage = async (payload: OrderStatusMessage): Promise<void> => {
	const channel = await connectToMQ();

	channel.sendToQueue(
		ORDER_STATUS_QUEUE,
		Buffer.from(JSON.stringify(payload)),
		{ persistent: true },
	);

	console.log(`[Producer] Status update for order ${payload.orderId} published to "${ORDER_STATUS_QUEUE}"`);
};