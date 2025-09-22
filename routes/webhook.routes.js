import express from 'express';
import { handleAttendanceWebhook } from '../controllers/webhook.controller.js';
import { ipWhitelist } from '../middleware/auth.middleware.js';

const router = express.Router();

// Protected webhook endpoint with IP whitelisting
router.post('/essl-attendance', ipWhitelist, handleAttendanceWebhook);

export default router;