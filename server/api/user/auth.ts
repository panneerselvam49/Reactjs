import type { Request, Response } from 'express';
import db from '../../config/db.ts';
import User from '../../models/user.ts';
import bcrypt from 'bcrypt';
import { Op } from 'sequelize';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import crypto from 'node:crypto';
import RefreshToken from '../../models/refreshToken.ts';
import mailer from "../../config/mailer.ts";
import redis from "../../config/redis.ts";

const REFRESH_COOKIE = 'refreshToken';
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function getRefreshCookieSameSite(): 'lax' | 'strict' | 'none' {
	const configured = process.env.REFRESH_COOKIE_SAME_SITE?.toLowerCase();
	if (configured === 'strict' || configured === 'none') return configured;
	return process.env.NODE_ENV === 'production' ? 'none' : 'lax';
}

interface UserRecord {
	id: number;
	name: string;
	role: string;
	password: string;
}

function toUserRecord(user: { get: (options: { plain: true }) => unknown }): UserRecord {
	return user.get({ plain: true }) as UserRecord;
}

function getJwtSecret(): string {
	if (!process.env.secret) {
		throw new Error('JWT secret is not configured');
	}
	return process.env.secret;
}

function hashRefreshToken(token: string): string {
	return crypto.createHash('sha256').update(token).digest('hex');
}

function getRefreshTokenCookie(req: Request): string | undefined {
	const cookies = req.headers.cookie?.split(';') ?? [];
	const cookie = cookies.find((entry) => entry.trim().startsWith(`${REFRESH_COOKIE}=`));
	return cookie ? decodeURIComponent(cookie.trim().slice(REFRESH_COOKIE.length + 1)) : undefined;
}

function setRefreshTokenCookie(res: Response, token: string): void {
	const sameSite = getRefreshCookieSameSite();
	res.cookie(REFRESH_COOKIE, token, {
		httpOnly: true,
		secure: sameSite === 'none' || process.env.NODE_ENV === 'production',
		sameSite,
		maxAge: REFRESH_TOKEN_TTL_MS,
		path: '/api/user',
	});
}

function clearRefreshTokenCookie(res: Response): void {
	const sameSite = getRefreshCookieSameSite();
	res.clearCookie(REFRESH_COOKIE, {
		httpOnly: true,
		secure: sameSite === 'none' || process.env.NODE_ENV === 'production',
		sameSite,
		path: '/api/user',
	});
}

async function createTokens(userRecord: UserRecord): Promise<{ accessToken: string; refreshToken: string }> {
	const accessToken = jwt.sign(
		{ id: userRecord.id, role: userRecord.role, name: userRecord.name },
		getJwtSecret(),
		{ expiresIn: '15m' }
	);
	const refreshToken = crypto.randomBytes(64).toString('base64url');

	await RefreshToken.create({
		userId: userRecord.id,
		tokenHash: hashRefreshToken(refreshToken),
		expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
	});

	return { accessToken, refreshToken };
}

export async function register(req: Request, res: Response): Promise<void> {
	try {
		const { email, password, name, mobileNumber } = req.body;

		if (!email || !password || !name || !mobileNumber) {
			res.status(400).json({ success: false, message: 'Details are missing' });
			return;
		}

		const existingUser = await User.findOne({ attributes: [ 'id', 'name', 'email', 'password'],  where: { [Op.or]: [{email: email}, {name: name}] } });

		if (existingUser) {
			res.status(409).json({ success: false, message: 'User already exists' });
			return;
		}

		const hashPassword = await bcrypt.hash(password, 12);

		await db.transaction(async (transaction) => User.create({
			name,
			email,
			mobileNumber,
			password: hashPassword,
		}, { transaction }));

		res.status(201).json({ success: true, message: "User registered successfully" });
	} catch (err) {
		console.error('Failed to register user:', err);
		res.status(500).json({ success: false, message: 'Unable to register user' });
	}
}

export async function login(req: Request, res: Response): Promise<void> {
	try {
		const {email, password} = req.body;

		if (!email || !password) {
			res.status(400).json({ success: false, message: 'Email or password is missing' });
			return;
		}

		const user = await User.findOne({ where: { email } });

		if (!user) {
			res.status(401).json({ success: false, message: 'Invalid email or password' });
			return;
		}

		const userRecord = toUserRecord(user);
		const isMatch = await bcrypt.compare(password, userRecord.password);

		if (!isMatch) {
			res.status(401).json({ success: false, message: 'Invalid email or password' });
			return;
		}

		const { accessToken, refreshToken } = await createTokens(userRecord);
		setRefreshTokenCookie(res, refreshToken);

		res.status(200).json({ success: true, message: 'User logged in successfully', token: accessToken });
	} catch (err) {
		console.error('Failed to login user:', err);
		res.status(500).json({ success: false, message: 'Unable to login user' });
	}
}

export async function googleLogin(req: Request, res: Response): Promise<void> {
	try {
		const { credential } = req.body;

		if (!credential || !process.env.GOOGLE_CLIENT_ID) {
			res.status(400).json({ success: false, message: 'Google authentication is not configured' });
			return;
		}

		const ticket = await new OAuth2Client(process.env.GOOGLE_CLIENT_ID).verifyIdToken({
			idToken: credential,
			audience: process.env.GOOGLE_CLIENT_ID,
		});
		const payload = ticket.getPayload();

		if (!payload?.sub || !payload.email || payload.email_verified !== true) {
			res.status(401).json({ success: false, message: 'Google account could not be verified' });
			return;
		}

		let user = await User.findOne({ where: { email: payload.email } });

		if (!user) {
			const baseName = payload.name?.trim() || 'Google User';
			let name = baseName;
			let suffix = 1;
			while (await User.findOne({ where: { name } })) {
				name = `${baseName} ${suffix}`;
				suffix += 1;
			}

			user = await User.create({
				name,
				email: payload.email,
				mobileNumber: `google:${payload.sub}`, // Consider google ID as mobile number to overcome on unique and required constraints
				password: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12),
				otherDetails: { googleId: payload.sub, picture: payload.picture },
			});
		}

		const userRecord = toUserRecord(user);
		const { accessToken, refreshToken } = await createTokens(userRecord);
		setRefreshTokenCookie(res, refreshToken);

		res.status(200).json({ success: true, message: 'Google login successful', token: accessToken });
	} catch (err) {
		console.error('Failed to login with Google:', err);
		res.status(401).json({ success: false, message: 'Unable to authenticate with Google' });
	}
}

export async function refresh(req: Request, res: Response): Promise<void> {
	try {
		const rawToken = getRefreshTokenCookie(req);
		if (!rawToken) {
			res.status(401).json({ success: false, message: 'Refresh token is missing' });
			return;
		}

		const storedToken = await RefreshToken.findOne({
			where: { tokenHash: hashRefreshToken(rawToken) },
		});
		if (!storedToken || new Date(storedToken.getDataValue('expiresAt')) <= new Date()) {
			clearRefreshTokenCookie(res);
			res.status(401).json({ success: false, message: 'Refresh token is invalid or expired' });
			return;
		}

		const user = await User.findByPk(storedToken.getDataValue('userId'));
		if (!user) {
			clearRefreshTokenCookie(res);
			res.status(401).json({ success: false, message: 'User not found' });
			return;
		}

		const userRecord = toUserRecord(user);
		const tokens = await db.transaction(async (transaction) => {
			await storedToken.destroy({ transaction });
			const refreshToken = crypto.randomBytes(64).toString('base64url');
			await RefreshToken.create({
				userId: userRecord.id,
				tokenHash: hashRefreshToken(refreshToken),
				expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
			}, { transaction });
			const accessToken = jwt.sign(
				{ id: userRecord.id, role: userRecord.role, name: userRecord.name },
				getJwtSecret(),
				{ expiresIn: '15m' }
			);
			return { accessToken, refreshToken };
		});

		setRefreshTokenCookie(res, tokens.refreshToken);
		res.status(200).json({ success: true, message: 'Token refreshed successfully', token: tokens.accessToken });
	} catch (err) {
		console.error('Failed to refresh token:', err);
		res.status(500).json({ success: false, message: 'Unable to refresh token' });
	}
}

export async function logout(req: Request, res: Response): Promise<void> {
	try {
		const rawToken = getRefreshTokenCookie(req);
		if (rawToken) {
			await RefreshToken.destroy({ where: { tokenHash: hashRefreshToken(rawToken) } });
		}
		clearRefreshTokenCookie(res);
		res.status(200).json({ success: true, message: 'Logged out successfully' });
	} catch (err) {
		console.error('Failed to log out:', err);
		res.status(500).json({ success: false, message: 'Unable to log out' });
	}
}

export async function changePassword(req: Request, res: Response): Promise<void> {
	try {
		const userId = res.locals.userId;
		const isPasswordReset = res.locals.resetPassword === true;
		const { oldPassword, newPassword } = req.body;

		if (!newPassword) {
			res.status(400).json({ success: false, message: "Missing details" });
			return;
		}

		if (!isPasswordReset && (!userId || !oldPassword)) {
			res.status(400).json({ success: false, message: "Missing details" });
			return;
		}

		if (String(newPassword).length < 8) {
			res.status(400).json({ success: false, message: "Password should be at least 8 characters long" });
			return;
		}

		const user = await User.findByPk(userId);
		if (!user) {
			res.status(401).json({ success: false, message: "User not found" });
			return;
		}

		const existingPassword = user.getDataValue('password');
		const isSameAsOldPassword = await bcrypt.compare(newPassword, existingPassword);
		if (!isPasswordReset) {
			const passwordMatch = await bcrypt.compare(oldPassword, existingPassword);
			if (!passwordMatch) {
				res.status(401).json({ success: false, message: "Current password is incorrect" });
				return;
			}
		}

		if (isSameAsOldPassword) {
			res.status(401).json({ success: false, message: "Current password and new password cannot be same please change the new password" });
			return;
		}

		const newHashedPassword = await bcrypt.hash(newPassword, 12);

		await db.transaction(async (t) => {
			await User.update({
				password: newHashedPassword,
			}, {
				where: { id: userId },
				transaction: t,
			});
			res.status(200).json({ success: true, message: 'Password changed successfully' });
		});
	} catch (err) {
		console.error('Failed to change password:', err);
		res.status(500).json({ success: false, message: 'Unable to change password' });
	}
}

export async function  sentResetPasswordEmail (req: Request, res: Response): Promise<void> {
	try {
		const { email } = req.body;
		if (!email) {
			res.status(400).json({ success: false, message: "Data missing" });
			return;
		}

		const normalizedEmail = String(email).trim().toLowerCase();
		const user = await User.findOne({
			where: {
				email: normalizedEmail
			}
		});
		if (!user) {
			res.status(401).json({ success: false, message: "User not found" });
			return;
		}

		const otp = crypto.randomInt(100000, 1000000).toString();
		const otpKey = `otp:${normalizedEmail}`;
		await redis.set(otpKey, otp, { EX: 180 }); // Expires in 3 minutes

		await mailer.sendMail({
			from: "panneerselvamramesh2004@gmail.com",
			to: user.getDataValue('email'),
			subject: "OTP for reset password",
			text: `Your OTP is ${otp} it will expires in 3 minutes`
		});

		res.status(200).json({ success: true, message: "OTP sent successfullt" });
		return;

	} catch (err) {
		console.log("Error", err);
		res.status(500).json({ success: false, message: "Server error" });
	}
}

export async function verifyOtp (req: Request, res: Response): Promise<void> {
	try {
		const { email, otp } = req.body;
		if (!email || otp === undefined || otp === null || otp === '') {
			res.status(400).json({ success: false, message: 'Email and OTP are required' });
			return;
		}

		const normalizedEmail = String(email).trim().toLowerCase();
		const receivedOtp = String(otp).trim();
		if (!/^\d{6}$/.test(receivedOtp)) {
			res.status(400).json({ success: false, message: 'Invalid OTP format' });
			return;
		}

		const otpKey = `otp:${normalizedEmail}`;
		const storedOtp = await redis.get(otpKey);
		if (!storedOtp) {
			res.status(401).json({ success: false, message: 'OTP expired or invalid' });
			return;
		}

		const receivedOtpBuffer = Buffer.from(receivedOtp);
		const storedOtpBuffer = Buffer.from(storedOtp);
		const isOtpValid =
			receivedOtpBuffer.length === storedOtpBuffer.length &&
			crypto.timingSafeEqual(receivedOtpBuffer, storedOtpBuffer);

		if (!isOtpValid) {
			res.status(401).json({ success: false, message: 'Invalid OTP' });
			return;
		}

		await redis.del(otpKey);

		const resetToken = jwt.sign(
			{ email: normalizedEmail, purpose: 'password-reset' },
			getJwtSecret(),
			{ expiresIn: '10m' }
		);

		res.status(200).json({
			success: true,
			message: 'OTP verified successfully',
			resetToken,
		});
	} catch (err) {
		console.error('Failed to verify OTP:', err);
		res.status(500).json({ success: false, message: 'Unable to verify OTP' });
	}
}