export interface UploadedFileResponse {
	filename: string;
	originalName: string;
	mimetype: string;
	size: number;
	url: string;
	uploadedAt: string;
	uploadedBy: string
}

export interface ApiResponse<T = unknown> {
	success: boolean;
	message: string;
	data?: T;
	error?: string;
}
