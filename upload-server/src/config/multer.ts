import multer from 'multer';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import type { Request } from 'express';

import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

const uploadDirectory = process.env.UPLOAD_DIR || 'uploads';
const uploadPath = path.resolve(__dirname, '../../', uploadDirectory);

if (!fs.existsSync(uploadPath)) {
	fs.mkdirSync(uploadPath, { recursive: true });
}

// Multer Disk Storage Configuration
const storage = multer.diskStorage({
	destination: (_req: Request, _file: Express.Multer.File, cb) => {
		cb(null, uploadPath);
	},
	filename: (_req: Request, file: Express.Multer.File, cb) => {
		const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
		const sanitizedOriginalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
		const extension = path.extname(sanitizedOriginalName);
		const baseName = path.basename(sanitizedOriginalName, extension);
		cb(null, `${baseName}-${uniqueSuffix}${extension}`);
	},
});

const allowedExtensions = (
	process.env.ALLOWED_EXTENSIONS || 'jpg,jpeg,png,webp,gif,svg,pdf,doc,docx,zip,txt'
)
	.split(',')
	.map((ext) => ext.trim().toLowerCase());

const fileFilter = (
	_req: Request,
	file: Express.Multer.File,
	cb: multer.FileFilterCallback
) => {
	const ext = path.extname(file.originalname).slice(1).toLowerCase();
	if (allowedExtensions.length === 0 || allowedExtensions.includes(ext)) {
		cb(null, true);
	} else {
		cb(
			new Error(
				`File type .${ext} is not allowed. Allowed extensions: ${allowedExtensions.join(', ')}`
			)
		);
	}
};

// Max file size in bytes
const maxFileSizeMb = parseInt(process.env.MAX_FILE_SIZE_MB || '10', 10);
const limits = {
	fileSize: maxFileSizeMb * 1024 * 1024,
};

export const upload = multer({
	storage,
	fileFilter,
	limits,
});

export { uploadPath };
