'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import type { Product } from '@/types';

export interface LocalCartItem {
	product: Product;
	quantity: number;
	cartId?: number;
}

interface CartContextType {
	items: LocalCartItem[];
	addItem: (product: Product, quantity?: number) => void;
	setItemsFromServer: (items: LocalCartItem[]) => void;
	directBuyItem: LocalCartItem | null;
	setDirectBuyItem: (item: LocalCartItem | null) => void;
	removeItem: (productId: number) => void;
	updateQuantity: (productId: number, quantity: number) => void;
	clearCart: () => void;
	setCartCount: (count: number) => void;
	cartCount: number;
	totalItems: number;
	totalPrice: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
	const [items, setItems] = useState<LocalCartItem[]>([]);
	const [cartCount, setCartCount] = useState(0);
	const [directBuyItem, setDirectBuyItem] = useState<LocalCartItem | null>(null);

	const addItem = useCallback((product: Product, quantity: number = 1) => {
		setItems((prev) => {
			const existing = prev.find((item) => item.product.id === product.id);
			if (existing) {
				return prev.map((item) =>
					item.product.id === product.id
						? { ...item, quantity: item.quantity + quantity }
						: item
				);
			}
			setCartCount((count) => count + 1);
			return [...prev, { product, quantity }];
		});
	}, []);

	const setItemsFromServer = useCallback((serverItems: LocalCartItem[]) => {
		setItems(serverItems);
		setCartCount(serverItems.length);
	}, []);

	const removeItem = useCallback((productId: number) => {
		setItems((prev) => prev.filter((item) => item.product.id !== productId));
		setCartCount((count) => Math.max(0, count - 1));
	}, []);

	const updateQuantity = useCallback((productId: number, quantity: number) => {
		if (quantity <= 0) {
			setItems((prev) => prev.filter((item) => item.product.id !== productId));
			return;
		}
		setItems((prev) =>
			prev.map((item) =>
				item.product.id === productId ? { ...item, quantity } : item
			)
		);
	}, []);

	const clearCart = useCallback(() => {
		setItems([]);
		setCartCount(0);
	}, []);

	const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
	const totalPrice = items.reduce(
		(sum, item) => sum + Number(item.product.price) * item.quantity,
		0
	);

	return (
		<CartContext.Provider
			value={{
				items,
				addItem,
				setItemsFromServer,
				directBuyItem,
				setDirectBuyItem,
				removeItem,
				updateQuantity,
				clearCart,
				setCartCount,
				cartCount,
				totalItems,
				totalPrice,
			}}
		>
			{children}
		</CartContext.Provider>
	);
}

export function useCart(): CartContextType {
	const context = useContext(CartContext);
	if (context === undefined) {
		throw new Error('useCart must be used within a CartProvider');
	}
	return context;
}
