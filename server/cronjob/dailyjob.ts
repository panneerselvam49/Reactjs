import cron from 'node-cron';
import order from '../models/order.ts';
import { Op } from 'sequelize';
import { publishOrderStatusMessage } from '../mqWorker/orderProducer.ts';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

async function publishStatusUpdates(): Promise<void> {
	const now = new Date();
	const oneDayAgo = new Date(now.getTime() - ONE_DAY_MS);

	const ordersToShip = await order.findAll({
        attributes: ['id'],
		where: {
			status: 'ordered',
			createdAt: {
				[Op.gte]: oneDayAgo,
				[Op.lte]: now,
			},
		},
	});

	const shippedToDeliver = await order.findAll({
        attributes: ['id'],
		where: {
			status: 'shipped',
			shippedAt: {
				[Op.gte]: oneDayAgo,
				[Op.lte]: now,
			},
		},
	});

	await Promise.all([
		...ordersToShip.map((existingOrder) =>
			publishOrderStatusMessage({
				orderId: existingOrder.getDataValue('id'),
				status: 'shipped',
			})
		),
		...shippedToDeliver.map((existingOrder) =>
			publishOrderStatusMessage({
				orderId: existingOrder.getDataValue('id'),
				status: 'delivered',
			})
		),
	]);

	console.log(
		`[Daily job] Published ${ordersToShip.length} shipment and ${shippedToDeliver.length} delivery updates`
	);
}

cron.schedule('0 14 * * *', () => { // this runs on every day 2pm to change the order status
	publishStatusUpdates().catch((error) => {
		console.error('Failed to publish daily order status updates:', error);
	});
});
