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
    deleteMyProfileImage
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

router.use(verifyStudentToken);

router.post('/check-in', checkInStudent);
router.post('/check-out', checkOutStudent);

router.post("/complaint", fileComplaint);
router.get("/complaints/:studentId", getComplaintHistory);

router.post("/leave", applyForLeave);
router.get("/leaves/:studentId", getLeaveHistory);

router.post("/refund", requestRefund);
router.get("/refunds/:studentId", getRefundHistory);


router.put("/profile/:studentId", updateStudentProfile);

router.get("/feeStatus/:studentId", getCurrentFeesStatus);

router.get('/inspectionSchedule/:studentId', getNextInspection);

router.get('/attendanceSummary/:studentId', getAttendanceSummary);

router.post('/upload-profile-image/:studentId', 
  uploadStudent.single('profileImage'),
  uploadMyProfileImage
);

router.delete('/delete-profile-image/:studentId', deleteMyProfileImage);

router.get('/notifications',getNotificationStatus)

export default router;