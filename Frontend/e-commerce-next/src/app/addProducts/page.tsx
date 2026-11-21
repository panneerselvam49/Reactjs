'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { uploadMultipleFiles, createProduct } from '@/services/uploadService';
import toast from 'react-hot-toast';
import { Upload, Package, DollarSign, Layers, FileText, ImageIcon, X, ArrowLeft, CheckCircle, IndianRupee, Plus, Star } from 'lucide-react';
import Link from 'next/link';
import styles from './addProduct.module.css';

interface SelectedImage {
	id: string;
	file: File;
	previewUrl: string;
}

const MAX_IMAGES = 10;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export default function AddProductPage() {
	const { user, isAdminOrSeller, isLoading } = useAuth();
	const router = useRouter();

	const [name, setName] = useState('');
	const [price, setPrice] = useState('');
	const [stock, setStock] = useState('');
	const [description, setDescription] = useState('');
	const [images, setImages] = useState<SelectedImage[]>([]);
	const [category, setCategory] = useState('');
	const [uploadProgress, setUploadProgress] = useState(0);
	const [submitting, setSubmitting] = useState(false);
	const [dragOver, setDragOver] = useState(false);

	const fileInputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (!isLoading) {
			if (!user) {
				router.replace('/login');
			} else if (!isAdminOrSeller) {
				toast.error('Access denied. Only admins and sellers can add products.');
				router.replace('/');
			}
		}
	}, [isLoading, user, isAdminOrSeller, router]);

	useEffect(() => {
		return () => {
			images.forEach((img) => URL.revokeObjectURL(img.previewUrl));
		};
	}, [images]);

	const handleAddFiles = useCallback((incomingFiles: FileList | File[]) => {
		const fileArray = Array.from(incomingFiles);
		if (fileArray.length === 0) return;

		setImages((prev) => {
			const availableSlots = MAX_IMAGES - prev.length;
			if (availableSlots <= 0) {
				toast.error(`Maximum ${MAX_IMAGES} images allowed.`);
				return prev;
			}

			const validNewImages: SelectedImage[] = [];
			let duplicateCount = 0;
			let invalidTypeCount = 0;
			let oversizedCount = 0;

			for (const file of fileArray) {
				if (validNewImages.length >= availableSlots) {
					toast.error(`Limit reached! You can only upload up to ${MAX_IMAGES} images.`);
					break;
				}

				if (!ALLOWED_TYPES.includes(file.type)) {
					invalidTypeCount++;
					continue;
				}

				if (file.size > 10 * 1024 * 1024) {
					oversizedCount++;
					continue;
				}

				const isDuplicate =
					prev.some((img) => img.file.name === file.name && img.file.size === file.size) ||
					validNewImages.some((img) => img.file.name === file.name && img.file.size === file.size);

				if (isDuplicate) {
					duplicateCount++;
					continue;
				}

				validNewImages.push({
					id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
					file,
					previewUrl: URL.createObjectURL(file),
				});
			}

			if (invalidTypeCount > 0) {
				toast.error(`${invalidTypeCount} file(s) skipped: Only JPG, PNG, WEBP, or GIF allowed.`);
			}
			if (oversizedCount > 0) {
				toast.error(`${oversizedCount} file(s) skipped: Must be under 10MB.`);
			}
			if (duplicateCount > 0) {
				toast.error(`${duplicateCount} duplicate file(s) skipped.`);
			}
			if (validNewImages.length > 0) {
				toast.success(`Added ${validNewImages.length} image(s).`);
			}

			return [...prev, ...validNewImages];
		});
	}, []);

	const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
		if (e.target.files && e.target.files.length > 0) {
			handleAddFiles(e.target.files);
			e.target.value = ''; // Reset input to allow selecting identical file again if deleted
		}
	};

	const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		setDragOver(false);
		if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
			handleAddFiles(e.dataTransfer.files);
		}
	};

	const removeImage = (idToRemove: string) => {
		setImages((prev) => {
			const item = prev.find((img) => img.id === idToRemove);
			if (item) URL.revokeObjectURL(item.previewUrl);
			return prev.filter((img) => img.id !== idToRemove);
		});
	};

	const clearAllImages = () => {
		images.forEach((img) => URL.revokeObjectURL(img.previewUrl));
		setImages([]);
		setUploadProgress(0);
		if (fileInputRef.current) fileInputRef.current.value = '';
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!name.trim() || !price || !stock) {
			toast.error('Name, price and stock are required.');
			return;
		}
		if (Number(price) <= 0 || Number(stock) < 0) {
			toast.error('Price must be greater than 0 and stock cannot be negative.');
			return;
		}

		setSubmitting(true);
		try {
			let imageUrls: string[] = [];
			if (images.length > 0) {
				toast.loading(`Uploading ${images.length} image(s)...`, { id: 'upload' });
				const filesToUpload = images.map((img) => img.file);
				const uploadResults = await uploadMultipleFiles(filesToUpload, (pct) => setUploadProgress(pct));
				imageUrls = uploadResults.map((item) => item.url);
			}

			toast.loading('Creating product...', { id: 'create' });
			await createProduct({
				name: name.trim(),
				price: Number(price),
				stock: Number(stock),
				description: description.trim() || undefined,
				images: imageUrls,
				category: category.trim() || undefined,
			});
			toast.success('Product created successfully!', { id: 'create' });
			router.push('/');
		} catch (err: unknown) {
			const msg =
				(err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
				(err instanceof Error ? err.message : 'Something went wrong');
			toast.error(msg, { id: 'upload' });
			toast.dismiss('create');
		} finally {
			setSubmitting(false);
		}
	};

	if (isLoading || !user || !isAdminOrSeller) {
		return (
			<div className="loading-page">
				<div className="spinner spinner-lg" />
			</div>
		);
	}

	return (
		<div className="page-wrapper">
			<div className={`container ${styles.pageContainer}`}>
				<div className={styles.pageHeader}>
					<Link href="/" className={styles.backLink}>
						<ArrowLeft size={16} />
						Back to Shop
					</Link>
					<div className={styles.headerText}>
						<div className={styles.headerIcon}>
							<Package size={28} />
						</div>
						<div>
							<h1 className={styles.pageTitle}>List a product</h1>
							<p className={styles.pageSubtitle}>Add something new to the ShopHub collection.</p>
						</div>
					</div>
				</div>

				<form onSubmit={handleSubmit} className={styles.formLayout} id="add-product-form">
					<div className={styles.fieldsCard}>
						<h2 className={styles.sectionTitle}>Product information</h2>

						<div className="input-group">
							<label htmlFor="product-name" className="input-label">
								<Package size={14} style={{ display: 'inline', marginRight: 4 }} />
								Product Name <span className={styles.required}>*</span>
							</label>
							<input
								id="product-name"
								className="input-field"
								type="text"
								placeholder="e.g. Nike Air Max 2026"
								value={name}
								onChange={(e) => setName(e.target.value)}
								required
								disabled={submitting}
							/>
						</div>

						<div className={styles.twoCol}>
							<div className="input-group">
								<label htmlFor="product-price" className="input-label">
									<IndianRupee size={14} style={{ display: 'inline', marginRight: 4 }} />
									Price <span className={styles.required}>*</span>
								</label>
								<input
									id="product-price"
									className="input-field"
									type="number"
									placeholder="0.00"
									min="0.01"
									step="0.01"
									value={price}
									onChange={(e) => setPrice(e.target.value)}
									required
									disabled={submitting}
								/>
							</div>
							<div className="input-group">
								<label htmlFor="product-stock" className="input-label">
									<Layers size={14} style={{ display: 'inline', marginRight: 4 }} />
									Stock Quantity <span className={styles.required}>*</span>
								</label>
								<input
									id="product-stock"
									className="input-field"
									type="number"
									placeholder="0"
									min="0"
									step="1"
									value={stock}
									onChange={(e) => setStock(e.target.value)}
									required
									disabled={submitting}
								/>
							</div>
						</div>

						<div className="input-group">
							<label htmlFor="product-category" className="input-label">
								<Package size={14} style={{ display: 'inline', marginRight: 4 }} />
								Category <span className={styles.required}>*</span>
							</label>
							<select
								id="product-category"
								value={category}
								onChange={(e) => setCategory(e.target.value)}
								className={`${styles.categoryDropdown} input-field`}
								disabled={submitting}
							>
								<option value="">Select category</option>
								<option value="Mobile">Mobile</option>
								<option value="Accessories">Accessories</option>
								<option value="Electronics">Electronics</option>
								<option value="Fashion">Fashion</option>
								<option value="Wearables">Wearables</option>
							</select>
						</div>

						<div className="input-group">
							<label htmlFor="product-description" className="input-label">
								<FileText size={14} style={{ display: 'inline', marginRight: 4 }} />
								Description <span className={styles.optional}>(optional)</span>
							</label>
							<textarea
								id="product-description"
								className={`input-field ${styles.textarea}`}
								placeholder="Describe the product..."
								value={description}
								onChange={(e) => setDescription(e.target.value)}
								rows={4}
								disabled={submitting}
							/>
						</div>
					</div>

					<div className={styles.rightColumn}>
						<div className={styles.imageCard}>
							<div className={styles.imageCardHeader}>
								<div className={styles.imageCardTitle}>
									<ImageIcon size={16} />
									<span>Product Images</span>
									<span className={styles.imageCounter}>
										{images.length} / {MAX_IMAGES}
									</span>
								</div>
								{images.length > 0 && !submitting && (
									<button
										type="button"
										onClick={clearAllImages}
										className={styles.clearAllBtn}
										title="Clear all images"
									>
										Clear all
									</button>
								)}
							</div>

							{images.length === 0 ? (
								<div
									className={`${styles.dropZone} ${dragOver ? styles.dragOver : ''}`}
									onDragOver={(e) => {
										e.preventDefault();
										setDragOver(true);
									}}
									onDragLeave={() => setDragOver(false)}
									onDrop={handleDrop}
									onClick={() => fileInputRef.current?.click()}
									role="button"
									tabIndex={0}
									onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
								>
									<div className={styles.dropZoneIcon}>
										<Upload size={32} />
									</div>
									<p className={styles.dropZoneText}>
										Drag & drop or <span className={styles.dropZoneCta}>browse</span>
									</p>
									<p className={styles.dropZoneHint}>
										Select up to {MAX_IMAGES} images (JPG, PNG, WEBP, GIF · Max 10MB each)
									</p>
								</div>
							) : (
								<div>
									<div className={styles.previewGrid}>
										{images.map((item, index) => (
											<div key={item.id} className={styles.previewCard}>
												<img
													src={item.previewUrl}
													alt={`Preview ${index + 1}`}
													className={styles.previewThumb}
												/>
												{index === 0 && (
													<span className={styles.coverBadge}>
														<Star size={10} fill="#fbbf24" /> Cover
													</span>
												)}
												{!submitting && (
													<button
														type="button"
														className={styles.itemRemoveBtn}
														onClick={() => removeImage(item.id)}
														title="Remove this image"
													>
														<X size={12} />
													</button>
												)}
											</div>
										))}

										{images.length < MAX_IMAGES && !submitting && (
											<div
												className={styles.addMoreCard}
												onClick={() => fileInputRef.current?.click()}
												onDragOver={(e) => {
													e.preventDefault();
													setDragOver(true);
												}}
												onDragLeave={() => setDragOver(false)}
												onDrop={handleDrop}
												role="button"
												tabIndex={0}
												title="Add more images"
											>
												<Plus size={20} />
												<span>Add</span>
											</div>
										)}
									</div>

									{submitting && uploadProgress > 0 && uploadProgress < 100 && (
										<div className={styles.progressContainer}>
											<div className={styles.progressBar}>
												<div
													className={styles.progressFill}
													style={{ width: `${uploadProgress}%` }}
												/>
											</div>
											<div className={styles.progressText}>
												<span>Uploading...</span>
												<span>{uploadProgress}%</span>
											</div>
										</div>
									)}

									{uploadProgress === 100 && (
										<div className={styles.uploadDone}>
											<CheckCircle size={14} />
											Images Uploaded
										</div>
									)}
								</div>
							)}

							<input
								ref={fileInputRef}
								type="file"
								accept="image/jpeg,image/png,image/webp,image/gif"
								multiple
								onChange={handleFileInput}
								style={{ display: 'none' }}
								id="image-file-input"
							/>
						</div>

						{/* Submit */}
						<button
							type="submit"
							id="submit-product-btn"
							className={`btn btn-primary btn-full btn-lg ${styles.submitBtn}`}
							disabled={submitting}
						>
							{submitting ? (
								<>
									<span className="spinner" />
									{uploadProgress > 0 && uploadProgress < 100
										? `Uploading images... ${uploadProgress}%`
										: 'Creating product...'}
								</>
							) : (
								<>
									<Package size={18} />
									Create Product
								</>
							)}
						</button>

						<Link href="/" className={`btn btn-secondary btn-full ${styles.cancelBtn}`}>
							Cancel
						</Link>
					</div>
				</form>
			</div>
		</div>
	);
}
