'use client';

import React, { useState, useEffect, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mail, Lock, Store, AlertCircle, User, Phone, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';
import styles from '../auth.module.css';

export default function RegisterPage() {
	const router = useRouter();
	const { register, user } = useAuth();
	const [name, setName] = useState('');
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [mobileNumber, setMobileNumber] = useState('');
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

		if (!name || !email || !password || !mobileNumber) {
			setError('Please fill in all fields');
			return;
		}

		if (password.length < 6) {
			setError('Password must be at least 6 characters');
			return;
		}

		setLoading(true);
		try {
			const res = await register(name, email, password, Number(mobileNumber));
			if (res.success) {
				toast.success('Account created! Please sign in.');
				router.push('/login');
			} else {
				setError(res.message || 'Registration failed');
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
						<h1 className={styles['auth-title']}>Create Account</h1>
						<p className={styles['auth-subtitle']}>Join ShopHub and start shopping today</p>
					</div>

					{error && (
						<div className={styles['auth-error']}>
							<AlertCircle size={16} />
							{error}
						</div>
					)}

					<form className={styles['auth-form']} onSubmit={handleSubmit}>
						<div className="input-group">
							<label htmlFor="name" className="input-label">Full Name</label>
							<div className={styles['auth-input-icon-wrapper']}>
								<User size={18} className={styles['auth-input-icon']} />
								<input
									id="name"
									type="text"
									className={`input-field ${styles['auth-input']}`}
									placeholder="John Doe"
									value={name}
									onChange={(e) => setName(e.target.value)}
									autoComplete="name"
								/>
							</div>
						</div>

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
							<label htmlFor="mobile" className="input-label">Mobile Number</label>
							<div className={styles['auth-input-icon-wrapper']}>
								<Phone size={18} className={styles['auth-input-icon']} />
								<input
									id="mobile"
									type="tel"
									className={`input-field ${styles['auth-input']}`}
									placeholder="9876543210"
									min={10}
									max={10}
									value={mobileNumber}
									onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, ''))}
									autoComplete="tel"
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
									placeholder="Minimum 6 characters"
									value={password}
									min={6}
									onChange={(e) => setPassword(e.target.value)}
									autoComplete="new-password"
								/>
							</div>
						</div>

						<button
							type="submit"
							className={`btn btn-primary btn-full ${styles['auth-submit-btn']}`}
							disabled={loading}
						>
							{loading ? <span className="spinner" /> : 'Create Account'}
						</button>
					</form>

					<p className={styles['auth-footer']}>
						Already have an account?{' '}
						<Link href="/login">Sign in</Link>
					</p>
				</div>
			</div>
		</div>
	);
}
