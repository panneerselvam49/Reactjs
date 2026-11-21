import multer from 'multer';
import type { Request, Response, NextFunction } from 'express';

export const errorHandler = (
	err: Error,
	_req: Request,
	res: Response,
	_next: NextFunction
): void => {

	if (err instanceof multer.MulterError) {
		let message = err.message;
		if (err.code === 'LIMIT_FILE_SIZE') {
			message = `File too large. Maximum size allowed is ${process.env.MAX_FILE_SIZE_MB || 10}MB.`;
		} else if (err.code === 'LIMIT_FILE_COUNT') {
			message = 'Too many files uploaded at once.';
		} else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
			message = `Unexpected field name "${err.field}". Use "file" for single upload or "files" for multiple upload.`;
		}

		res.status(400).json({
			success: false,
			message,
			code: err.code,
		});
		return;
	}

	if (err.message && err.message.includes('not allowed')) {
		res.status(400).json({
			success: false,
			message: err.message,
		});
		return;
	}

	console.error('Unhandled server error:', err);
	res.status(500).json({
		success: false,
		message: err.message || 'Internal server error during file processing',
	});
};

export default errorHandler;