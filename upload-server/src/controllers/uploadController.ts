import type { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { uploadPath } from '../config/multer.ts';
import type { UploadedFileResponse, ApiResponse } from '../types/index.ts';

const getBaseUrl = (req: Request): string => {
	return process.env.BASE_URL;
};

const mapFileToResponse = (req: Request, res: Response,file: Express.Multer.File): UploadedFileResponse => {
	const baseUrl = getBaseUrl(req);
	return {
		filename: file.filename,
		originalName: file.originalname,
		mimetype: file.mimetype,
		size: file.size,
		url: `${baseUrl}/uploads/${file.filename}`,
		uploadedAt: new Date().toISOString(),
		uploadedBy: res.locals.name
	};
};

export const uploadSingleFile = (
	req: Request,
	res: Response<ApiResponse<UploadedFileResponse>>
): void => {
	if (!req.file) {
		res.status(400).json({
			success: false,
			message: 'No file uploaded. Please supply a file under the field name "file".',
		});
		return;
	}

	const fileData = mapFileToResponse(req, res,req.file);

	res.status(201).json({
		success: true,
		message: 'File uploaded successfully',
		data: fileData,
	});
};

export const uploadMultipleFiles = (
	req: Request,
	res: Response<ApiResponse<UploadedFileResponse[]>>
): void => {
	const files = req.files as Express.Multer.File[];

	if (!files || files.length === 0) {
		res.status(400).json({
			success: false,
			message: 'No files uploaded. Please supply files under the field name "files".',
		});
		return;
	}

	let test = req.files;
	let orgFile = test?.map((file) => file.originalname);
	
	let duplicateFileName = new Set();

	for (let i=0; i<orgFile.length; i++) {
		if (duplicateFileName.has(orgFile[i])) {
			res.status(409).json({ success: false, message: "Duplicate file name please change it"});
			return;
		}
		duplicateFileName.add(orgFile[i]);
	}
	
	const filesData = files.map((file) => mapFileToResponse(req, res, file));

	res.status(201).json({
		success: true,
		message: `${files.length} file(s) uploaded successfully`,
		data: filesData,
	});
};

export const listUploadedFiles = (
	req: Request,
	res: Response<ApiResponse<UploadedFileResponse[]>>
): void => {
	try {
		if (!fs.existsSync(uploadPath)) {
			res.status(200).json({
				success: true,
				message: 'No files uploaded yet',
				data: [],
			});
			return;
		}

		const files = fs.readdirSync(uploadPath);
		const baseUrl = getBaseUrl(req);

		const fileList: UploadedFileResponse[] = files.map((filename) => {
			const fullPath = path.join(uploadPath, filename);
			const stats = fs.statSync(fullPath);
			return {
				filename,
				originalName: filename,
				mimetype: 'application/octet-stream',
				size: stats.size,
				url: `${baseUrl}/uploads/${filename}`,
				uploadedAt: stats.birthtime.toISOString(),
			};
		});

		res.status(200).json({
			success: true,
			message: 'Files retrieved successfully',
			data: fileList,
		});
	} catch (err: unknown) {
		const error = err as Error;
		res.status(500).json({
			success: false,
			message: 'Failed to retrieve files',
			error: error.message,
		});
	}
};

export const deleteFile = (
	req: Request<{ filename: string }>,
	res: Response<ApiResponse>
): void => {
	const { filename } = req.params;

	const safeFilename = path.basename(filename);
	const filePath = path.join(uploadPath, safeFilename);

	if (!fs.existsSync(filePath)) {
		res.status(404).json({
			success: false,
			message: `File '${safeFilename}' not found`,
		});
		return;
	}

	try {
		fs.unlinkSync(filePath);
		res.status(200).json({
			success: true,
			message: `File '${safeFilename}' deleted successfully`,
		});
	} catch (err: unknown) {
		const error = err as Error;
		res.status(500).json({
			success: false,
			message: 'Failed to delete file',
			error: error.message,
		});
	}
};
