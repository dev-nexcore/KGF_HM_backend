import express from 'express';
import { sendLoginOTP,login, forgotPassword, verifyOtp, resetPassword, dashboard, attendance, leaveManagement, fees, notices,markNoticeAsRead,refreshAccessToken, updateLeaveStatus, getProfile, uploadProfileImage, updateProfile, removeProfileImage } from '../controllers/parent.controller.js';
import { authenticateParent } from '../middleware/auth.middleware.js';
import {uploadParent} from '../middleware/upload.js';

const router = express.Router();

router.post('/send-login-otp', sendLoginOTP);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/verify-otp', verifyOtp);
router.post('/reset-password', resetPassword);
router.get('/profile', authenticateParent, getProfile);
router.post('/profile/image', authenticateParent, uploadParent.single('profileImage'), uploadProfileImage);
router.put('/profile', authenticateParent, updateProfile);
router.delete('/profile/image', authenticateParent, removeProfileImage);
router.get('/dashboard', authenticateParent,dashboard);
router.get('/attendance', attendance);
router.get('/leave-management', authenticateParent,leaveManagement);
router.put('/leave-status', authenticateParent, updateLeaveStatus);
router.get('/fees',authenticateParent, fees);
router.get('/notices',authenticateParent, notices);
router.patch('/notices/:noticeId/read',authenticateParent, markNoticeAsRead);
router.post('/refresh-token', refreshAccessToken);
export default router;