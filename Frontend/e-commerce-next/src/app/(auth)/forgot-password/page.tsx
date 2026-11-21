'use client';

import React, { useEffect, useRef, useState, FormEvent, KeyboardEvent, ClipboardEvent } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Lock, Mail, Store } from 'lucide-react';
import toast from 'react-hot-toast';
import { resetPassword, sendPasswordResetOtp, verifyPasswordResetOtp } from '@/services/api';
import styles from '../auth.module.css';

type Step = 'email' | 'otp' | 'password' | 'success';

function getErrorMessage(error: unknown, fallback: string): string {
	if (error && typeof error === 'object' && 'response' in error) {
		const response = (error as { response?: { data?: { message?: string } } }).response;
		if (response?.data?.message) return response.data.message;
	}
	return fallback;
}

export default function ForgotPasswordPage() {
	const [step, setStep] = useState<Step>('email');
	const [email, setEmail] = useState('');
	const [otp, setOtp] = useState<string[]>(Array(6).fill(''));
	const [resetToken, setResetToken] = useState('');
	const [newPassword, setNewPassword] = useState('');
	const [confirmPassword, setConfirmPassword] = useState('');
	const [error, setError] = useState('');
	const [loading, setLoading] = useState(false);
	const [secondsLeft, setSecondsLeft] = useState(180);
	const otpRefs = useRef<Array<HTMLInputElement | null>>([]);

	useEffect(() => {
		if (step !== 'otp' || secondsLeft <= 0) return;
		const timer = window.setTimeout(() => setSecondsLeft((value) => value - 1), 1000);
		return () => window.clearTimeout(timer);
	}, [step, secondsLeft]);

	useEffect(() => {
		if (step === 'otp') otpRefs.current[0]?.focus();
	}, [step]);

	const sendOtp = async () => {
		const normalizedEmail = email.trim().toLowerCase();
		if (!normalizedEmail) {
			setError('Please enter your email address');
			return;
		}

		setLoading(true);
		setError('');
		try {
			const response = await sendPasswordResetOtp(normalizedEmail);
			if (!response.success) {
				setError(response.message || 'Unable to send OTP');
				return;
			}
			setEmail(normalizedEmail);
			setOtp(Array(6).fill(''));
			setSecondsLeft(180);
			setStep('otp');
			toast.success('OTP sent to your email');
		} catch (requestError) {
			setError(getErrorMessage(requestError, 'Unable to send OTP. Please try again.'));
		} finally {
			setLoading(false);
		}
	};

	const handleEmailSubmit = (event: FormEvent) => {
		event.preventDefault();
		void sendOtp();
	};

	const handleOtpChange = (index: number, value: string) => {
		const digit = value.replace(/\D/g, '').slice(-1);
		setOtp((current) => current.map((item, itemIndex) => itemIndex === index ? digit : item));
		if (digit && index < 5) otpRefs.current[index + 1]?.focus();
	};

	const handleOtpKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
		if (event.key === 'Backspace' && !otp[index] && index > 0) {
			otpRefs.current[index - 1]?.focus();
		}
	};

	const handleOtpPaste = (event: ClipboardEvent<HTMLInputElement>) => {
		event.preventDefault();
		const digits = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
		if (!digits) return;
		setOtp(Array(6).fill('').map((_, index) => digits[index] || ''));
		otpRefs.current[Math.min(digits.length, 6) - 1]?.focus();
	};

	const handleVerify = async (event: FormEvent) => {
		event.preventDefault();
		setError('');
		const code = otp.join('');
		if (!/^\d{6}$/.test(code)) {
			setError('Please enter the complete 6-digit OTP');
			return;
		}

		setLoading(true);
		try {
			const response = await verifyPasswordResetOtp(email, code);
			if (!response.success) {
				setError(response.message || 'OTP verification failed');
				return;
			}
			if (!response.resetToken) {
				setError('Reset authorization was not returned. Please try again.');
				return;
			}
			setResetToken(response.resetToken);
			setStep('password');
			toast.success('OTP verified');
		} catch (requestError) {
			setError(getErrorMessage(requestError, 'Unable to verify OTP. Please try again.'));
		} finally {
			setLoading(false);
		}
	};

	const formatTime = (seconds: number) =>
		`${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

	const handleResetPassword = async (event: FormEvent) => {
		event.preventDefault();
		setError('');
		if (newPassword.length < 8) {
			setError('Password must be at least 8 characters');
			return;
		}
		if (newPassword !== confirmPassword) {
			setError('Passwords do not match');
			return;
		}

		setLoading(true);
		try {
			const response = await resetPassword(resetToken, newPassword);
			if (!response.success) {
				setError(response.message || 'Unable to reset password');
				return;
			}
			setStep('success');
			toast.success('Password reset successfully');
		} catch (requestError) {
			setError(getErrorMessage(requestError, 'Unable to reset password. Please try again.'));
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className={styles['auth-page']}>
			<div className={styles['auth-container']}>
				<Link href="/login" className={styles['auth-back-link']}>
					<ArrowLeft size={16} />
					Back to Sign In
				</Link>

				<div className={styles['auth-card']}>
					<div className={styles['auth-header']}>
						<Link href="/" className={styles['auth-logo']}>
							<div className={styles['auth-logo-icon']}>
								<Store size={22} />
							</div>
							<span>ShopHub</span>
						</Link>
						<h1 className={styles['auth-title']}>
							{step === 'email'
								? 'Forgot Password?'
								: step === 'otp'
									? 'Enter Verification Code'
									: step === 'password'
										? 'Create New Password'
										: 'Password Reset'}
						</h1>
						<p className={styles['auth-subtitle']}>
							{step === 'email'
								? 'We’ll send a 6-digit code to your registered email'
								: step === 'otp'
									? 'Enter the code before it expires'
									: step === 'password'
										? 'Choose a strong password for your account'
										: 'Your password has been changed successfully'}
						</p>
					</div>

					{error && (
						<div className={styles['auth-error']} role="alert">
							{error}
						</div>
					)}

					{step === 'email' && (
						<form className={styles['auth-form']} onSubmit={handleEmailSubmit}>
							<div className="input-group">
								<label htmlFor="reset-email" className="input-label">Email Address</label>
								<div className={styles['auth-input-icon-wrapper']}>
									<Mail size={18} className={styles['auth-input-icon']} />
									<input
										id="reset-email"
										type="email"
										className={`input-field ${styles['auth-input']}`}
										placeholder="you@example.com"
										value={email}
										onChange={(event) => setEmail(event.target.value)}
										autoComplete="email"
										required
									/>
								</div>
							</div>

							<button
								type="submit"
								className={`btn btn-primary btn-full ${styles['auth-submit-btn']}`}
								disabled={loading}
							>
								{loading ? <span className="spinner" /> : 'Send OTP'}
							</button>
						</form>
					)}

					{step === 'otp' && (
						<form className={styles['auth-form']} onSubmit={handleVerify}>
							<p className={styles['otp-description']}>
								Code sent to <strong>{email}</strong>
							</p>
							<div className={styles['otp-inputs']} role="group" aria-label="6-digit OTP">
								{otp.map((digit, index) => (
									<input
										key={index}
										ref={(element) => { otpRefs.current[index] = element; }}
										className={styles['otp-input']}
										type="text"
										inputMode="numeric"
										pattern="[0-9]*"
										maxLength={1}
										value={digit}
										onChange={(event) => handleOtpChange(index, event.target.value)}
										onKeyDown={(event) => handleOtpKeyDown(index, event)}
										onPaste={handleOtpPaste}
										aria-label={`Digit ${index + 1}`}
										autoComplete={index === 0 ? 'one-time-code' : 'off'}
									/>
								))}
							</div>

							<button
								type="submit"
								className={`btn btn-primary btn-full ${styles['auth-submit-btn']}`}
								disabled={loading}
							>
								{loading ? <span className="spinner" /> : 'Verify OTP'}
							</button>

							<button
								type="button"
								className={styles['auth-secondary-action']}
								onClick={() => void sendOtp()}
								disabled={secondsLeft > 0 || loading}
							>
								{secondsLeft > 0 ? `Resend OTP in ${formatTime(secondsLeft)}` : 'Resend OTP'}
							</button>
						</form>
					)}

					{step === 'password' && (
						<form className={styles['auth-form']} onSubmit={handleResetPassword}>
							<div className="input-group">
								<label htmlFor="new-password" className="input-label">New Password</label>
								<div className={styles['auth-input-icon-wrapper']}>
									<Lock size={18} className={styles['auth-input-icon']} />
									<input
										id="new-password"
										type="password"
										className={`input-field ${styles['auth-input']}`}
										placeholder="Minimum 8 characters"
										value={newPassword}
										onChange={(event) => setNewPassword(event.target.value)}
										autoComplete="new-password"
										minLength={8}
										required
									/>
								</div>
							</div>

							<div className="input-group">
								<label htmlFor="confirm-password" className="input-label">Confirm New Password</label>
								<div className={styles['auth-input-icon-wrapper']}>
									<Lock size={18} className={styles['auth-input-icon']} />
									<input
										id="confirm-password"
										type="password"
										className={`input-field ${styles['auth-input']}`}
										placeholder="Re-enter your new password"
										value={confirmPassword}
										onChange={(event) => setConfirmPassword(event.target.value)}
										autoComplete="new-password"
										minLength={8}
										required
									/>
								</div>
							</div>

							<button
								type="submit"
								className={`btn btn-primary btn-full ${styles['auth-submit-btn']}`}
								disabled={loading}
							>
								{loading ? <span className="spinner" /> : 'Reset Password'}
							</button>
						</form>
					)}

					{step === 'success' && (
						<div className={styles['auth-success']}>
							<div className={styles['auth-success-icon']}><CheckCircle2 size={34} /></div>
							<p className={styles['otp-description']}>
								You can now sign in with your new password.
							</p>
							<Link href="/login" className={`btn btn-primary btn-full ${styles['auth-submit-btn']}`}>
								Sign In
							</Link>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
