import express from 'express';
import { login, forgotPassword, verifyOtp, resetPassword, checkInStudent, checkOutStudent } from '../controllers/student.controller.js';

const router = express.Router();

router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/verify-otp', verifyOtp);
router.post('/reset-password', resetPassword);
router.post('/check-in', checkInStudent);
router.post('/check-out', checkOutStudent);


export default router;