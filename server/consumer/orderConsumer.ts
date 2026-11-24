import dotenv from 'dotenv';
dotenv.config();

import connectToMQ, { ORDER_QUEUE, ORDER_STATUS_QUEUE } from '../config/rabbitmq.ts';
import getMailer from '../config/mailer.ts';
import order from '../models/order.ts';
import db from "../config/db.ts";
import type { OrderMessage, OrderStatusMessage } from '../mqWorker/orderProducer.ts';

const processOrder = async (payload: OrderMessage): Promise<void> => {
	console.log(`📦 [Consumer] Received order #${payload.orderId} from queue "${ORDER_QUEUE}"`);

	const orderDate = new Date(payload.placedAt).toLocaleDateString('en-IN', {
		year: 'numeric',
		month: 'long',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	});

	const recipientEmail = payload.userEmail;

	await getMailer().sendMail({
		from: process.env.EMAIL,
		to: recipientEmail,
		subject: `Order ${payload.productName.join(', ')} — Confirmed`,
		html: `
		<!DOCTYPE html>
		<html lang="en">
		<head><meta charset="UTF-8" /></head>
		<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
			<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;padding:40px 0;">
				<tr>
					<td align="center">
						<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

							<tr>
								<td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:36px 40px;text-align:center;">
									<h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:700;letter-spacing:-0.5px;">
										Order Confirmed
									</h1>
									<p style="margin:8px 0 0;color:#e0e7ff;font-size:14px;">
										Thank you for your purchase!
									</p>
								</td>
							</tr>

							<tr>
								<td style="padding:36px 40px;">
									<p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.6;">
										Hi there, your order has been placed successfully. Here are your order details:
									</p>

									<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
										<tr>
											<td style="padding:20px 24px;border-bottom:1px solid #e5e7eb;">
												<span style="display:block;font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#9ca3af;margin-bottom:4px;">Product Name</span>
												<span style="font-size:18px;font-weight:700;color:#111827;">${payload.productName.join(', ')}</span>
											</td>
											<td style="padding:20px 24px;border-bottom:1px solid #e5e7eb;">
												<span style="display:block;font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#9ca3af;margin-bottom:4px;">Order ID</span>
												<span style="font-size:18px;font-weight:700;color:#111827;">#${payload.orderId}</span>
											</td>
										</tr>
										<tr>
											<td style="padding:20px 24px;border-bottom:1px solid #e5e7eb;">
												<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
													<tr>
														<td width="50%" style="vertical-align:top;">
															<span style="display:block;font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#9ca3af;margin-bottom:4px;">Total Amount</span>
															<span style="font-size:20px;font-weight:700;color:#059669;">₹${payload.totalAmount}</span>
														</td>
														<td width="50%" style="vertical-align:top;">
															<span style="display:block;font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#9ca3af;margin-bottom:4px;">Items</span>
															<span style="font-size:20px;font-weight:700;color:#111827;">${payload.itemCount} item${payload.itemCount > 1 ? 's' : ''}</span>
														</td>
													</tr>
												</table>
											</td>
										</tr>
										<tr>
											<td style="padding:20px 24px;">
												<span style="display:block;font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#9ca3af;margin-bottom:4px;">Placed On</span>
												<span style="font-size:15px;font-weight:600;color:#111827;">${orderDate}</span>
											</td>
										</tr>
									</table>
								</td>
							</tr>

							<tr>
								<td style="padding:24px 40px;background-color:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;">
									<p style="margin:0;color:#9ca3af;font-size:13px;line-height:1.5;">
										If you have any questions, simply reply to this email.
									</p>
								</td>
							</tr>

						</table>
					</td>
				</tr>
			</table>
		</body>
		</html>
		`,
	});

	console.log(`[Consumer] Order confirmation email successfully sent to ${recipientEmail} for Order #${payload.orderId}`);
};

class RetryOrderStatusError extends Error {
	constructor(orderId: number) {
		super(`Order #${orderId} is not ready for delivery yet`);
		this.name = 'RetryOrderStatusError';
	}
}

const processOrderStatus = async (payload: OrderStatusMessage): Promise<void> => {
	const expectedCurrentStatus = payload.status === 'shipped' ? 'ordered' : 'shipped';
	const timestampField = payload.status === 'shipped' ? 'shippedAt' : 'deliveredAt';
	const updatedCount = await db.transaction(async (transaction) => {
		const [count] = await order.update(
			{ status: payload.status, [timestampField]: new Date() },
			{
				where: {
					id: payload.orderId,
					status: expectedCurrentStatus,
				},
				transaction,
			}
		);

		if (count > 0) return count;

		const currentOrder = await order.findOne({
			attributes: ['status'],
			where: { id: payload.orderId },
			transaction,
			lock: transaction.LOCK.UPDATE,
		});

		if (
			payload.status === 'delivered' &&
			currentOrder?.getDataValue('status') === 'ordered'
		) {
			throw new RetryOrderStatusError(payload.orderId);
		}

		return count;
	});

	if (updatedCount === 0) {
		console.log(`[Consumer] Order #${payload.orderId} was already changed or cancelled`);
		return;
	}

	console.log(`[Consumer] Order #${payload.orderId} status changed to ${payload.status}`);
};

export const startOrderConsumer = async (): Promise<void> => {
	const channel = await connectToMQ();

	// Process one message at a time
	await channel.prefetch(1);

	console.log(`[Consumer] Listening for messages on "${ORDER_QUEUE}" and "${ORDER_STATUS_QUEUE}"...`);

	await channel.consume(ORDER_QUEUE, async (message) => {
		if (!message) return;

		try {
			const order: OrderMessage = JSON.parse(message.content.toString());
			await processOrder(order);
			channel.ack(message);
		} catch (error) {
			console.error('[Consumer] Failed to process order message:', error);
			channel.nack(message, false, false);
		}
	});

	await channel.consume(ORDER_STATUS_QUEUE, async (message) => {
		if (!message) return;

		try {
			const statusMessage: OrderStatusMessage = JSON.parse(message.content.toString());
			await processOrderStatus(statusMessage);
			channel.ack(message);
		} catch (error) {
			if (error instanceof RetryOrderStatusError) {
				console.warn(`[Consumer] ${error.message}; retrying status message`);
				await new Promise((resolve) => setTimeout(resolve, 1000));
				channel.nack(message, false, true);
				return;
			}

			console.error('[Consumer] Failed to process order status message:', error);
			channel.nack(message, false, false);
		}
	});
};

export default startOrderConsumer;
