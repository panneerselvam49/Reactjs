'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowUpRight, Boxes, Calendar, ChevronDown, Menu, Package, Search, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import { getManagedOrders, updateOrderStatus } from '@/services/api';
import type { ManagedOrder } from '@/types';
import styles from './manage-orders.module.css';

export default function ManagedOrdersPage() {
	const { user, isAdminOrSeller, isLoading } = useAuth();
	const router = useRouter();
	const [orders, setOrders] = useState<ManagedOrder[]>([]);
	const [search, setSearch] = useState('');
	const [loading, setLoading] = useState(true);
	const [menuOpen, setMenuOpen] = useState(false);
	const [expandedOrders, setExpandedOrders] = useState<Record<number, boolean>>({});
	const [updatingOrderId, setUpdatingOrderId] = useState<number | null>(null);

	useEffect(() => {
		if (!isLoading && (!user || !isAdminOrSeller)) {
			router.replace(user ? '/' : '/login');
		}
	}, [isLoading, user, isAdminOrSeller, router]);

	useEffect(() => {
		if (!isAdminOrSeller) return;
		const loadOrders = async () => {
			try {
				const response = await getManagedOrders();
				if (!response.success) {
					throw new Error(response.message || 'Unable to load orders');
				}
				setOrders(Array.isArray(response.orders) ? response.orders : []);
			} catch (error) {
				console.error('Failed to fetch managed orders:', error);
				toast.error('Unable to load orders.');
			} finally {
				setLoading(false);
			}
		};
		void loadOrders();
	}, [isAdminOrSeller]);

	const visibleOrders = useMemo(() => {
		const query = search.trim().toLowerCase();
		if (!query) return orders;
		return orders.filter((order) =>
			[String(order.id), String(order.userId), order.address].some((value) =>
				value.toLowerCase().includes(query)
			)
		);
	}, [orders, search]);

	const itemCount = orders.reduce(
		(total, order) => total + order.items.reduce((count, item) => count + item.quantity, 0),
		0
	);
	const managedSales = orders.reduce(
		(total, order) =>
			total + order.items.reduce((sum, item) => sum + Number(item.unitPrice) * item.quantity, 0),
		0
	);

	const formatDate = (date: string) =>
		new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

	const handleStatusChange = async (orderId: number, status: 'shipped' | 'delivered') => {
		setUpdatingOrderId(orderId);
		try {
			const response = await updateOrderStatus(orderId, status);
			if (!response.success) throw new Error(response.message);
			setOrders((current) =>
				current.map((order) =>
					order.id === orderId
						? {
							...order,
							status,
							[status === 'shipped' ? 'shippedAt' : 'deliveredAt']: new Date().toISOString(),
						}
						: order
				)
			);
			toast.success(`Order marked as ${status}`);
		} catch (error) {
			console.error('Failed to update order status:', error);
			toast.error(error instanceof Error ? error.message : 'Unable to update order status');
		} finally {
			setUpdatingOrderId(null);
		}
	};

	if (isLoading || !user || !isAdminOrSeller) {
		return <div className="loading-page"><div className="spinner spinner-lg" /></div>;
	}

	return (
		<div className={styles.page}>
			<aside className={`${styles.sidebar} ${menuOpen ? styles.sidebarOpen : ''}`}>
				<div className={styles.sidebarHeader}>
					<div className={styles.brandMark}><Boxes size={19} /></div>
					<div><strong>ShopHub</strong><span>Control center</span></div>
					<button className={styles.closeMenu} onClick={() => setMenuOpen(false)} aria-label="Close menu"><X size={20} /></button>
				</div>
				<nav className={styles.sidebarNav} aria-label="Management navigation">
					<span className={styles.navLabel}>Workspace</span>
					<Link href="/dashboard" className={styles.navItem}><Boxes size={17} /> Inventory</Link>
					<Link href="/manage-orders" className={styles.navItemActive}><Package size={17} /> Orders</Link>
					<span className={styles.navLabel}>Storefront</span>
					<Link href="/" className={styles.navItem}>View shop <ArrowUpRight size={15} /></Link>
				</nav>
			</aside>
			{menuOpen && <button className={styles.overlay} onClick={() => setMenuOpen(false)} aria-label="Close menu" />}

			<main className={styles.main}>
				<header className={styles.header}>
					<button className={styles.menuButton} onClick={() => setMenuOpen(true)} aria-label="Open menu"><Menu size={21} /></button>
					<div>
						<p className={styles.eyebrow}>OPERATIONS / ORDERS</p>
						<h1>{user.role === 'admin' ? 'Order overview' : 'Your orders'}</h1>
						<p className={styles.subtitle}>Review open orders and the products that need fulfillment.</p>
					</div>
				</header>

				<section className={styles.stats} aria-label="Order summary">
					<div className={styles.statCard}><span>Open orders</span><strong>{orders.length}</strong><Package size={22} /></div>
					<div className={styles.statCard}><span>Items to fulfill</span><strong>{itemCount}</strong><Boxes size={22} /></div>
					<div className={styles.statCard}><span>Managed sales</span><strong>₹ {managedSales.toFixed(2)}</strong><span className={styles.statIcon}>₹</span></div>
				</section>

				<section className={styles.tableCard}>
					<div className={styles.tableHeader}>
						<div><h2>Order list</h2><p>{visibleOrders.length} of {orders.length} open orders</p></div>
						<label className={styles.search}><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search order or address..." /></label>
					</div>
					{loading ? <div className={styles.emptyState}><div className="spinner" /><p>Loading orders...</p></div> : visibleOrders.length === 0 ? (
						<div className={styles.emptyState}><Package size={28} /><p>{orders.length === 0 ? 'No open orders yet.' : 'No orders match your search.'}</p></div>
					) : (
						<div className={styles.orderList}>
							{visibleOrders.map((order) => {
								const expanded = expandedOrders[order.id] ?? false;
								return (
									<article key={order.id} className={styles.orderCard}>
										<button className={styles.orderSummary} onClick={() => setExpandedOrders((current) => ({ ...current, [order.id]: !expanded }))} aria-expanded={expanded}>
											<div><strong>Order #{order.id}</strong><span><Calendar size={13} /> {formatDate(order.createdAt)}</span></div>
											<div>
												<span className={styles.customer}>Customer #{order.userId}</span>
												{(order.status === 'ordered' || order.status === 'shipped') && (
													<select
														className={styles.statusSelect}
														value={order.status}
														disabled={updatingOrderId === order.id}
														onClick={(event) => event.stopPropagation()}
														onChange={(event) => {
															event.stopPropagation();
															void handleStatusChange(order.id, event.target.value as 'shipped' | 'delivered');
														}}
														aria-label={`Update status for order ${order.id}`}
													>
														{order.status === 'ordered' && <option value="ordered">Ordered</option>}
														{order.status === 'ordered' && <option value="shipped">Mark shipped</option>}
														{order.status === 'shipped' && <option value="shipped">Shipped</option>}
														{order.status === 'shipped' && <option value="delivered">Mark delivered</option>}
													</select>
												)}
												{order.status !== 'ordered' && <span className={styles.status}>{order.status}</span>}
												<ChevronDown size={18} className={expanded ? styles.rotated : ''} />
											</div>
										</button>
										{expanded && (
											<div className={styles.orderDetails}>
												<div className={styles.address}><strong>Delivery address</strong><span>{order.address}</span></div>
												<div className={styles.itemList}>
													{order.items.map((item) => (
														<div className={styles.item} key={item.id}>
															<div>{item.product?.images?.[0] ? <img src={item.product.images[0]} alt="" /> : <div className={styles.imagePlaceholder}><Package size={16} /></div>}<span>{item.product?.name || `Product #${item.productId ?? item.id}`}</span></div>
															<span>{item.quantity} × ₹{Number(item.unitPrice).toFixed(2)}</span>
															<strong>₹{(Number(item.unitPrice) * item.quantity).toFixed(2)}</strong>
														</div>
													))}
												</div>
												<div className={styles.total}><span>Order total</span><strong>₹{Number(order.totalAmount).toFixed(2)}</strong></div>
											</div>
										)}
									</article>
								);
							})}
						</div>
					)}
				</section>
			</main>
		</div>
	);
}
