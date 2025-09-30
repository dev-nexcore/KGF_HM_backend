import express from 'express';
import {
  sendLoginOTP,
  login,
  forgotPassword,
  verifyOtp,
  resetPassword,
  checkInStudent,
  checkOutStudent,
  fileComplaint,
  getStudentComplaints,
  getComplaintAttachment,
  getComplaintHistory,
  applyForLeave,
  getLeaveHistory,
  requestRefund,
  getRefundHistory,
  getStudentProfile,
  updateStudentProfile,
  getCurrentFeesStatus,
  getNotices,
  getNextInspection,
  getAttendanceSummary,
  getAttendanceLog,
  uploadMyProfileImage,
  deleteMyProfileImage,
  getNotifications,
  markNotificationsAsSeen
} from '../controllers/student.controller.js';
import { verifyStudentToken, verifyStudentOrParentToken } from '../middleware/auth.middleware.js'
import { uploadStudent, uploadComplaint } from '../middleware/upload.js';

const router = express.Router();

// Public routes (no authentication required)
router.post('/send-otp', sendLoginOTP);

router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/verify-otp', verifyOtp);
router.post('/reset-password', resetPassword);
router.get("/notices", getNotices);

// Routes that work for both students and parents
router.get('/attendance-log/:studentId', verifyStudentOrParentToken, getAttendanceLog);
router.get("/profile/:studentId", verifyStudentOrParentToken, getStudentProfile);
router.get("/profile", verifyStudentOrParentToken, getStudentProfile);
router.put("/profile", verifyStudentOrParentToken, updateStudentProfile);

router.post('/check-in', verifyStudentOrParentToken, checkInStudent);
router.post('/check-out', verifyStudentOrParentToken, checkOutStudent);

router.get('/attendanceSummary/:studentId', verifyStudentOrParentToken, getAttendanceSummary);
router.get('/inspectionSchedule', verifyStudentOrParentToken, getNextInspection);

router.post("/leave", verifyStudentOrParentToken, applyForLeave);
router.get("/leaves", verifyStudentOrParentToken, getLeaveHistory);

router.get('/feeStatus', verifyStudentOrParentToken, getCurrentFeesStatus);

router.post("/refund", verifyStudentOrParentToken, requestRefund);
router.get("/refunds", verifyStudentOrParentToken, getRefundHistory);

// FIXED: Complaint routes with proper multer middleware
router.post("/complaint", verifyStudentOrParentToken, uploadComplaint.array('attachments', 5), fileComplaint);
router.get("/complaints", verifyStudentOrParentToken, getComplaintHistory);

// Student-only routes
router.use(verifyStudentToken);

// These routes require student authentication
router.get('/complaints/:studentId', getStudentComplaints);
router.get('/complaint/:complaintId/attachment/:attachmentId', getComplaintAttachment);
router.get("/leaves/:studentId", getLeaveHistory);
router.get("/refunds/:studentId", getRefundHistory);
router.put("/profile/:studentId", updateStudentProfile);
router.get("/feeStatus/:studentId", getCurrentFeesStatus);
router.get('/inspectionSchedule/:studentId', getNextInspection);
router.get('/attendanceSummary/:studentId', getAttendanceSummary);
router.get('/notifications',  getNotifications);
router.post('/notifications/mark-seen', markNotificationsAsSeen);

router.post('/upload-profile-image/:studentId',
  uploadStudent.single('profileImage'),
  uploadMyProfileImage
);

router.delete('/delete-profile-image/:studentId', deleteMyProfileImage);

export default router;