import { Router } from 'express';
import {
  login,
  forgotPassword,
  verifyOtp,
  resetPassword
} from "../controllers/admin.controller.js";

const router = Router();

router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/verify-otp', verifyOtp);
router.post('/reset-password', resetPassword);

export default router;
