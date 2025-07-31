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
    getAttendanceLog,
     uploadMyProfileImage, // ✨ ADD THIS
    deleteMyProfileImage
} from '../controllers/student.controller.js';

import { uploadStudent } from '../middleware/upload.js'; // Import the upload middleware

const router = express.Router();

router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/verify-otp', verifyOtp);
router.post('/reset-password', resetPassword);
router.post('/check-in', checkInStudent);
router.post('/check-out', checkOutStudent);
router.get('/attendance-log/:studentId', getAttendanceLog);
router.post("/complaint", fileComplaint);
router.get("/complaints/:studentId", getComplaintHistory);
router.post("/leave", applyForLeave);
router.get("/leaves/:studentId", getLeaveHistory);
router.post("/refund", requestRefund);
router.get("/refunds/:studentId", getRefundHistory);
router.get("/profile/:studentId", getStudentProfile);
router.put("/profile/:studentId", updateStudentProfile);
router.get("/feeStatus/:studentId", getCurrentFeesStatus);

router.post('/upload-profile-image/:studentId', 
  uploadStudent.single('profileImage'), // Use your existing upload middleware
  uploadMyProfileImage
);

router.delete('/delete-profile-image/:studentId', deleteMyProfileImage);

export default router;