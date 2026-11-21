'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ArrowUpRight, Boxes, Menu, PackagePlus, Pencil, Search, Trash2, Upload, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import { deleteManagedProduct, getManagedProducts, updateManagedProduct } from '@/services/api';
import { uploadMultipleFiles } from '@/services/uploadService';
import type { Product } from '@/types';
import styles from './dashboard.module.css';

interface EditProductForm {
	name: string;
	price: string;
	stock: string;
	category: string;
	description: string;
	isAvailableToBuy: boolean;
}

type ProductFilter = 'featured' | 'lowStock' | 'inStock' | 'unavailable';

export default function DashboardPage() {
	const { user, isAdminOrSeller, isLoading } = useAuth();
	const router = useRouter();
	const [products, setProducts] = useState<Product[]>([]);
	const [search, setSearch] = useState('');
	const [loading, setLoading] = useState(true);
	const [menuOpen, setMenuOpen] = useState(false);
	const [deletingId, setDeletingId] = useState<number | null>(null);
	const [editingProduct, setEditingProduct] = useState<Product | null>(null);
	const [editForm, setEditForm] = useState<EditProductForm | null>(null);
	const [selectedImages, setSelectedImages] = useState<File[]>([]);
	const [existingImages, setExistingImages] = useState<string[]>([]);
	const [imagePreviews, setImagePreviews] = useState<string[]>([]);
	const [saving, setSaving] = useState(false);
	const [productFilter, setProductFilter] = useState<ProductFilter>('featured');

	useEffect(() => {
		if (!isLoading && (!user || !isAdminOrSeller)) {
			router.replace(user ? '/' : '/login');
		}
	}, [isLoading, user, isAdminOrSeller, router]);

	useEffect(() => {
		if (!isAdminOrSeller) return;

		const loadProducts = async () => {
			try {
				const response = await getManagedProducts();
				setProducts(response.allProducts ?? response.productCreatedBySeller ?? []);
			} catch (error) {
				console.error('Failed to fetch managed products:', error);
				toast.error('Unable to load inventory.');
			} finally {
				setLoading(false);
			}
		};

		void loadProducts();
	}, [isAdminOrSeller]);

	const visibleProducts = useMemo(() => {
		const query = search.trim().toLowerCase();
		return products.filter((product) => {
			const matchesSearch = !query || [product.name, product.category, product.createdBy]
				.filter(Boolean)
				.some((value) => value?.toLowerCase().includes(query));
			const unavailable = product.stock <= 0 || !product.isAvailableToBuy;
			const matchesFilter = productFilter === 'featured'
				|| (productFilter === 'lowStock' && !unavailable && product.stock <= 5)
				|| (productFilter === 'inStock' && !unavailable && product.stock > 5)
				|| (productFilter === 'unavailable' && unavailable);
			return matchesSearch && matchesFilter;
		});
	}, [products, productFilter, search]);

	const lowStockCount = products.filter((product) => product.stock > 0 && product.stock <= 5).length;
	const outOfStockCount = products.filter((product) => product.stock <= 0 || !product.isAvailableToBuy).length;
	const totalUnits = products.reduce((total, product) => total + Number(product.stock), 0);

	const handleDelete = async (product: Product) => {
		if (!window.confirm(`Delete "${product.name}" from the catalog?`)) return;
		setDeletingId(product.id);
		try {
			await deleteManagedProduct(product.id);
			setProducts((current) => current.filter((item) => item.id !== product.id));
			toast.success('Product deleted.');
		} catch (error) {
			console.error('Failed to delete product:', error);
			toast.error('Unable to delete product.');
		} finally {
			setDeletingId(null);
		}
	};

	const openEditModal = (product: Product) => {
		setEditingProduct(product);
		setEditForm({
			name: product.name,
			price: String(product.price),
			stock: String(product.stock),
			category: product.category ?? '',
			description: product.description ?? '',
			isAvailableToBuy: product.isAvailableToBuy,
		});
		setSelectedImages([]);
		setExistingImages(product.images ?? []);
		setImagePreviews([]);
	};

	const closeEditModal = (force = false) => {
		if (saving && !force) return;
		imagePreviews.forEach((preview) => URL.revokeObjectURL(preview));
		setEditingProduct(null);
		setEditForm(null);
		setSelectedImages([]);
		setExistingImages([]);
		setImagePreviews([]);
	};

	const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		const files = Array.from(event.target.files ?? []);
		if (files.length === 0) return;
		const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
		const validFiles = files.filter((file) => allowedTypes.includes(file.type) && file.size <= 10 * 1024 * 1024);
		if (validFiles.length !== files.length) {
			toast.error('Some files were skipped. Use JPG, PNG, WEBP, or GIF images under 10MB.');
		}
		const availableSlots = 10 - existingImages.length - selectedImages.length;
		if (availableSlots <= 0) {
			toast.error('A product can have up to 10 images.');
			return;
		}
		const filesToAdd = validFiles.slice(0, availableSlots);
		if (filesToAdd.length < validFiles.length) {
			toast.error('Only 10 product images are allowed.');
		}
		setSelectedImages((current) => [...current, ...filesToAdd]);
		setImagePreviews((current) => [...current, ...filesToAdd.map((file) => URL.createObjectURL(file))]);
		event.target.value = '';
	};

	const removeExistingImage = (index: number) => {
		setExistingImages((current) => current.filter((_, imageIndex) => imageIndex !== index));
	};

	const removeSelectedImage = (index: number) => {
		const preview = imagePreviews[index];
		if (preview) URL.revokeObjectURL(preview);
		setSelectedImages((current) => current.filter((_, imageIndex) => imageIndex !== index));
		setImagePreviews((current) => current.filter((_, imageIndex) => imageIndex !== index));
	};

	const handleEditSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		if (!editingProduct || !editForm) return;
		const price = Number(editForm.price);
		const stock = Number(editForm.stock);
		if (!editForm.name.trim() || !editForm.category.trim() || !Number.isFinite(price) || price <= 0 ||
			!Number.isInteger(stock) || stock < 0) {
			toast.error('Enter a name, category, valid price, and non-negative stock.');
			return;
		}

		setSaving(true);
		try {
			let images = existingImages;
			if (selectedImages.length > 0) {
				toast.loading(`Uploading ${selectedImages.length} product image(s)...`, { id: 'edit-image' });
				const uploadedImages = await uploadMultipleFiles(selectedImages);
				images = [...existingImages, ...uploadedImages.map((image) => image.url)];
			}
			await updateManagedProduct(editingProduct.id, {
				productName: editForm.name.trim(),
				price,
				stock,
				category: editForm.category.trim(),
				description: editForm.description.trim(),
				images,
				productStatus: editForm.isAvailableToBuy,
			});
			setProducts((current) => current.map((product) => product.id === editingProduct.id ? {
				...product,
				name: editForm.name.trim(),
				price,
				stock,
				category: editForm.category.trim(),
				description: editForm.description.trim(),
				images,
				isAvailableToBuy: editForm.isAvailableToBuy,
			} : product));
			toast.success('Product updated successfully.', { id: 'edit-image' });
			closeEditModal(true);
		} catch (error) {
			console.error('Failed to update product:', error);
			toast.error('Unable to update product.', { id: 'edit-image' });
		} finally {
			setSaving(false);
		}
	};

	if (isLoading || !user || !isAdminOrSeller) {
		return <div className="loading-page"><div className="spinner spinner-lg" /></div>;
	}

	return (
		<div className={styles.dashboard}>
			<aside className={`${styles.sidebar} ${menuOpen ? styles.sidebarOpen : ''}`}>
				<div className={styles.sidebarHeader}>
					<div className={styles.brandMark}><Boxes size={19} /></div>
					<div><strong>ShopHub</strong><span>Control center</span></div>
					<button className={styles.closeMenu} onClick={() => setMenuOpen(false)} aria-label="Close menu"><X size={20} /></button>
				</div>
				<nav className={styles.sidebarNav} aria-label="Management navigation">
					<span className={styles.navLabel}>Workspace</span>
					<Link href="/dashboard" className={styles.navItemActive}><Boxes size={17} /> Inventory</Link>
					<Link href="/addProducts" className={styles.navItem}><PackagePlus size={17} /> Add product</Link>
					<Link href="/manage-orders" className={styles.navItem}><Boxes size={17} /> Orders</Link>
					<span className={styles.navLabel}>Storefront</span>
					<Link href="/" className={styles.navItem}>View shop <ArrowUpRight size={15} /></Link>
				</nav>
			</aside>

			{menuOpen && <button className={styles.overlay} onClick={() => setMenuOpen(false)} aria-label="Close menu" />}

			<main className={styles.main}>
				<header className={styles.header}>
					<button className={styles.menuButton} onClick={() => setMenuOpen(true)} aria-label="Open menu"><Menu size={21} /></button>
					<div>
						<p className={styles.eyebrow}>OPERATIONS / INVENTORY</p>
						<h1>{user.role === 'admin' ? 'Catalog overview' : 'Your inventory'}</h1>
						<p className={styles.subtitle}>Monitor stock and keep your storefront ready for customers.</p>
					</div>
					<Link href="/addProducts" className={styles.addButton}><PackagePlus size={17} /> Add product</Link>
				</header>

				<section className={styles.stats} aria-label="Inventory summary">
					<div className={styles.statCard}><span>Total products</span><strong>{products.length}</strong><Boxes size={22} /></div>
					<div className={styles.statCard}><span>Units in stock</span><strong>{totalUnits}</strong><PackagePlus size={22} /></div>
					<div className={`${styles.statCard} ${lowStockCount > 0 ? styles.warning : ''}`}><span>Low stock</span><strong>{lowStockCount}</strong><AlertTriangle size={22} /></div>
					<div className={`${styles.statCard} ${outOfStockCount > 0 ? styles.danger : ''}`}><span>Unavailable</span><strong>{outOfStockCount}</strong><Trash2 size={22} /></div>
				</section>

				<section className={styles.tableCard}>
					<div className={styles.tableHeader}>
						<div><h2>Product list</h2><p>{visibleProducts.length} of {products.length} products</p></div>
						<label className={styles.search}><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products..." /></label>
						<label className={styles.filterSelect}>
							<span className="sr-only">Filter products</span>
							<select className={styles.dropdownGap} value={productFilter} onChange={(event) => setProductFilter(event.target.value as ProductFilter)}>
								<option value="featured">Featured</option>
								<option value="lowStock">Low stock</option>
								<option value="inStock">In stock</option>
								<option value="unavailable">Unavailable</option>
							</select>
						</label>
					</div>
					{loading ? <div className={styles.emptyState}><div className="spinner" /><p>Loading inventory...</p></div> : visibleProducts.length === 0 ? (
						<div className={styles.emptyState}><Boxes size={28} /><p>No products match your search.</p></div>
					) : (
						<div className={styles.tableWrap}>
							<table className={styles.productTable}>
								<thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead>
								<tbody>{visibleProducts.map((product) => {
									const unavailable = product.stock <= 0 || !product.isAvailableToBuy;
									const lowStock = !unavailable && product.stock <= 5;
									return <tr key={product.id}>
										<td><div className={styles.productCell}>{product.images?.[0] ? <img src={product.images[0]} alt="" /> : <div className={styles.imagePlaceholder}><Boxes size={17} /></div>}<div><strong>{product.name}</strong><span>#{product.id}{user.role === 'admin' && product.createdBy ? ` · ${product.createdBy}` : ''}</span></div></div></td>
										<td>{product.category || 'Uncategorized'}</td>
										<td>₹ {Number(product.price).toFixed(2)}</td>
										<td><strong className={unavailable ? styles.stockDanger : lowStock ? styles.stockWarning : ''}>{product.stock}</strong></td>
										<td><span className={`${styles.status} ${unavailable ? styles.statusDanger : lowStock ? styles.statusWarning : styles.statusGood}`}>{unavailable ? 'Out of stock' : lowStock ? 'Low stock' : 'In stock'}</span></td>
										<td><div className={styles.actionButtons}><button className={styles.editButton} onClick={() => openEditModal(product)} aria-label={`Edit ${product.name}`}><Pencil size={16} /></button><button className={styles.deleteButton} onClick={() => void handleDelete(product)} disabled={deletingId === product.id} aria-label={`Delete ${product.name}`}><Trash2 size={16} /></button></div></td>
									</tr>;
								})}</tbody>
							</table>
						</div>
					)}
				</section>
			</main>
			{editingProduct && editForm && (
				<div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeEditModal(); }}>
					<section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="edit-product-title">
						<div className={styles.modalHeader}><div><p className={styles.eyebrow}>PRODUCT / EDIT</p><h2 id="edit-product-title">Edit product</h2></div><button className={styles.closeModal} onClick={() => closeEditModal()} aria-label="Close edit product dialog"><X size={20} /></button></div>
						<form onSubmit={handleEditSubmit} className={styles.editForm}>
							<div className={styles.editImageArea}>
								<div className={styles.editImageGrid}>
									{existingImages.map((image, index) => <div className={styles.editImageItem} key={`${image}-${index}`}><img src={image} alt="" className={styles.editImagePreview} /><button type="button" className={styles.removeImageButton} onClick={() => removeExistingImage(index)} disabled={saving} aria-label={`Remove image ${index + 1}`}><X size={13} /></button></div>)}
									{imagePreviews.map((preview, index) => <div className={styles.editImageItem} key={preview}><img src={preview} alt="" className={styles.editImagePreview} /><button type="button" className={styles.removeImageButton} onClick={() => removeSelectedImage(index)} disabled={saving} aria-label={`Remove selected image ${index + 1}`}><X size={13} /></button></div>)}
									{existingImages.length === 0 && imagePreviews.length === 0 && <div className={styles.editImagePlaceholder}><Boxes size={25} /></div>}
								</div>
								<label className={styles.imageUploadButton}><Upload size={15} /> Add images ({existingImages.length + selectedImages.length}/10)<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple onChange={handleImageChange} hidden disabled={saving || existingImages.length + selectedImages.length >= 10} /></label>
							</div>
							<label className={styles.field}>Product name<input value={editForm.name} onChange={(event) => setEditForm({ ...editForm, name: event.target.value })} disabled={saving} required /></label>
							<div className={styles.formGrid}>
								<label className={styles.field}>Price<input type="number" min="0.01" step="0.01" value={editForm.price} onChange={(event) => setEditForm({ ...editForm, price: event.target.value })} disabled={saving} required /></label>
								<label className={styles.field}>Stock<input type="number" min="0" step="1" value={editForm.stock} onChange={(event) => setEditForm({ ...editForm, stock: event.target.value })} disabled={saving} required /></label>
							</div>
							<label className={styles.field}>Category
								<select value={editForm.category} onChange={(event) => setEditForm({ ...editForm, category: event.target.value })} disabled={saving} required>
									<option value="">Select category</option>
									<option value="Mobile">Mobile</option>
									<option value="Accessories">Accessories</option>
									<option value="Electronics">Electronics</option>
									<option value="Fashion">Fashion</option>
									<option value="Wearables">Wearables</option>
								</select>
							</label>
							<label className={styles.field}>Description<textarea value={editForm.description} onChange={(event) => setEditForm({ ...editForm, description: event.target.value })} disabled={saving} rows={3} /></label>
							<label className={styles.availability}><input type="checkbox" checked={editForm.isAvailableToBuy} onChange={(event) => setEditForm({ ...editForm, isAvailableToBuy: event.target.checked })} disabled={saving} /> Available to buy</label>
							<div className={styles.modalActions}><button type="button" className={styles.cancelButton} onClick={() => closeEditModal()} disabled={saving}>Cancel</button><button type="submit" className={styles.saveButton} disabled={saving}>{saving ? 'Saving...' : 'Save changes'}</button></div>
						</form>
					</section>
				</div>
			)}
		</div>
	);
}
