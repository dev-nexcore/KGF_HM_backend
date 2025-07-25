import { Router } from 'express';
import { verifyAdminToken } from '../middleware/auth.middleware.js';

import {
  login,
  register,
  forgotPassword,
  verifyOtp,
  resetPassword,
  registerStudent,
  registerParent,
  registerWarden,
  refreshAccessToken,
  getTodaysCheckInOutStatus,
  getBedOccupancyStatus,
  upload,
  addInventoryItem,
  issueNotice,
  createInspection,
  getAdminInspections,
  getInspectionById,
  updateInspection,
  deleteInspection,
  getInspectionHistory
} from "../controllers/admin.controller.js";

const router = Router();

router.post('/register', verifyAdminToken, register);
router.post('/login', login);
router.post('/refresh-token', refreshAccessToken);
router.post('/forgot-password', forgotPassword);
router.post('/verify-otp', verifyOtp);
router.post('/reset-password', resetPassword);
router.post('/register-student', registerStudent);
router.post('/register-parent', registerParent);
router.post('/register-warden', registerWarden);
router.get('/todays-checkin-checkout', getTodaysCheckInOutStatus);
router.get('/bed-occupancy-status', getBedOccupancyStatus);
router.post('/inventory/add', upload.single('receipt'), addInventoryItem);
router.post('/issue-notice', issueNotice);
router.post('/inspections',  createInspection);
router.get('/inspections',  getAdminInspections);
router.get('/inspections/:id',  getInspectionById);
router.put('/inspections/:id',  updateInspection);
router.delete('/inspections/:id', deleteInspection);
router.get('/history', getInspectionHistory);

export default router;