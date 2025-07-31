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
    //  uploadMyProfileImage, // ✨ ADD THIS
    // deleteMyProfileImage
} from '../controllers/student.controller.js';
import { verifyStudentToken } from '../middleware/auth.middleware.js'
import { uploadStudent } from '../middleware/upload.js'; // Assuming you have a middleware for file uploads

const router = express.Router();

router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/verify-otp', verifyOtp);
router.post('/reset-password', resetPassword);
router.get("/notices",getNotices);

router.use(verifyStudentToken);

router.post('/check-in', checkInStudent);
router.post('/check-out', checkOutStudent);

router.post("/complaint", fileComplaint);
router.get("/complaints/:studentId", getComplaintHistory);

router.post("/leave", applyForLeave);
router.get("/leaves/:studentId", getLeaveHistory);

router.post("/refund", requestRefund);
router.get("/refunds/:studentId", getRefundHistory);

router.get("/profile", getStudentProfile);
router.put("/profile/:studentId", updateStudentProfile);

router.get("/feeStatus/:studentId", getCurrentFeesStatus);

router.get('/inspectionSchedule/:studentId', getNextInspection);

router.get('/attendanceSummary/:studentId', getAttendanceSummary);

// router.post('/upload-profile-image/:studentId', 
//   uploadStudent.single('profileImage'), // Use your existing upload middleware
//   uploadMyProfileImage
// );

// router.delete('/delete-profile-image/:studentId', deleteMyProfileImage);

export default router;