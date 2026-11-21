import express from 'express';
import { register, login, googleLogin, refresh, logout, changePassword, sentResetPasswordEmail, verifyOtp } from './auth.ts';

import userValidate from "../middleware/user.ts";

const router = express.Router();

router.post('/registerUser', register);
router.post('/loginUser', login);
router.post('/googleLogin', googleLogin);
router.post('/refreshToken', refresh);
router.post('/logout', logout);
router.put('/changePassword', userValidate, changePassword);
router.post('/forgotPassword', sentResetPasswordEmail);
router.post('/verifyOtp', verifyOtp);

export default router;