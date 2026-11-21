import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import user from '../../models/user.ts';

const userValidate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
	try {
		const header = req.headers.authorization;

		if (!header || !header.startsWith('Bearer ')) {
			res.status(401).json({ success: false, message: 'Not authorized' });
			return;
		}

		const token = header.split(' ')[1];
		const decode = jwt.verify(token, process.env.secret!);

		if (typeof decode === 'string') {
			res.status(401).json({ success: false, message: 'Invalid token' });
			return;
		}

		let foundUser;
		if (decode.purpose === 'password-reset' && typeof decode.email === 'string') {
			foundUser = await user.findOne({ where: { email: decode.email } });
			res.locals.resetPassword = true;
		} else if ('id' in decode) {
			foundUser = await user.findOne({ where: { id: decode.id } });
		} else {
			res.status(401).json({ success: false, message: 'Invalid token' });
			return;
		}

		if (!foundUser) {
			res.status(404).json({ success: false, message: 'User not found' });
			return;
		}

		res.locals.userId = foundUser.getDataValue('id');
		res.locals.userEmail = foundUser.getDataValue('email');

		next();
	} catch (error) {
		console.error('userValidate error:', error);
		res.status(401).json({ success: false, message: 'Invalid or expired token' });
	}
}

export default userValidate;