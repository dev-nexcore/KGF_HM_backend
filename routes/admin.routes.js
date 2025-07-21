import { Router } from 'express';
import { verifyAdminToken } from '../middleware/auth.middleware.js';

import {
  login,
  register,
  forgotPassword,
  verifyOtp,
  resetPassword,
  registerStudent,
  refreshAccessToken

} from "../controllers/admin.controller.js";

const router = Router();

router.post('/register', verifyAdminToken, register);
router.post('/login', login);
router.post('/refresh-token', refreshAccessToken);
router.post('/forgot-password', forgotPassword);
router.post('/verify-otp', verifyOtp);
router.post('/reset-password', resetPassword);
router.post('/register-student',  registerStudent);

export default router;
