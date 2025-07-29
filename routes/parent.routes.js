import express from 'express';
import { login, forgotPassword, verifyOtp, resetPassword, dashboard, attendance, leaveManagement, fees, notices,markNoticeAsRead,refreshAccessToken } from '../controllers/parent.controller.js';
import { authenticateParent } from '../middleware/auth.middleware.js';

const router = express.Router();

router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/verify-otp', verifyOtp);
router.post('/reset-password', resetPassword);
router.get('/dashboard', authenticateParent,dashboard);
router.get('/attendance',authenticateParent, attendance);
router.get('/leave-management', authenticateParent,leaveManagement);
router.get('/fees',authenticateParent, fees);
router.get('/notices',authenticateParent, notices);
router.patch('/notices/:noticeId/read',authenticateParent, markNoticeAsRead);
router.post('/refresh-token', refreshAccessToken);
export default router;