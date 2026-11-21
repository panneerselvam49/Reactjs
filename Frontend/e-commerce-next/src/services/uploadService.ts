import axios from 'axios';

const UPLOAD_SERVER_URL = process.env.NEXT_PUBLIC_UPLOAD_SERVER_URL || 'http://localhost:5000';
const MAIN_API_URL = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api`;

const getToken = () => {
	if (typeof window !== 'undefined') {
		return localStorage.getItem('token');
	}
	return null;
};

export interface UploadFileResult {
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
  url: string;
  uploadedAt: string;
}

export interface UploadResponse<T = UploadFileResult> {
  success: boolean;
  message: string;
  data: T;
}

/**
 * Upload a single file to the dedicated upload server
 * @param file File object from an <input type="file" /> or drag-and-drop
 * @param onProgress Optional progress callback (percentage: 0 - 100)
 */
export const uploadSingleFile = async (
	file: File,
	onProgress?: (percent: number) => void
): Promise<UploadFileResult> => {
	const formData = new FormData();
	formData.append('file', file);

	const res = await axios.post<UploadResponse<UploadFileResult>>(
		`${UPLOAD_SERVER_URL}/api/upload/single`,
		formData,
		{
			headers: {
				'Content-Type': 'multipart/form-data',
				Authorization: `Bearer ${getToken()}`,
			},
			onUploadProgress: (progressEvent) => {
				if (onProgress && progressEvent.total) {
					const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
					onProgress(percent);
				}
			},
		}
	);
	return res.data.data;
};

export const uploadMultipleFiles = async (
	files: File[],
	onProgress?: (percent: number) => void
): Promise<UploadFileResult[]> => {
	const formData = new FormData();
	files.forEach((file) => formData.append('files', file));
	const res = await axios.post<UploadResponse<UploadFileResult[]>>(
		`${UPLOAD_SERVER_URL}/api/upload/multiple`,
		formData,
		{
			headers: { 'Content-Type': 'multipart/form-data', Authorization: `Bearer ${getToken()}` },
			onUploadProgress: (progressEvent) => {
				if (onProgress && progressEvent.total) {
					const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
					onProgress(percent);
				}
			},
		}
	);
	return res.data.data;
};

export const deleteUploadedFile = async (filename: string): Promise<boolean> => {
	const res = await axios.delete<{ success: boolean }>(
		`${UPLOAD_SERVER_URL}/api/upload/delete/${filename}`,
		{ headers: { Authorization: `Bearer ${getToken()}` } }
	);
	return res.data.success;
};

export interface CreateProductPayload {
	name: string;
	price: number;
	stock: number;
	description?: string;
	images: string[];
	category?: string;
}

export const createProduct = async (payload: CreateProductPayload): Promise<{ success: boolean; message: string }> => {
	const res = await axios.post(
		`${MAIN_API_URL}/product/createProduct`,
		payload,
		{ headers: { Authorization: `Bearer ${getToken()}` } }
	);
	return res.data;
};
