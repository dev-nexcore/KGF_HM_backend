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
  getAllLeaveRequests,
  updateLeaveStatusWarden,
  getLeaveRequestStats,
  filterLeaveRequests,
  getBedStats,
  getBedStatusOverview
} from "../controllers/warden.controller.js";
import { upload } from "../middleware/upload.js";
import { verifyWardenToken } from "../middleware/auth.middleware.js";




const router = express.Router();

// login page
router.post("/login", loginWarden);
router.post("/forgot-password", forgotPasswordWarden);
router.post("/verify-otp", verifyOtpWarden);
router.post("/reset-password", resetPasswordWarden);

// Warden Profile Page.
router.get("/profile/:id", getWardenProfile);
router.put("/profile/:id", upload.single("profilePhoto"), updateWardenProfile);

// Emergency Contacts.
router.get("/contacts", getEmergencyContacts);

// Student Management.
router.get("/students", getStudentListForWarden);
router.put("/students/:studentId", updateStudentRoom);
router.get('/students/count', getTotalStudents);


// Warden Puch in and Punch out. page
router.post('/attendance/punch-in', verifyWardenToken,  punchInWarden);
router.post('/attendance/punch-out', verifyWardenToken,  punchOutWarden);
router.get('/attendance/log', verifyWardenToken, getAttendanceLog);

// Leave Management Page
router.get('/requested-leave', verifyWardenToken, getAllLeaveRequests);
router.put('/:leaveId/status', verifyWardenToken, updateLeaveStatusWarden);
router.get('/leave-stats', verifyWardenToken, getLeaveRequestStats);
router.get('/leave-filter', verifyWardenToken, filterLeaveRequests);

// Bed allotments Management Page
router.get('/bed-stats', getBedStats);
router.get('/bed-status', getBedStatusOverview);


export default router;




