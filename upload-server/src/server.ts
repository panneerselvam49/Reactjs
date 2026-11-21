import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import uploadRoutes from './routes/uploadRoutes.ts';
import { uploadPath } from './config/multer.ts';
import { errorHandler } from './middlewares/errorHandler.ts';

import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config(); // fallback to cwd .env if any

const app = express();
const PORT = process.env.PORT;

app.use(
	cors({
		origin: process.env.CORS_ORIGIN || '*',
		methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
		allowedHeaders: ['Content-Type', 'Authorization'],
	})
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(uploadPath));

// Health check endpoint
app.get('/health', (_req, res) => {
	res.status(200).json({
		status: 'healthy',
		service: 'file-upload-server',
		port: PORT,
		timestamp: new Date().toISOString(),
	});
});

app.use('/api/upload', uploadRoutes);

app.use(errorHandler);

app.listen(PORT, () => {
	console.log(`File Upload Server running on http://localhost:${PORT}`);
});

export default app;
