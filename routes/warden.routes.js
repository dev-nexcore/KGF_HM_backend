import express from "express";
import {
  loginWarden,
  forgotPasswordWarden,
  verifyOtpWarden,
  resetPasswordWarden,
  getWardenProfile,
  updateWardenProfile,
  getEmergencyContacts,
  getStudentListForWarden,
  updateStudentRoom,
  getTotalStudents,
  punchInWarden,
  punchOutWarden,
  getAttendanceLog,
} from "../controllers/warden.controller.js";
import { upload } from "../middleware/upload.js";
import { verifyWardenToken } from "../middleware/auth.middleware.js";




const router = express.Router();

router.post("/login", loginWarden);
router.post("/forgot-password", forgotPasswordWarden);
router.post("/verify-otp", verifyOtpWarden);
router.post("/reset-password", resetPasswordWarden);
router.get("/profile/:id", getWardenProfile);
router.put("/profile/:id", upload.single("profilePhoto"), updateWardenProfile);
router.get("/contacts", getEmergencyContacts);
router.get("/students", getStudentListForWarden);
router.put("/students/:studentId", updateStudentRoom);
router.get('/students/count', getTotalStudents);
router.post('/attendance/punch-in', verifyWardenToken,  punchInWarden);
router.post('/attendance/punch-out', verifyWardenToken,  punchOutWarden);
router.get('/attendance/log', verifyWardenToken, getAttendanceLog);

export default router;




