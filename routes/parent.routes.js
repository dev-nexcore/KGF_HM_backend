import express from 'express';
import { login, forgotPassword, verifyOtp, resetPassword, dashboard, attendance } from '../controllers/parentController.js';

const router = express.Router();

router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/verify-otp', verifyOtp);
router.post('/reset-password', resetPassword);
router.post('/dashboard', dashboard);
router.post('/attendance', attendance);

export default router;