import { Router } from 'express';
import {
  createInquiry,
  getAllInquiries,
  updateInquiryStatus,
  deleteInquiry
} from '../controllers/inquiry.controller.js';
import { verifyAdminToken } from '../middleware/auth.middleware.js';

const router = Router();

// Public route to submit inquiry from landing page
router.post('/submit', createInquiry);

// Protected routes for Admin/Warden
router.get('/', getAllInquiries);
router.put('/:id/status', verifyAdminToken, updateInquiryStatus);
router.delete('/:id', verifyAdminToken, deleteInquiry);

export default router;
