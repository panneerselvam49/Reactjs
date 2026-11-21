'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { loginUser as apiLogin, loginWithGoogle as apiGoogleLogin, registerUser as apiRegister, logoutUser } from '@/services/api';
import type { LoginResponse, ApiResponse } from '@/types';

interface AuthUser {
	id: number;
	token: string;
	role: string;
}

interface AuthContextType {
	user: AuthUser | null;
	isLoading: boolean;
	isAdminOrSeller: boolean;
	login: (email: string, password: string) => Promise<LoginResponse>;
	loginWithGoogle: (credential: string) => Promise<LoginResponse>;
	register: (name: string, email: string, password: string, mobileNumber: number) => Promise<ApiResponse>;
	logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function parseJwt(token: string): { id: number; role: string } | null {
	try {
		const base64Url = token.split('.')[1];
		const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
		const jsonPayload = decodeURIComponent(
			atob(base64)
				.split('')
				.map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
				.join('')
		);
		return JSON.parse(jsonPayload);
	} catch {
		return null;
	}
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
	const [user, setUser] = useState<AuthUser | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	const isAdminOrSeller = user?.role === 'admin' || user?.role === 'seller';

	useEffect(() => {
		const token = localStorage.getItem('token');
		if (token) {
			const payload = parseJwt(token);
			if (payload?.id) {
				setUser({ id: payload.id, token, role: payload.role ?? 'user' });
			}
		}
		setIsLoading(false);
	}, []);

	useEffect(() => {
		const handleTokenRefreshed = (event: Event) => {
			const token = (event as CustomEvent<string>).detail;
			const payload = typeof token === 'string' ? parseJwt(token) : null;
			if (payload?.id) {
				setUser({ id: payload.id, token, role: payload.role ?? 'user' });
			}
		};
		const handleLogout = () => setUser(null);

		window.addEventListener('auth:token-refreshed', handleTokenRefreshed);
		window.addEventListener('auth:logout', handleLogout);
		return () => {
			window.removeEventListener('auth:token-refreshed', handleTokenRefreshed);
			window.removeEventListener('auth:logout', handleLogout);
		};
	}, []);

	const login = useCallback(async (email: string, password: string): Promise<LoginResponse> => {
		const response = await apiLogin({ email, password });
		if (response.success && response.token) {
			localStorage.setItem('token', response.token);
			const payload = parseJwt(response.token);
			if (payload?.id) {
				setUser({ id: payload.id, token: response.token, role: payload.role ?? 'user' });
			}
		}
		return response;
	}, []);

	const register = useCallback(async (
		name: string,
		email: string,
		password: string,
		mobileNumber: number
	): Promise<ApiResponse> => {
		const response = await apiRegister({ name, email, password, mobileNumber });
		return response;
	}, []);

	const loginWithGoogle = useCallback(async (credential: string): Promise<LoginResponse> => {
		const response = await apiGoogleLogin(credential);
		if (response.success && response.token) {
			localStorage.setItem('token', response.token);
			const payload = parseJwt(response.token);
			if (payload?.id) {
				setUser({ id: payload.id, token: response.token, role: payload.role ?? 'user' });
			}
		}
		return response;
	}, []);

	const logout = useCallback(() => {
		void logoutUser().catch((error: unknown) => {
			console.error('Failed to log out:', error);
		});
		localStorage.removeItem('token');
		setUser(null);
	}, []);

	return (
		<AuthContext.Provider value={{ user, isLoading, isAdminOrSeller, login, loginWithGoogle, register, logout }}>
			{children}
		</AuthContext.Provider>
	);
}

export function useAuth(): AuthContextType {
	const context = useContext(AuthContext);
	if (context === undefined) {
		throw new Error('useAuth must be used within an AuthProvider');
	}
	return context;
}
