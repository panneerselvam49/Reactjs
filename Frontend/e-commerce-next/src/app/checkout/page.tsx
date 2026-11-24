'use client';

import React, { useState, useEffect, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MapPin, CheckCircle2, Package, ShoppingBag } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { getOrders, placeOrder } from '@/services/api';
import toast from 'react-hot-toast';
import styles from './checkout.module.css';

const NEW_ADDRESS_VALUE = '__new_address__';

export default function CheckoutPage() {
	const { items, directBuyItem, setDirectBuyItem, clearCart } = useCart();
	const checkoutItems = directBuyItem ? [directBuyItem] : items;
	const checkoutTotal = checkoutItems.reduce(
		(total, item) => total + Number(item.product.price) * item.quantity,
		0
	);
	const { user } = useAuth();
	const router = useRouter();
	const [address, setAddress] = useState('');
	const [loading, setLoading] = useState(false);
	const [orderPlaced, setOrderPlaced] = useState(false);
	const [orderId, setOrderId] = useState<number | null>(null);
	const [savedAddresses, setSavedAddresses] = useState<string[]>([]);
	const [selectedAddress, setSelectedAddress] = useState(NEW_ADDRESS_VALUE);
	const [savedAddressesLoading, setSavedAddressesLoading] = useState(true);

	useEffect(() => {
		if (!user) {
			router.replace('/login');
		} else if (checkoutItems.length === 0 && !orderPlaced) {
			router.replace('/cart');
		}
	}, [user, checkoutItems.length, orderPlaced, router]);

	useEffect(() => {
		if (!user) return;

		const loadSavedAddresses = async () => {
			try {
				const response = await getOrders();
				if (!response.success) {
					toast.error('Unable to load saved addresses');
					return;
				}

				const addresses = Array.from(
					new Set(
						response.orders
							.map((existingOrder) => existingOrder.address.trim())
							.filter(Boolean),
					),
				);
				setSavedAddresses(addresses);
				if (addresses.length > 0) {
					setAddress(addresses[0]);
					setSelectedAddress(addresses[0]);
				}
			} catch (error) {
				console.error('Failed to load saved addresses:', error);
				toast.error('Unable to load saved addresses');
			} finally {
				setSavedAddressesLoading(false);
			}
		};

		void loadSavedAddresses();
	}, [user]);

	if (!user || (checkoutItems.length === 0 && !orderPlaced)) {
		return null;
	}

	const handlePlaceOrder = async (e: FormEvent) => {
		e.preventDefault();

		if (!address.trim()) {
			toast.error('Please enter your delivery address');
			return;
		}

		setLoading(true);
		try {
			const res = await placeOrder({
				userId: user.id,
				address: address.trim(),
				items: checkoutItems.map((item) => ({
					productId: item.product.id,
					quantity: item.quantity,
				})),
			});

			if (!res.success) {
				toast.error(res.message || 'Unable to place order');
				return;
			}

			setOrderPlaced(true);
			if (directBuyItem) {
				setDirectBuyItem(null);
			} else {
				clearCart();
			}
			if ('orderId' in res && typeof res.orderId === 'number') {
				setOrderId(res.orderId);
			}
			toast.success('Order placed successfully!');
		} catch (err: unknown) {
			const message =
				err && typeof err === 'object' && 'response' in err
					? (err as { response: { data: { message: string } } }).response?.data?.message
					: 'Something went wrong. Please try again.';
			toast.error(message);
		} finally {
			if (!orderPlaced) setLoading(false);
		}
	};

	// Success State
	if (orderPlaced) {
		return (
			<div className="page-wrapper">
				<div className="container">
					<div className={styles['checkout-success']}>
						<div className={styles['success-icon']}>
							<CheckCircle2 size={40} />
						</div>
						<h2>Order Placed Successfully!</h2>
						<p>
							{orderId
								? `Your order #${orderId} has been confirmed. You'll receive updates via email.`
								: "Your order has been confirmed. You'll receive updates via email."}
						</p>
						<div className={styles['success-actions']}>
							<Link href="/orders" className="btn btn-primary btn-lg">
								<Package size={18} />
								View My Orders
							</Link>
							<Link href="/" className="btn btn-secondary btn-lg">
								<ShoppingBag size={18} />
								Continue Shopping
							</Link>
						</div>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="page-wrapper">
			<div className="container">
				<h1 style={{
					fontSize: 'var(--font-size-2xl)',
					fontWeight: 'var(--font-weight-bold)',
					marginBottom: 'var(--spacing-xl)',
				}}>
					Checkout
				</h1>

				<div className={styles['checkout-layout']}>
					<div className={styles['checkout-form-card']}>
						<h2>Shipping Address</h2>
						<form className={styles['checkout-form']} onSubmit={handlePlaceOrder}>
							<div className="input-group">
								<label htmlFor="address" className="input-label">
									<MapPin size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
									Delivery Address
								</label>
								{savedAddressesLoading ? (
									<p className={styles['address-status']}>Loading saved addresses...</p>
								) : savedAddresses.length > 0 ? (
									<>
										<select
											className="input-field"
											value={selectedAddress}
											onChange={(event) => {
												const value = event.target.value;
												setSelectedAddress(value);
												setAddress(value === NEW_ADDRESS_VALUE ? '' : value);
											}}
											aria-label="Choose a delivery address"
										>
											{savedAddresses.map((savedAddress, index) => (
												<option key={`${savedAddress}-${index}`} value={savedAddress}>
													Address {index + 1}: {savedAddress}
												</option>
											))}
											<option value={NEW_ADDRESS_VALUE}>Use a new address</option>
										</select>
										{selectedAddress === NEW_ADDRESS_VALUE ? (
											<textarea
												id="address"
												className={`input-field ${styles['checkout-textarea']}`}
												placeholder="Enter your full delivery address including city, state and pincode..."
												value={address}
												onChange={(event) => setAddress(event.target.value)}
												required
											/>
										) : (
											<div className={styles['selected-address']} aria-label="Selected delivery address">
												{address}
											</div>
										)}
									</>
								) : (
									<textarea
										id="address"
										className={`input-field ${styles['checkout-textarea']}`}
										placeholder="Enter your full delivery address including city, state and pincode..."
										value={address}
										onChange={(event) => setAddress(event.target.value)}
										required
									/>
								)}
							</div>

							<button
								type="submit"
								className={`btn btn-primary btn-full ${styles['place-order-btn']}`}
								disabled={loading}
							>
								{loading ? (
									<span className="spinner" />
								) : (
									<>
										<CheckCircle2 size={18} />
										Place Order — ₹{checkoutTotal.toFixed(2)}
									</>
								)}
							</button>
						</form>
					</div>

					<div className={styles['review-card']}>
						<h2>Order Review</h2>

						{checkoutItems.map((item) => (
							<div key={item.product.id} className={styles['review-item']}>
								<span>
									<span className={styles['review-item-name']}>{item.product.name}</span>
									<span className={styles['review-item-qty']}> × {item.quantity}</span>
								</span>
								<span className={styles['review-item-price']}>
									₹{(Number(item.product.price) * item.quantity).toFixed(2)}
								</span>
							</div>
						))}

						<div className={styles['review-divider']} />

						<div className={styles['review-item']}>
							<span>Shipping</span>
							<span style={{ color: 'var(--color-success)', fontWeight: 600 }}>Free</span>
						</div>

						<div className={styles['review-divider']} />

						<div className={styles['review-total']}>
							<span>Total</span>
							<span>₹{checkoutTotal.toFixed(2)}</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
