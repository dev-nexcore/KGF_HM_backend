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
  issueNotice

} from "../controllers/admin.controller.js";

const router = Router();

router.post('/register', verifyAdminToken, register);
router.post('/login', login);
router.post('/refresh-token', refreshAccessToken);
router.post('/forgot-password', forgotPassword);
router.post('/verify-otp', verifyOtp);
router.post('/reset-password', resetPassword);
router.post('/register-student',  registerStudent);
router.post('/register-parent', registerParent);
router.post('/register-warden', registerWarden);
router.get('/todays-checkin-checkout', getTodaysCheckInOutStatus);
router.get('/bed-occupancy-status', getBedOccupancyStatus);
router.post('/inventory/add', upload.single('receipt'), addInventoryItem);
router.post('/issue-notice',issueNotice)

// GET /api/inventory/public/:slug
router.get('/public/:slug', async (req, res) => {
  const { slug } = req.params;
  const item = await Inventory.findOne({ publicSlug: slug })
    .select('itemName barcodeId category location status description purchaseDate purchaseCost qrCodeUrl publicSlug');

  if (!item) return res.status(404).json({ message: 'Not found' });
  res.json(item);
});



export default router;
