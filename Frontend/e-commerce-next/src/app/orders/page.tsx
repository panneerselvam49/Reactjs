'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, Calendar, ChevronDown, ChevronLeft, ChevronRight, MapPin, Package, Search, ShoppingBag } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { getOrders, cancelOrder } from '@/services/api';
import type { Order } from '@/types';
import toast from 'react-hot-toast';
import styles from './orders.module.css';

export default function OrdersPage() {
	const { user, isLoading: isAuthLoading } = useAuth();
	const router = useRouter();
	const [orders, setOrders] = useState<Order[]>([]);
	const [loading, setLoading] = useState(true);
	const [collapsedOrders, setCollapsedOrders] = useState<Record<number, boolean>>({});
	const [cancellingId, setCancellingId] = useState<number | null>(null);
	const [searchTerm, setSearchTerm] = useState('');
	const [statusFilter, setStatusFilter] = useState<'all' | Order['status']>('all');
	const [currentPage, setCurrentPage] = useState(1);
	const ordersPerPage = 10;

	useEffect(() => {
		if (isAuthLoading || !user) return;
		const fetchOrders = async () => {
			try {
				const res = await getOrders();
				if (res.success) {
					setOrders(Array.isArray(res.orders) ? res.orders : []);
				} else {
					toast.error('Failed to load orders');
				}
			} catch (error) {
				console.error('Failed to fetch orders:', error);
				toast.error('Failed to load orders');
			} finally {
				setLoading(false);
			}
		};
		fetchOrders();
	}, [isAuthLoading, user]);

	useEffect(() => {
		if (!isAuthLoading && !user) {
			router.replace('/login');
		}
	}, [isAuthLoading, user, router]);

	useEffect(() => {
		setCurrentPage(1);
	}, [searchTerm, statusFilter]);

	if (isAuthLoading) {
		return (
			<div className="page-wrapper">
				<div className="container">
					<div className="loading-page">
						<div className="spinner" />
						<p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
							Checking your session...
						</p>
					</div>
				</div>
			</div>
		);
	}

	if (!user) {
		return null;
	}

	const toggleOrder = (orderId: number) => {
		setCollapsedOrders((prev) => ({
			...prev,
			[orderId]: !prev[orderId],
		}));
	};

	const handleCancelOrder = async (orderId: number) => {
		if (!confirm('Are you sure you want to cancel this order?')) return;

		setCancellingId(orderId);
		try {
			const res = await cancelOrder(orderId, user.id);
			if (res.success) {
				setOrders((prev) =>
					prev.map((o) =>
						o.id === orderId ? { ...o, status: 'cancelled' as const } : o
					)
				);
				toast.success('Order cancelled successfully');
			} else {
				toast.error(res.message || 'Failed to cancel order');
			}
		} catch (err: unknown) {
			const message =
				err && typeof err === 'object' && 'response' in err
					? (err as { response: { data: { message: string } } }).response?.data?.message
					: 'Failed to cancel order';
			toast.error(message);
		} finally {
			setCancellingId(null);
		}
	};

	const formatDate = (dateStr: string) => {
		return new Date(dateStr).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
		});
	};

	const formatDateTime = (dateStr?: string | null) =>
		dateStr
			? new Date(dateStr).toLocaleString('en-US', {
				month: 'short',
				day: 'numeric',
				year: 'numeric',
				hour: 'numeric',
				minute: '2-digit',
			})
			: 'Waiting';

	const getStatusBadgeClass = (status: Order['status']) => {
		const map: Record<string, string> = {
			ordered: 'badge badge-ordered',
			shipped: 'badge badge-shipped',
			delivered: 'badge badge-delivered',
			cancelled: 'badge badge-cancelled',
		};
		return map[status] || 'badge';
	};

	const filteredOrders = useMemo(() => {
		const query = searchTerm.trim().toLowerCase();

		return orders.filter((order) => {
			if (statusFilter !== 'all' && order.status !== statusFilter) return false;
			if (!query) return true;

			const productNames = order.items?.map((item) =>
				item.product?.name || `Product #${item.productId}`
			).join(' ') || '';

			return [String(order.id), order.status, order.address, productNames]
				.some((value) => value.toLowerCase().includes(query));
		});
	}, [orders, searchTerm, statusFilter]);

	const totalPages = Math.max(1, Math.ceil(filteredOrders.length / ordersPerPage));
	const visibleOrders = filteredOrders.slice(
		(currentPage - 1) * ordersPerPage,
		currentPage * ordersPerPage,
	);

	if (loading) {
		return (
			<div className="page-wrapper">
				<div className="container">
					<div className="loading-page">
						<div className="spinner" />
						<p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
							Loading your orders...
						</p>
					</div>
				</div>
			</div>
		);
	}

	if (orders.length === 0) {
		return (
			<div className="page-wrapper">
				<div className="container">
					<div className="empty-state">
						<div className="empty-state-icon">
							<Package size={32} />
						</div>
						<h3>No Orders Yet</h3>
						<p>You haven&apos;t placed any orders. Start shopping to see your orders here!</p>
						<Link href="/" className="btn btn-primary btn-lg">
							<ShoppingBag size={18} />
							Start Shopping
						</Link>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="page-wrapper">
			<div className="container">
				<div className={styles.pageIntro}>
					<p className={styles.eyebrow}>SHOPHUB ACCOUNT</p>
					<h1>My orders</h1>
					<span>Review your purchases, delivery details, and order status.</span>
				</div>

				<div className={styles['order-tools']} aria-label="Find orders">
					<label className={styles['order-search']}>
						<Search size={16} />
						<input
							type="search"
							value={searchTerm}
							onChange={(event) => setSearchTerm(event.target.value)}
							placeholder="Search order number, product, or address"
							aria-label="Search orders"
						/>
					</label>
					<label className={styles['status-filter']}>
						<span>Status</span>
						<select
							value={statusFilter}
							onChange={(event) => setStatusFilter(event.target.value as 'all' | Order['status'])}
							aria-label="Filter orders by status"
						>
							<option value="all">All orders</option>
							<option value="ordered">Ordered</option>
							<option value="shipped">Shipped</option>
							<option value="delivered">Delivered</option>
							<option value="cancelled">Cancelled</option>
						</select>
					</label>
				</div>

				<div className={styles['orders-summary']}>
					<span>{filteredOrders.length} {filteredOrders.length === 1 ? 'order' : 'orders'} found</span>
					{filteredOrders.length > 0 && (
						<span>
							Showing {(currentPage - 1) * ordersPerPage + 1}-{Math.min(currentPage * ordersPerPage, filteredOrders.length)}
						</span>
					)}
				</div>

				{filteredOrders.length === 0 ? (
					<div className={styles['no-results']}>
						<Search size={26} />
						<strong>No matching orders</strong>
						<span>Try a different order number, product, address, or status.</span>
					</div>
				) : <div className={styles['orders-list']}>
					{visibleOrders.map((order) => {
						const isExpanded = !collapsedOrders[order.id];

						return (
							<div key={order.id} className={styles['order-card']}>
								<div
									className={styles['order-header']}
									onClick={() => toggleOrder(order.id)}
								>
									<div className={styles['order-header-left']}>
										<span className={styles['order-id']}>Order #{order.id}</span>
										<span className={styles['order-date']}>
											<Calendar size={14} />
											{formatDate(order.createdAt)}
										</span>
										<span className={styles['order-amount']}>
											₹{Number(order.totalAmount).toFixed(2)}
										</span>
									</div>

									<div className={styles['order-header-right']}>
										<span className={getStatusBadgeClass(order.status)}>
											{order.status}
										</span>

										{order.status === 'ordered' && (
											<button
												className={`btn btn-danger btn-sm ${styles['cancel-btn']}`}
												onClick={(e) => {
													e.stopPropagation();
													handleCancelOrder(order.id);
												}}
												disabled={cancellingId === order.id}
											>
												{cancellingId === order.id ? (
													<span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
												) : (
													<>
														<AlertCircle size={12} />
														Cancel
													</>
												)}
											</button>
										)}

										<div
											className={`${styles['order-toggle']} ${isExpanded ? styles.expanded : ''}`}
										>
											<ChevronDown size={18} />
										</div>
									</div>
								</div>

								{isExpanded && (
									<div className={styles['order-details']}>
										<div className={styles['order-address']}>
											<MapPin size={16} style={{ flexShrink: 0, marginTop: 2 }} />
											<div>
												<strong>Delivery Address</strong>
												{order.address}
											</div>
										</div>

										<div className={styles['order-timeline']} aria-label="Order tracking">
											{([
												['ordered', 'Ordered', order.orderedAt || order.createdAt],
												['shipped', 'Shipped', order.shippedAt],
												['delivered', 'Delivered', order.deliveredAt],
												['cancelled', 'Cancelled', order.cancelledAt],
											] as const).map(([status, label, timestamp]) => (
												<div
													key={status}
													className={`${styles['timeline-step']} ${order.status === status ? styles.active : ''} ${
														timestamp ? styles.complete : ''
													}`}
												>
													<strong>{label}</strong>
													<span>{formatDateTime(timestamp)}</span>
												</div>
											))}
										</div>

										{/* Items Table */}
										{order.items && order.items.length > 0 ? (
											<table className={styles['order-items-table']}>
												<thead>
													<tr>
														<th>Product</th>
														<th>Qty</th>
														<th>Unit Price</th>
														<th>Subtotal</th>
													</tr>
												</thead>
												<tbody>
													{order.items.map((item) => {
														const productName =
															item.product?.name ||
															(item.productId ? `Product #${item.productId}` : `Item #${item.id}`);
														const productImg =
															item.product?.images && item.product.images.length > 0
																? item.product.images[0]
																: null;

														return (
															<tr key={item.id}>
																<td>
																	<div className={styles['order-item-cell']}>
																		{productImg ? (
																			<img
																				src={productImg}
																				alt={productName}
																				className={styles['order-item-thumb']}
																			/>
																		) : (
																			<div className={styles['order-item-thumb-placeholder']}>
																				<Package size={20} />
																			</div>
																		)}
																		<div className={styles['order-item-info']}>
																			<span className={styles['order-item-name']}>
																				{productName}
																			</span>
																		</div>
																	</div>
																</td>
																<td>{item.quantity}</td>
																<td>₹{Number(item.unitPrice).toFixed(2)}</td>
																<td style={{ fontWeight: 600 }}>
																	₹{(Number(item.unitPrice) * item.quantity).toFixed(2)}
																</td>
															</tr>
														);
													})}
												</tbody>
											</table>
										) : (
											<div className={styles['order-no-items']}>
												No item details found for this order.
											</div>
										)}
									</div>
								)}
							</div>
						);
					})}
				</div>}

				{totalPages > 1 && (
					<div className={styles.pagination} aria-label="Order pages">
						<button
							type="button"
							className="btn btn-secondary btn-sm"
							onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
							disabled={currentPage === 1}
							aria-label="Previous page"
						>
							<ChevronLeft size={15} />
							Previous
						</button>
						<span>Page {currentPage} of {totalPages}</span>
						<button
							type="button"
							className="btn btn-secondary btn-sm"
							onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
							disabled={currentPage === totalPages}
							aria-label="Next page"
						>
							Next
							<ChevronRight size={15} />
						</button>
					</div>
				)}
			</div>
		</div>
	);
}
