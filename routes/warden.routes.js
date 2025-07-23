import express from "express";
import {
  loginWarden,
  forgotPasswordWarden,
  verifyOtpWarden,
  resetPasswordWarden,
} from "../controllers/warden.controller.js";

const router = express.Router();

router.post("/login", loginWarden);
router.post("/forgot-password", forgotPasswordWarden);
router.post("/verify-otp", verifyOtpWarden);
router.post("/reset-password", resetPasswordWarden);

export default router;
