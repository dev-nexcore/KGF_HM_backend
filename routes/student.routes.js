import express from 'express';
import {
    login,
    forgotPassword,
    verifyOtp,
    resetPassword,
    checkInStudent,
    checkOutStudent,
    fileComplaint,
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
    getNotificationStatus,
    markNotificationsSeen
} from '../controllers/student.controller.js';
import { verifyStudentToken, verifyStudentOrParentToken } from '../middleware/auth.middleware.js'
import { uploadStudent } from '../middleware/upload.js';

const router = express.Router();

// Public routes (no authentication required)
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/verify-otp', verifyOtp);
router.post('/reset-password', resetPassword);
router.get("/notices", getNotices);

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


router.post("/complaint", verifyStudentOrParentToken, fileComplaint);
router.get("/complaints", verifyStudentOrParentToken, getComplaintHistory);

router.use(verifyStudentToken);


router.post('/upload-profile-image/:studentId', 
  uploadStudent.single('profileImage'),
  uploadMyProfileImage
);

router.delete('/delete-profile-image/:studentId', deleteMyProfileImage);

router.get('/notifications',getNotificationStatus);

router.post('/notifications/mark-seen',markNotificationsSeen)

export default router;