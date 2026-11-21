import amqp, { type Channel } from 'amqplib';

export const ORDER_QUEUE = 'order_queue';
export const ORDER_STATUS_QUEUE = 'order_status_queue';

let channel: Channel | null = null;

const connectToMQ = async (): Promise<Channel> => {
	if (channel) return channel;

	try {
		const connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost');
		channel = await connection.createChannel();

		await channel.assertQueue(ORDER_QUEUE, { durable: true });
		await channel.assertQueue(ORDER_STATUS_QUEUE, { durable: true });

		console.log('RabbitMQ connected — queues asserted:', ORDER_QUEUE, ORDER_STATUS_QUEUE);

		connection.on('close', () => {
			channel = null;
			console.warn('RabbitMQ connection closed');
		});

		return channel;
	} catch (error) {
		console.error('Error connecting to RabbitMQ:', error);
		throw error;
	}
};

export default connectToMQ;