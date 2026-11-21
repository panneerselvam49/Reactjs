'use client';

import React, { useState, useEffect, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mail, Lock, Store, AlertCircle, ArrowLeft } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';
import styles from '../auth.module.css';

export default function LoginPage() {
	const router = useRouter();
	const { login, loginWithGoogle, user } = useAuth();
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [error, setError] = useState('');
	const [loading, setLoading] = useState(false);

	// Redirect if already logged in
	useEffect(() => {
		if (user) {
			router.replace('/');
		}
	}, [user, router]);

	if (user) {
		return null;
	}

	const handleSubmit = async (e: FormEvent) => {
		e.preventDefault();
		setError('');

		if (!email || !password) {
			setError('Please fill in all fields');
			return;
		}

		setLoading(true);
		try {
			const res = await login(email, password);
			if (res.success) {
				toast.success('Welcome back! 🎉');
				router.push('/');
			} else {
				setError(res.message || 'Login failed');
			}
		} catch (err: unknown) {
			const message =
				err && typeof err === 'object' && 'response' in err
					? (err as { response: { data: { message: string } } }).response?.data?.message
					: 'Something went wrong. Please try again.';
			setError(message);
		} finally {
			setLoading(false);
		}
	};

	const handleGoogleLogin = async (credential: string) => {
		setError('');
		setLoading(true);
		try {
			const res = await loginWithGoogle(credential);
			if (res.success) {
				toast.success('Welcome back! 🎉');
				router.push('/');
			} else {
				setError(res.message || 'Google login failed');
			}
		} catch {
			setError('Unable to sign in with Google. Please try again.');
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className={styles['auth-page']}>
			<div className={styles['auth-container']}>
				<Link href="/" className={styles['auth-back-link']}>
					<ArrowLeft size={16} />
					Back to Shop
				</Link>

				<div className={styles['auth-card']}>
					<div className={styles['auth-header']}>
						<Link href="/" className={styles['auth-logo']}>
							<div className={styles['auth-logo-icon']}>
								<Store size={22} />
							</div>
							<span>ShopHub</span>
						</Link>
						<h1 className={styles['auth-title']}>Welcome Back!</h1>
						<p className={styles['auth-subtitle']}>Sign in to your account to continue shopping</p>
					</div>

					{error && (
						<div className={styles['auth-error']}>
							<AlertCircle size={16} />
							{error}
						</div>
					)}

					<form className={styles['auth-form']} onSubmit={handleSubmit}>
						<div className="input-group">
							<label htmlFor="email" className="input-label">Email Address</label>
							<div className={styles['auth-input-icon-wrapper']}>
								<Mail size={18} className={styles['auth-input-icon']} />
								<input
									id="email"
									type="email"
									className={`input-field ${styles['auth-input']}`}
									placeholder="you@example.com"
									value={email}
									onChange={(e) => setEmail(e.target.value)}
									autoComplete="email"
								/>
							</div>
						</div>

						<div className="input-group">
							<label htmlFor="password" className="input-label">Password</label>
							<div className={styles['auth-input-icon-wrapper']}>
								<Lock size={18} className={styles['auth-input-icon']} />
								<input
									id="password"
									type="password"
									className={`input-field ${styles['auth-input']}`}
									placeholder="Enter your password"
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									autoComplete="current-password"
								/>
							</div>
						</div>

						<div className={styles['auth-options']}>
							<Link href="/forgot-password" className={styles['auth-forgot-link']}>
								Forgot password?
							</Link>
						</div>

						<button
							type="submit"
							className={`btn btn-primary btn-full ${styles['auth-submit-btn']}`}
							disabled={loading}
						>
							{loading ? <span className="spinner" /> : 'Sign In'}
						</button>
					</form>

					<div className={styles['auth-divider']}><span>OR</span></div>
					<div className={styles['google-login']}>
						<GoogleLogin
							onSuccess={({ credential }) => {
								if (credential) void handleGoogleLogin(credential);
								else setError('Google did not return a credential');
							}}
							onError={() => setError('Unable to sign in with Google. Please try again.')}
							useOneTap={false}
						/>
					</div>

					<p className={styles['auth-footer']}>
						Don&apos;t have an account?{' '}
						<Link href="/register">Create one</Link>
					</p>
				</div>
			</div>
		</div>
	);
}
