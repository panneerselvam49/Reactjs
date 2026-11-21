'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Minus, Plus, Trash2, ShoppingCart, Package, ArrowRight } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { addToCart, getCartItems, removeFromCart } from '@/services/api';
import type { CartItem } from '@/types';
import toast from 'react-hot-toast';
import styles from './cart.module.css';

export default function CartPage() {
	const { items, setItemsFromServer, setDirectBuyItem, updateQuantity, removeItem, totalItems, totalPrice } = useCart();
	const { user, isLoading: isAuthLoading } = useAuth();
	const router = useRouter();
	const userId = user?.id;
	const [updatingProductId, setUpdatingProductId] = useState<number | null>(null);

	useEffect(() => {
		if (isAuthLoading) {
			return;
		}

		if (!user) {
			router.replace('/login');
			return;
		}

		const loadCartItems = async () => {
			try {
				const response = await getCartItems();
				if (!response.success) {
					toast.error(response.message || 'Failed to load cart');
					return;
				}

				const localCartItems = (response.cartItems ?? [])
					.filter((item: CartItem): item is CartItem & { product: NonNullable<CartItem['product']> } =>
						Boolean(item.product)
					)
					.map((item) => ({ cartId: item.id, product: item.product, quantity: item.quantity }));
				setItemsFromServer(localCartItems);
			} catch {
				toast.error('Failed to load cart. Please try again.');
			}
		};

		void loadCartItems();
	}, [user, isAuthLoading, router, setItemsFromServer]);

	const handleQuantityChange = async (item: (typeof items)[number], direction: 'increase' | 'decrease') => {
		if (!userId || !item.cartId) {
			toast.error('Unable to identify this cart item or user');
			return;
		}

		setUpdatingProductId(item.product.id);
		try {
			const response =
				direction === 'increase'
					? await addToCart({
						userId,
						productId: item.product.id,
						quantity: 1,
					})
					: await removeFromCart({
						userId,
						cartId: item.cartId,
						quantity: 1,
					});

			if (!response.success) {
				toast.error(response.message || 'Failed to update cart');
				return;
			}

			updateQuantity(
				item.product.id,
				direction === 'increase' ? item.quantity + 1 : item.quantity - 1
			);
		} catch {
			toast.error('Failed to update cart. Please try again.');
		} finally {
			setUpdatingProductId(null);
		}
	};

	const handleRemoveItem = async (cartId: number | undefined, productId: number, quantity: number) => {
		if (!userId || !cartId) {
			toast.error('Unable to identify this cart item or user');
			return;
		}

		try {
			const response = await removeFromCart({
				userId,
				cartId,
				quantity,
			});

			if (!response.success) {
				toast.error(response.message || 'Failed to remove item from cart');
				return;
			}

			removeItem(productId);
			toast.success('Item removed from cart');
		} catch {
			toast.error('Failed to remove item from cart. Please try again.');
		}
	};

	if (isAuthLoading || !user) {
		return null;
	}

	if (items.length === 0) {
		return (
			<div className="page-wrapper">
				<div className="container">
					<div className="empty-state">
						<div className="empty-state-icon">
							<ShoppingCart size={32} />
						</div>
						<h3>Your Cart is Empty</h3>
						<p>Looks like you haven&apos;t added any products yet. Start exploring our collection!</p>
						<Link href="/" className="btn btn-primary btn-lg">
							Browse Products
						</Link>
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
					Shopping Cart
				</h1>

				<div className={styles['cart-layout']}>
					<div className={styles['cart-items-card']}>
						<div className={styles['cart-items-header']}>
							<h2>Cart Items</h2>
							<span>{totalItems} {totalItems === 1 ? 'item' : 'items'}</span>
						</div>

						{items.map((item) => (
							<div key={item.product.id} className={styles['cart-item']}>
								<div className={styles['cart-item-image']}>
									{item.product.images?.[0] ? (
										<img src={item.product.images[0]} alt={item.product.name} />
									) : (
										<Package size={28} />
									)}
								</div>

								<div className={styles['cart-item-info']}>
									<h3>{item.product.name}</h3>
									<p className={styles['cart-item-price']}>
										₹{Number(item.product.price).toFixed(2)} each
									</p>
								</div>

								<div className={styles['quantity-controls']}>
									<button
										className={styles['quantity-btn']}
										onClick={() => handleQuantityChange(item, 'decrease')}
										disabled={updatingProductId === item.product.id}
									>
										<Minus size={14} />
									</button>
									<span className={styles['quantity-value']}>{item.quantity}</span>
									<button
										className={styles['quantity-btn']}
										onClick={() => handleQuantityChange(item, 'increase')}
										disabled={updatingProductId === item.product.id || item.quantity >= item.product.stock}
									>
										<Plus size={14} />
									</button>
								</div>

								<div className={styles['cart-item-subtotal']}>
									₹{(Number(item.product.price) * item.quantity).toFixed(2)}
								</div>

								<button
									className={styles['cart-item-remove']}
									onClick={() => handleRemoveItem(item.cartId, item.product.id, item.quantity)}
									title="Remove item"
								>
									<Trash2 size={18} />
								</button>
							</div>
						))}
					</div>

					<div className={styles['order-summary']}>
						<h2>Order Summary</h2>

						<div className={styles['summary-row']}>
							<span>Subtotal ({totalItems} items)</span>
							<span>₹{totalPrice.toFixed(2)}</span>
						</div>

						<div className={styles['summary-row']}>
							<span>Shipping</span>
							<span style={{ color: 'var(--color-success)', fontWeight: 600 }}>{totalPrice > 600 ? 'Free' : '₹49.00'}</span>
						</div>

						<div className={styles['summary-total']}>
							<span>Total</span>
							<span>₹{(totalPrice + (totalPrice > 600 ? 0 : 49.0)).toFixed(2)}</span>
						</div>

						<Link
							href="/checkout"
							className={`btn btn-primary btn-full ${styles['checkout-btn']}`}
							onClick={() => setDirectBuyItem(null)}
						>
							Proceed to Checkout
							<ArrowRight size={18} />
						</Link>

						<Link href="/" className={styles['continue-shopping']}>
							← Continue Shopping
						</Link>
					</div>
				</div>
			</div>
		</div>
	);
}
