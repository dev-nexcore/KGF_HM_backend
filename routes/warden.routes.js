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
  getBedStatusOverview,
  getRecentInspections,
  getFilteredInspections,
  getInspectionById,
  completeInspection,
  getInspectionStats,
  getWardenDashboardStats,
  updateEmergencyContact,
} from "../controllers/warden.controller.js";
import { upload } from "../middleware/upload.js";
import { verifyWardenToken } from "../middleware/auth.middleware.js";

const router = express.Router();

// login page
router.post("/login", loginWarden);
router.post("/forgot-password", forgotPasswordWarden);
router.post("/verify-otp", verifyOtpWarden);
router.post("/reset-password", resetPasswordWarden);


// Warden Puch in and Punch out page
router.post('/attendance/punch-in', verifyWardenToken,  punchInWarden);
router.post('/attendance/punch-out', verifyWardenToken,  punchOutWarden);
router.get('/attendance/log', verifyWardenToken, getAttendanceLog);


// warden Dashboard
router.get("/warden-dashboard", getWardenDashboardStats);


// Bed allotments Management Page
router.get('/bed-stats', getBedStats);
router.get('/bed-status', getBedStatusOverview);


// Student Management.
router.get("/students", getStudentListForWarden);
router.put("/students/:studentId", updateStudentRoom);
router.get('/students/count', getTotalStudents);



// Inspections Management Page
router.get('/recent-inspections',getRecentInspections);
router.get('/filtered-inspections', getFilteredInspections);
router.get('/recent-inspections/:id', getInspectionById); 
router.patch('/recent-inspections/complete/:id', completeInspection);
router.get('/inspection-stats', getInspectionStats);



// Leave Management Page
router.get('/requested-leave', verifyWardenToken, getAllLeaveRequests);
router.put('/:leaveId/status', verifyWardenToken, updateLeaveStatusWarden);
router.get('/leave-stats', verifyWardenToken, getLeaveRequestStats);
router.get('/leave-filter', verifyWardenToken, filterLeaveRequests);



// Warden Profile Page.
router.get("/profile/:id", getWardenProfile);
router.put("/profile/:id", upload.single("profilePhoto"), updateWardenProfile);


// Emergency Contacts.
router.get("/emergency-contact", getEmergencyContacts);
router.put('/emergency-contact/:studentId', updateEmergencyContact);


export default router;




