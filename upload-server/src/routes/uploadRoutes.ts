import express from 'express';
import { upload } from '../config/multer.ts';
import {
	uploadSingleFile,
	uploadMultipleFiles,
	listUploadedFiles,
	deleteFile,
} from '../controllers/uploadController.ts';
import adminSellerAccess from "../../../server/api/middleware/specialUser.ts"

const router = express.Router();

router.post('/single', adminSellerAccess, upload.single('file'), uploadSingleFile);

router.post('/multiple', adminSellerAccess, upload.array('files', 10), uploadMultipleFiles);

router.get('/list', listUploadedFiles);

router.delete('/delete/:filename', deleteFile);

export default router;
