import express from "express";
import {
  loginWarden,
  forgotPasswordWarden,
  verifyOtpWarden,
  resetPasswordWarden,
  getWardenProfile,
  updateWardenProfile,
  getEmergencyContacts
} from "../controllers/warden.controller.js";
import { upload } from "../middleware/upload.js";




const router = express.Router();

router.post("/login", loginWarden);
router.post("/forgot-password", forgotPasswordWarden);
router.post("/verify-otp", verifyOtpWarden);
router.post("/reset-password", resetPasswordWarden);
router.get("/profile/:id", getWardenProfile);
router.put("/profile/:id", upload.single("profilePhoto"), updateWardenProfile);
router.get("/contacts", getEmergencyContacts);
export default router;




