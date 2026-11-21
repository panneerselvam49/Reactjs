import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import user from '../../models/user.ts';
import { Op } from 'sequelize';

const adminSellerAccess = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
	try {
		const header = req.headers.authorization;
		const allowedUser = ['admin', 'seller'];

		if (!header || !header.startsWith('Bearer ')) {
			res.status(401).json({ success: false, message: 'Not authorized' });
			return;
		}

		const token = header.split(' ')[1];
		const decode = jwt.verify(token, process.env.secret!);

		if (typeof decode === 'string' || !('id' in decode)) {
			res.status(401).json({ success: false, message: 'Invalid token' });
			return;
		}

		const foundUser = await user.findOne({ attributes: ['id', 'name', 'email', 'role'], where: { id: decode.id, role: { [Op.in]: allowedUser } } });

		if (!foundUser) {
			res.status(404).json({ success: false, message: 'User not found' });
			return;
		}

		res.locals.userId = decode.id;
		res.locals.role = decode.role;
		res.locals.name = decode.name;

		next();
	} catch (error) {
		console.error('userValidate error:', error);
		res.status(401).json({ success: false, message: 'Invalid or expired token' });
	}
}

export default adminSellerAccess;