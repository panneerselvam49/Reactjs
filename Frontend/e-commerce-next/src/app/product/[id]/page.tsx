'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Package, ShoppingBag, Star, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import { addToCart as apiAddToCart, getProductById, getProductReviews, submitProductReview } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import type { Product, ProductReview, ProductReviewSummary } from '@/types';
import styles from './product.module.css';

export default function ProductDetailsPage() {
	const { id } = useParams<{ id: string }>();
	const router = useRouter();
	const { user } = useAuth();
	const { addItem, setDirectBuyItem } = useCart();
	const [product, setProduct] = useState<Product | null>(null);
	const [selectedImage, setSelectedImage] = useState(0);
	const [loading, setLoading] = useState(true);
	const [actionLoading, setActionLoading] = useState(false);
	const [added, setAdded] = useState(false);
	const [error, setError] = useState('');
	const [reviews, setReviews] = useState<ProductReview[]>([]);
	const [reviewSummary, setReviewSummary] = useState<ProductReviewSummary>({
		averageRating: 0,
		ratingCount: 0,
		ratingBreakdown: {},
	});
	const [selectedRating, setSelectedRating] = useState(0);
	const [reviewComment, setReviewComment] = useState('');
	const [reviewLoading, setReviewLoading] = useState(false);

	useEffect(() => {
		const loadProduct = async () => {
			try {
				const data = await getProductById(Number(id));
				setProduct(data);
				const reviewData = await getProductReviews(Number(id));
				setReviews(reviewData.reviews);
				setReviewSummary(reviewData.summary);
			} catch {
				setError('We could not load this product. Please try again.');
			} finally {
				setLoading(false);
			}
		};

		if (id) loadProduct();
	}, [id]);

	if (loading) {
		return <main className="loading-page"><div className="spinner" /><p>Loading product details...</p></main>;
	}

	if (error || !product) {
		return (
			<main className="page-wrapper">
				<div className="container">
					<div className="empty-state">
						<h2>Product unavailable</h2>
						<p>{error || 'This product could not be found.'}</p>
						<button className="btn btn-primary" onClick={() => router.push('/')}>Back to shop</button>
					</div>
				</div>
			</main>
		);
	}

	const images = product.images?.filter(Boolean) || [];
	const isOutOfStock = !product.isAvailableToBuy || product.stock <= 0;

	const requireUser = () => {
		if (!user) {
			toast.error('Please sign in to continue');
			router.push('/login');
			return false;
		}
		return true;
	};

	const handleAddToCart = async () => {
		if (!requireUser() || isOutOfStock) return;
		setActionLoading(true);
		try {
			const response = await apiAddToCart({ userId: user!.id, productId: product.id, quantity: 1 });
			if (!response.success) {
				toast.error(response.message || 'Failed to add item to cart');
				return;
			}
			addItem(product, 1);
			setAdded(true);
			toast.success(`${product.name} added to cart!`);
			setTimeout(() => setAdded(false), 1500);
		} catch {
			toast.error('Something went wrong. Please try again.');
		} finally {
			setActionLoading(false);
		}
	};

	const handleBuyNow = () => {
		if (!requireUser() || isOutOfStock) return;
		setDirectBuyItem({ product, quantity: 1 });
		router.push('/checkout');
	};

	const handleReviewSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!requireUser()) return;
		if (!selectedRating) {
			toast.error('Please select a rating');
			return;
		}

		setReviewLoading(true);
		try {
			const response = await submitProductReview(product.id, {
				rating: selectedRating,
				comment: reviewComment,
			});
			if (!response.success || !response.review) {
				toast.error(response.message || 'Could not submit your review');
				return;
			}
			setReviews((current) => [response.review!, ...current]);
			setReviewComment('');
			setSelectedRating(0);
			const nextCount = reviewSummary.ratingCount + 1;
			setReviewSummary({
				averageRating: Number(((reviewSummary.averageRating * reviewSummary.ratingCount + selectedRating) / nextCount).toFixed(1)),
				ratingCount: nextCount,
				ratingBreakdown: {
					...reviewSummary.ratingBreakdown,
					[String(selectedRating)]: (reviewSummary.ratingBreakdown[String(selectedRating)] ?? 0) + 1,
				},
			});
			toast.success('Review submitted');
		} catch {
			toast.error('Could not submit your review');
		} finally {
			setReviewLoading(false);
		}
	};

	return (
		<main className={styles.page}>
			<div className="container">
				<button className={styles.backButton} onClick={() => window.close()}>
					<ArrowLeft size={17} /> Back
				</button>

				<div className={styles.productLayout}>
					<section className={styles.gallery} aria-label="Product images">
						<div className={styles.mainImage}>
							{images.length > 0 ? (
								<img src={images[selectedImage]} alt={`${product.name} image ${selectedImage + 1}`} />
							) : <Package size={72} />}
							{images.length > 1 && (
								<>
									<button className={`${styles.imageArrow} ${styles.previous}`} onClick={() => setSelectedImage((selectedImage - 1 + images.length) % images.length)} aria-label="Previous image"><ChevronLeft /></button>
									<button className={`${styles.imageArrow} ${styles.next}`} onClick={() => setSelectedImage((selectedImage + 1) % images.length)} aria-label="Next image"><ChevronRight /></button>
								</>
							)}
						</div>
						{images.length > 1 && (
							<div className={styles.thumbnails}>
								{images.map((image, index) => (
									<button key={image} className={`${styles.thumbnail} ${index === selectedImage ? styles.selected : ''}`} onClick={() => setSelectedImage(index)} aria-label={`View image ${index + 1}`}>
										<img src={image} alt="" />
									</button>
								))}
							</div>
						)}
					</section>

					<section className={styles.info}>
						<span className={styles.availability}>{isOutOfStock ? 'Out of stock' : `${product.stock} in stock`}</span>
						<h1>{product.name}</h1>
						<div className={styles.price}>₹ {Number(product.price).toFixed(2)}</div>
						<p className={styles.description}>{product.description || 'Premium quality product with fast delivery.'}</p>

						<div className={styles.actions}>
							<button className="btn btn-primary btn-lg" onClick={handleAddToCart} disabled={isOutOfStock || actionLoading}>
								{added ? <><Check size={18} /> Added to Cart</> : <><ShoppingBag size={18} /> Add to Cart</>}
							</button>
							<button className="btn btn-secondary btn-lg" onClick={handleBuyNow} disabled={isOutOfStock || actionLoading}>
								<Zap size={18} /> Buy Now
							</button>
						</div>

						<div className={styles.details}>
							<h2>Product details</h2>
							<dl>
								<div><dt>Availability</dt><dd>{product.isAvailableToBuy ? 'Available to buy' : 'Currently unavailable'}</dd></div>
								<div><dt>Stock</dt><dd>{product.stock} units</dd></div>
								<div><dt>Product ID</dt><dd>#{product.id}</dd></div>
								<div><dt>Added</dt><dd>{new Date(product.createdAt).toLocaleDateString()}</dd></div>
								<div><dt>Last updated</dt><dd>{new Date(product.updatedAt).toLocaleDateString()}</dd></div>
							</dl>
						</div>
					</section>
				</div>

				<section className={styles.reviews} aria-labelledby="reviews-heading">
					<div className={styles.reviewsHeader}>
						<div>
							<h2 id="reviews-heading">Customer reviews</h2>
							<div className={styles.ratingSummary}>
								<strong>{reviewSummary.averageRating.toFixed(1)}</strong>
								<span className={styles.stars} aria-label={`${reviewSummary.averageRating} out of 5 stars`}>
									{[1, 2, 3, 4, 5].map((star) => (
										<Star key={star} size={18} fill={star <= Math.round(reviewSummary.averageRating) ? 'currentColor' : 'none'} />
									))}
								</span>
								<span>{reviewSummary.ratingCount} review{reviewSummary.ratingCount === 1 ? '' : 's'}</span>
							</div>
						</div>
					</div>

					<form className={styles.reviewForm} onSubmit={handleReviewSubmit}>
						<h3>Rate this product</h3>
						<div className={styles.ratingPicker} aria-label="Choose a rating">
							{[1, 2, 3, 4, 5].map((star) => (
								<button
									key={star}
									type="button"
									className={star <= selectedRating ? styles.activeStar : styles.starButton}
									onClick={() => setSelectedRating(star)}
									aria-label={`${star} star${star === 1 ? '' : 's'}`}
								>
									<Star size={24} fill={star <= selectedRating ? 'currentColor' : 'none'} />
								</button>
							))}
						</div>
						<textarea
							value={reviewComment}
							onChange={(event) => setReviewComment(event.target.value)}
							placeholder="Share your experience (optional)"
							maxLength={1000}
							rows={3}
						/>
						<button className="btn btn-primary" type="submit" disabled={reviewLoading}>
							{reviewLoading ? 'Submitting...' : 'Submit review'}
						</button>
					</form>

					<div className={styles.reviewList}>
						{reviews.length === 0 ? <p className={styles.noReviews}>No reviews yet.</p> : reviews.map((review) => (
							<article className={styles.review} key={review.id}>
								<div className={styles.reviewTopline}>
									<strong>{review.user?.name || 'Customer'}</strong>
									<span className={styles.stars} aria-label={`${review.rating} out of 5 stars`}>
										{[1, 2, 3, 4, 5].map((star) => (
											<Star key={star} size={15} fill={star <= review.rating ? 'currentColor' : 'none'} />
										))}
									</span>
									<time dateTime={review.createdAt}>{new Date(review.createdAt).toLocaleDateString()}</time>
								</div>
								{review.comment && <p>{review.comment}</p>}
							</article>
						))}
					</div>
				</section>
			</div>
		</main>
	);
}
