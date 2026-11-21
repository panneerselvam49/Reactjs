import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import user from '../../models/user.ts';

const optionalUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
	try {
		const header = req.headers.authorization;

		if (!header) {
			next();
			return;
		}

		if (!header.startsWith('Bearer ')) {
			res.status(401).json({ success: false, message: 'Invalid authorization header' });
			return;
		}

		const token = header.slice('Bearer '.length);
		const decode = jwt.verify(token, process.env.secret!);

		if (typeof decode === 'string' || !('id' in decode)) {
			res.status(401).json({ success: false, message: 'Invalid token' });
			return;
		}

		const foundUser = await user.findOne({ where: { id: decode.id } });
		if (!foundUser) {
			res.status(404).json({ success: false, message: 'User not found' });
			return;
		}

		res.locals.userId = decode.id;
		next();
	} catch (error) {
		console.error('optionalUser error:', error);
		res.status(401).json({ success: false, message: 'Invalid token' });
	}
};

export default optionalUser;
