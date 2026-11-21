'use client';

import React from 'react';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '@/context/AuthContext';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { CartProvider } from '@/context/CartContext';
import Navbar from '@/components/Navbar/Navbar';

export default function ClientProviders({ children }: { children: React.ReactNode }) {
	return (
		<GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''}>
			<AuthProvider>
				<CartProvider>
					<Navbar />
					<Toaster
						position="top-right"
						toastOptions={{
							duration: 3000,
							style: {
								fontFamily: 'var(--font-family)',
								fontSize: 'var(--font-size-sm)',
								borderRadius: 'var(--radius-lg)',
								boxShadow: 'var(--shadow-lg)',
								padding: '12px 16px',
							},
							success: {
								iconTheme: { primary: '#16A34A', secondary: '#FFFFFF' },
							},
							error: {
								iconTheme: { primary: '#DC2626', secondary: '#FFFFFF' },
							},
						}}
					/>
					{children}
				</CartProvider>
			</AuthProvider>
		</GoogleOAuthProvider>
	);
}
