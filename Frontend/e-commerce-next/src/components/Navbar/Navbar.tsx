'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShoppingCart, Package, Store, LogOut, User, ChevronDown, PlusSquare, LayoutDashboard, Menu, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import styles from './Navbar.module.css';

export default function Navbar() {
	const { user, logout, isAdminOrSeller } = useAuth();
	const { cartCount } = useCart();
	const pathname = usePathname();
	const [scrolled, setScrolled] = useState(false);
	const [dropdownOpen, setDropdownOpen] = useState(false);
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
	const dropdownRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const handleScroll = () => setScrolled(window.scrollY > 8);
		window.addEventListener('scroll', handleScroll, { passive: true });
		return () => window.removeEventListener('scroll', handleScroll);
	}, []);

	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
				setDropdownOpen(false);
			}
		};
		document.addEventListener('mousedown', handleClickOutside);
		return () => document.removeEventListener('mousedown', handleClickOutside);
	}, []);

	// Close dropdown on route change
	useEffect(() => {
		setDropdownOpen(false);
		setMobileMenuOpen(false);
	}, [pathname]);

	const navLinks = [
		{ href: '/', label: 'Shop', icon: Store },
		{ href: '/orders', label: 'My Orders', icon: Package },
		...(isAdminOrSeller ? [
			{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
			{ href: '/manage-orders', label: 'Orders', icon: Package },
		] : []),
	];

	if (pathname === '/login' || pathname === '/register') {
		return null;
	}

	return (
		<nav className={`${styles.navbar} ${pathname === '/' ? styles.homeNavbar : ''} ${scrolled ? styles.scrolled : ''}`}>
			<div className={styles['navbar-inner']}>
				<Link href="/" className={styles['navbar-logo']}>
					<div className={styles['navbar-logo-icon']}>
						<Store size={20} />
					</div>
					<span>ShopHub</span>
				</Link>

				{user && (
					<div
						id="mobile-navigation"
						className={`${styles['navbar-links']} ${mobileMenuOpen ? styles['mobile-menu-open'] : ''}`}
					>
						{navLinks.map((link) => (
							<Link
								key={link.href}
								href={link.href}
								className={`${styles['navbar-link']} ${pathname === link.href ? styles.active : ''}`}
							>
								<link.icon size={18} />
								{link.label}
							</Link>
						))}
					</div>
				)}

				<div className={styles['navbar-actions']}>
					{user ? (
						<>
							<Link href="/cart" className={styles['navbar-cart-btn']}>
								<ShoppingCart size={22} />
								{cartCount > 0 && (
									<span className={styles['navbar-cart-badge']}>{cartCount}</span>
								)}
							</Link>

							<div className={styles['navbar-dropdown-wrapper']} ref={dropdownRef}>
								<button
									className={styles['navbar-user-btn']}
									onClick={() => setDropdownOpen(!dropdownOpen)}
								>
									<div className={styles['navbar-user-avatar']}>
										<User size={14} />
									</div>
									<ChevronDown size={14} />
								</button>

								{dropdownOpen && (
									<div className={styles['navbar-dropdown']}>
										{isAdminOrSeller && (
											<>
												<Link href="/dashboard" className={styles['navbar-dropdown-item']}>
													<LayoutDashboard size={16} />
													Manage Inventory
												</Link>
												<Link href="/manage-orders" className={styles['navbar-dropdown-item']}>
													<Package size={16} />
													Manage Orders
												</Link>
												<Link href="/addProducts" className={styles['navbar-dropdown-item']}>
													<PlusSquare size={16} />
													Add Product
												</Link>
												<div className={styles['navbar-dropdown-divider']} />
											</>
										)}
										<Link href="/orders" className={styles['navbar-dropdown-item']}>
											<Package size={16} />
											My Orders
										</Link>
										<div className={styles['navbar-dropdown-divider']} />
										<button
											className={`${styles['navbar-dropdown-item']} ${styles.danger}`}
											onClick={logout}
										>
											<LogOut size={16} />
											Sign Out
										</button>
									</div>
								)}
							</div>
						</>
					) : (
						<Link href="/login" className="btn btn-primary">
							Sign In
						</Link>
					)}
				</div>

				{user && (
					<button
						type="button"
						className={styles['navbar-menu-toggle']}
						aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
						aria-expanded={mobileMenuOpen}
						aria-controls="mobile-navigation"
						onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
					>
						{mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
					</button>
				)}
			</div>
		</nav>
	);
}
