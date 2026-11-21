'use client';

import React, { useState } from 'react';
import { ShoppingBag, Check, Package, Zap } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import type { Product } from '@/types';
import { addToCart as apiAddToCart } from '@/services/api';
import styles from './ProductCard.module.css';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';

interface Props {
	product: Product;
}

export default function ProductCard({ product }: Props) {
	const { addItem, setDirectBuyItem } = useCart();
	const { user } = useAuth();
	const router = useRouter();
	const [added, setAdded] = useState(false);
	const [loading, setLoading] = useState(false);

	const openProductDetails = () => {
		window.open(`/product/${product.id}`, '_blank', 'noopener,noreferrer');
	};

	const handleAddToCart = async () => {
		if (!user) {
			toast.error('Please sign in to add items to cart');
			router.push('/login');
			return;
		}

		if (!product.isAvailableToBuy || product.stock <= 0) return;

		setLoading(true);
		try {
			const response = await apiAddToCart({
				userId: user.id,
				productId: product.id,
				quantity: 1,
			});

			if (!response.success) {
				toast.error(response.message || 'Failed to add item to cart');
				return;
			}

			addItem(product, 1);
			setAdded(true);
			toast.success(`${product.name} added to cart!`);
			setTimeout(() => setAdded(false), 1500);
		} catch (error: unknown) {
			const message =
				error && typeof error === 'object' && 'response' in error
					? (error as { response?: { data?: { message?: string } } }).response?.data?.message
					: undefined;
			toast.error(message || 'Something went wrong. Please try again.');
		} finally {
			setLoading(false);
		}
	};

	const handleBuyNow = () => {
		if (!user) {
			toast.error('Please sign in to buy this product');
			router.push('/login');
			return;
		}

		if (isOutOfStock) return;
		setDirectBuyItem({ product, quantity: 1 });
		router.push('/checkout');
	};

	const isOutOfStock = !product.isAvailableToBuy || product.stock <= 0;
	const mainImage = product.images && product.images.length > 0 ? product.images[0] : null;

	return (
		<div
			className={styles['product-card']}
			onClick={openProductDetails}
			onKeyDown={(event) => {
				if (event.key === 'Enter' || event.key === ' ') {
					event.preventDefault();
					openProductDetails();
				}
			}}
			role="link"
			tabIndex={0}
			aria-label={`View details for ${product.name}`}
		>
			<div className={styles['product-image']}>
				{mainImage ? (
					<img src={mainImage} alt={product.name} className={styles['product-real-img']} />
				) : (
					<Package size={48} className={styles['product-image-icon']} />
				)}
				<div className={styles['product-stock-badge']}>
					{isOutOfStock ? (
						<span className="badge badge-out-of-stock">Out of Stock</span>
					) : product.stock <= 5 ? (
						<span className="badge badge-shipped">Only {product.stock} left</span>
					) : null}
				</div>
			</div>

			<div className={styles['product-content']}>
				<h3 className={styles['product-name']}>{product.name}</h3>
				<p className={styles['product-description']}>
					{product.description || 'Premium quality product with fast delivery.'}
				</p>
			</div>

			<div className={styles['product-footer']}>
				<div className={styles['product-price']}>
					₹ {Number(product.price).toFixed(2)}
				</div>
				<div className={styles['product-actions']}>
					<button
						className={`${styles['product-add-btn']} ${added ? styles.added : ''}`}
						onClick={(event) => {
							event.stopPropagation();
							handleAddToCart();
						}}
						disabled={isOutOfStock || loading}
					>
						{loading ? (
							<span className="spinner" />
						) : added ? (
							<>
								<Check size={16} />
								Added
							</>
						) : (
							<>
								<ShoppingBag size={16} />
								Add to Cart
							</>
						)}
					</button>
					<button
						className={styles['product-buy-btn']}
						onClick={(event) => {
							event.stopPropagation();
							handleBuyNow();
						}}
						disabled={isOutOfStock || loading}
					>
						<Zap size={15} />
						Buy Now
					</button>
				</div>
			</div>
		</div>
	);
}
