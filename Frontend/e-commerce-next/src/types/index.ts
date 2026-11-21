export interface User {
	id: number;
	name: string;
	email: string;
	mobileNumber: number;
	otherDetails?: Record<string, unknown>;
	createdAt: string;
	updatedAt: string;
}

export interface Product {
	id: number;
	name: string;
	price: number;
	description: string | null;
	isAvailableToBuy: boolean;
	stock: number;
	createdBy?: string;
	category?: string;
	images?: string[];
	createdAt: string;
	updatedAt: string;
}

export interface ProductReview {
	id: number;
	productId: number;
	userId: number;
	rating: number;
	comment?: string | null;
	user?: Pick<User, 'id' | 'name'>;
	createdAt: string;
	updatedAt: string;
}

export interface ProductReviewSummary {
	averageRating: number;
	ratingCount: number;
	ratingBreakdown: Record<string, number>;
}

export interface ProductsResponse {
	product: Product[];
	totalCartItems: number;
}

export type SearchProductsResponse = ProductsResponse;

export interface CartItem {
	id: number;
	userId: number;
	productId: number;
	quantity: number;
	product?: Product;
	createdAt: string;
	updatedAt: string;
}

export interface OrderItemType {
	id: number;
	orderId: number;
	productId: number | null;
	quantity: number;
	unitPrice: number;
	product?: Pick<Product, 'id' | 'name' | 'price' | 'images'> | null;
	createdAt: string;
	updatedAt: string;
}

export interface Order {
	id: number;
	userId: number;
	totalAmount: number;
	status: 'ordered' | 'shipped' | 'delivered' | 'cancelled';
	address: string;
	orderedAt?: string;
	shippedAt?: string | null;
	deliveredAt?: string | null;
	cancelledAt?: string | null;
	items?: OrderItemType[];
	createdAt: string;
	updatedAt: string;
}

export interface ManagedOrder extends Order {
	items: OrderItemType[];
}

export interface ApiResponse<T = unknown> {
	success: boolean;
	message: string;
	data?: T;
}

export interface LoginResponse {
	success: boolean;
	message: string;
	token: string;
}

export interface addToCart {
	userId: number;
	productId: number;
	quantity: number;
}
