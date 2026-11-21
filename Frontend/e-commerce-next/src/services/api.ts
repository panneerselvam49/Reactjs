import axios from 'axios';
import type { CartItem, Product, ProductsResponse, SearchProductsResponse, LoginResponse, ApiResponse, ManagedOrder, Order, ProductReview, ProductReviewSummary } from '@/types';

const API_BASE_URL = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api`;

const api = axios.create({
	baseURL: API_BASE_URL,
	withCredentials: true,
	headers: {
		'Content-Type': 'application/json',
	},
});

let refreshPromise: Promise<string> | null = null;

api.interceptors.request.use((config) => {
	if (typeof window !== 'undefined') {
		const token = localStorage.getItem('token');
		if (token && !config.headers.Authorization) {
			config.headers.Authorization = `Bearer ${token}`;
		}
	}
	return config;
});

api.interceptors.response.use(
	(response) => response,
	async (error: unknown) => {
		if (!axios.isAxiosError(error)) {
			return Promise.reject(error);
		}

		const originalRequest = error.config as (typeof error.config & { _retry?: boolean }) | undefined;
		const isRefreshRequest = originalRequest?.url?.endsWith('/user/refreshToken') ?? false;
		const isLoginRequest = originalRequest?.url?.endsWith('/user/loginUser') ?? false;
		const isGoogleLoginRequest = originalRequest?.url?.endsWith('/user/googleLogin') ?? false;
		const isRegistrationRequest = originalRequest?.url?.endsWith('/user/registerUser') ?? false;
		const isPasswordResetRequest =
			originalRequest?.url?.endsWith('/user/forgotPassword')
			|| originalRequest?.url?.endsWith('/user/verifyOtp')
			|| originalRequest?.url?.endsWith('/user/changePassword');
		const hasAccessToken = typeof window !== 'undefined' && Boolean(localStorage.getItem('token'));

		if (
			error.response?.status !== 401
			|| !originalRequest
			|| originalRequest._retry
			|| isRefreshRequest
			|| isLoginRequest
			|| isGoogleLoginRequest
			|| isRegistrationRequest
			|| isPasswordResetRequest
			|| !hasAccessToken
		) {
			return Promise.reject(error);
		}

		originalRequest._retry = true;
		refreshPromise ??= api.post<{ token: string }>('/user/refreshToken')
			.then((response) => {
				if (typeof window !== 'undefined') {
					localStorage.setItem('token', response.data.token);
					window.dispatchEvent(new CustomEvent('auth:token-refreshed', {
						detail: response.data.token,
					}));
				}
				return response.data.token;
			})
			.finally(() => {
				refreshPromise = null;
			});

		try {
			const token = await refreshPromise;
			originalRequest.headers.Authorization = `Bearer ${token}`;
			return api(originalRequest);
		} catch (refreshError: unknown) {
			if (typeof window !== 'undefined') {
				localStorage.removeItem('token');
				window.dispatchEvent(new Event('auth:logout'));
			}
			return Promise.reject(refreshError);
		}
	},
);

export const registerUser = async (data: {
	name: string;
	email: string;
	password: string;
	mobileNumber: number;
}): Promise<ApiResponse> => {
	const res = await api.post('/user/registerUser', data);
	return res.data;
};

export const loginUser = async (data: {
	email: string;
	password: string;
}): Promise<LoginResponse> => {
	const res = await api.post('/user/loginUser', data);
	return res.data;
};

export const loginWithGoogle = async (credential: string): Promise<LoginResponse> => {
	const res = await api.post('/user/googleLogin', { credential });
	return res.data;
};

export const sendPasswordResetOtp = async (email: string): Promise<ApiResponse> => {
	const res = await api.post('/user/forgotPassword', { email });
	return res.data;
};

export const verifyPasswordResetOtp = async (
	email: string,
	otp: string,
): Promise<ApiResponse & { resetToken?: string }> => {
	const res = await api.post('/user/verifyOtp', { email, otp });
	return res.data;
};

export const resetPassword = async (
	resetToken: string,
	newPassword: string,
): Promise<ApiResponse> => {
	const res = await api.put('/user/changePassword', { newPassword }, {
		headers: { Authorization: `Bearer ${resetToken}` },
	});
	return res.data;
};

export const logoutUser = async (): Promise<ApiResponse> => {
	const res = await api.post('/user/logout');
	return res.data;
};

export const getProducts = async (
	page: number = 1,
	limit: number = 12
): Promise<ProductsResponse> => {
	const res = await api.get('/product/getProducts', {
		params: { page, limit },
	});
	return res.data;
};

export const searchProducts = async (productName: string): Promise<SearchProductsResponse> => {
	const res = await api.get('/product/searchProducts', {
		params: { productName },
	});
	return res.data;
};

export const getManagedProducts = async (): Promise<{
	success: boolean;
	productCreatedBySeller?: Product[];
	allProducts?: Product[];
}> => {
	const res = await api.get('/product/getAllProducts');
	return res.data;
};

export const deleteManagedProduct = async (productId: number): Promise<ApiResponse> => {
	const res = await api.delete(`/product/deleteProduct/${productId}`);
	return res.data;
};

export interface UpdateManagedProductPayload {
	productName: string;
	stock: number;
	price: number;
	category: string;
	description: string;
	images: string[];
	productStatus: boolean;
}

export const updateManagedProduct = async (
	productId: number,
	payload: UpdateManagedProductPayload
): Promise<ApiResponse> => {
	const res = await api.put(`/product/updateProduct/${productId}`, payload);
	return res.data;
};

export const getProductById = async (productId: number): Promise<Product> => {
	const res = await api.get(`/product/getProductById/${productId}`);
	return res.data;
};

export const getProductReviews = async (productId: number): Promise<{
	success: boolean;
	reviews: ProductReview[];
	summary: ProductReviewSummary;
}> => {
	const res = await api.get(`/product/getProductReviews/${productId}`);
	return res.data;
};

export const submitProductReview = async (
	productId: number,
	data: { rating: number; comment?: string },
): Promise<ApiResponse & { review?: ProductReview }> => {
	const res = await api.post(`/product/reviewProduct/${productId}`, data);
	return res.data;
};

export const addToCart = async (data: {
	userId: number;
	productId: number;
	quantity: number;
}): Promise<ApiResponse> => {
	const res = await api.post('/cart/addToCart', data);
	return res.data;
};

export const getCartItems = async (): Promise<{
	success: boolean;
	message?: string;
	cartItems?: CartItem[];
}> => {
	const res = await api.get('/cart/getCartItems');
	return res.data;
};

export const removeFromCart = async (data: {
	userId: number;
	cartId: number;
	quantity: number;
}): Promise<ApiResponse> => {
	const res = await api.put('/cart/removeFromCart', data);
	return res.data;
};

export const placeOrder = async (data: {
	userId: number;
	address: string;
	items: { productId: number; quantity: number }[];
}): Promise<ApiResponse> => {
	const res = await api.post('/order/placeOrder', data);
	return res.data;
};

export const getOrders = async (): Promise<{ success: boolean; orders: Order[] }> => {
	const res = await api.get('/order/getOrders');
	return res.data;
};

export const getManagedOrders = async (): Promise<{
	success: boolean;
	orders: ManagedOrder[];
	message?: string;
}> => {
	const res = await api.get('/order/getAllProducts');
	return res.data;
};

export const cancelOrder = async (
	orderId: number,
	userId: number
): Promise<ApiResponse> => {
	const res = await api.patch(`/order/cancelOrder/${orderId}`, { userId });
	return res.data;
};

export const updateOrderStatus = async (
	orderId: number,
	status: 'shipped' | 'delivered',
): Promise<ApiResponse> => {
	const res = await api.patch(`/order/updateStatus/${orderId}`, { status });
	return res.data;
};

export default api;
