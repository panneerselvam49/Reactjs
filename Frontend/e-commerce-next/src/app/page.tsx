'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownUp, ChevronRight, Search } from 'lucide-react';
import { getProducts, searchProducts } from '@/services/api';
import { useCart } from '@/context/CartContext';
import type { Product } from '@/types';
import ProductCard from '@/components/ProductCard/ProductCard';
import styles from './home.module.css';

const ITEMS_PER_PAGE = 12;

export default function HomePage() {
	const [products, setProducts] = useState<Product[]>([]);
	const [page, setPage] = useState(1);
	const [loading, setLoading] = useState(true);
	const [hasMore, setHasMore] = useState(true);
	const [search, setSearch] = useState('');
	const [sort, setSort] = useState<'featured' | 'price-low' | 'price-high'>('featured');
	const { setCartCount } = useCart();
	const requestId = useRef(0);

	useEffect(() => {
		const currentRequestId = ++requestId.current;
		const query = search.trim();
		const timer = window.setTimeout(() => {
			const loadProducts = async () => {
				setLoading(true);
				try {
					const response = query
						? await searchProducts(query)
						: await getProducts(page, ITEMS_PER_PAGE);

					if (currentRequestId !== requestId.current) return;

					setProducts((current) =>
						query || page === 1 ? response.product : [...current, ...response.product]
					);
					setCartCount(response.totalCartItems);
					setHasMore(!query && response.product.length === ITEMS_PER_PAGE);
				} catch (error) {
					if (currentRequestId === requestId.current) {
						console.error('Failed to fetch products:', error);
					}
				} finally {
					if (currentRequestId === requestId.current) {
						setLoading(false);
					}
				}
			};

			void loadProducts();
		}, query ? 300 : 0);

		return () => window.clearTimeout(timer);
	}, [page, search, setCartCount]);

	const filteredProducts = useMemo(() => {
		const result = products;

		if (sort === 'price-low') return [...result].sort((a, b) => Number(a.price) - Number(b.price));
		if (sort === 'price-high') return [...result].sort((a, b) => Number(b.price) - Number(a.price));
		return result;
	}, [products, sort]);

	return (
		<main className={styles.page}>
			<section className={styles.catalog} id="catalog">
				<div className="container">
					<div className={styles.catalogHeader}>
						<div>
							<p className={styles.kicker}>ALL PRODUCTS</p>
							<h2>Browse the collection</h2>
						</div>
						<div className={styles.controls}>
							<label className={styles.searchBox}>
								<Search size={15} />
								<input
									value={search}
									onChange={(event) => {
										setSearch(event.target.value);
										setPage(1);
									}}
									placeholder="Search"
									aria-label="Search products"
								/>
							</label>
							<label className={styles.sortBox}>
								<ArrowDownUp size={14} />
								<select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)} aria-label="Sort products">
									<option value="featured">Featured</option>
									<option value="price-low">Price: low to high</option>
									<option value="price-high">Price: high to low</option>
								</select>
							</label>
						</div>
					</div>

					{loading && products.length === 0 ? (
						<div className="loading-page"><div className="spinner" /><p>Loading products...</p></div>
					) : filteredProducts.length === 0 ? (
						<div className={styles.empty}>
							<Search size={26} />
							<h3>No products found</h3>
							<button onClick={() => {
								setSearch('');
								setPage(1);
							}}>Clear search</button>
						</div>
					) : (
						<>
							<div className="products-grid">
								{filteredProducts.map((product) => <ProductCard key={product.id} product={product} />)}
							</div>
							{hasMore && !search && (
								<button className={styles.loadMore} onClick={() => setPage((current) => current + 1)} disabled={loading}>
									{loading ? 'Loading...' : <>Load more <ChevronRight size={15} /></>}
								</button>
							)}
						</>
					)}
				</div>
			</section>
		</main>
	);
}
