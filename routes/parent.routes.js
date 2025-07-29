import express from 'express';
import { login, forgotPassword, verifyOtp, resetPassword, dashboard, attendance, leaveManagement, fees, notices,refreshAccessToken } from '../controllers/parent.controller.js';

const router = express.Router();

router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/verify-otp', verifyOtp);
router.post('/reset-password', resetPassword);
router.get('/dashboard', dashboard);
router.get('/attendance', attendance);
router.get('/leave-management', leaveManagement);
router.get('/fees', fees);
router.get('/notices', notices);
router.post('/refresh-token', refreshAccessToken);
export default router;