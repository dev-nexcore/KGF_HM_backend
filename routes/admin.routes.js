import { Router } from 'express';
import { verifyAdminToken } from '../middleware/auth.middleware.js';
import { Inventory } from '../models/inventory.model.js';

// Import from individual controller files
import {
  login,
  register,
  forgotPassword,
  verifyOtp,
  resetPassword,
  refreshAccessToken,
  generateRefreshToken
} from "../controllers/admin/auth.controller.js";

import {
  registerStudent,
  registerParent,
  registerWarden
} from "../controllers/admin/user.controller.js";

import {
  getTodaysCheckInOutStatus,
  getBedOccupancyStatus,
  getTotalRevenue,
  getPendingPayments,
  getFinancialSummary
} from "../controllers/admin/dashboard.controller.js";

import {
  getPendingLeaveRequests,
  getAllLeaveRequests,
  updateLeaveStatus,
  getLeaveStatistics,
  getStudentLeaveHistory,
  sendLeaveMessage,
  bulkUpdateLeaveStatus
} from "../controllers/admin/leave.controller.js";

import {
  getAllComplaints,
  getOpenComplaints,
  getResolvedComplaints,
  updateComplaintStatus,
  getComplaintStatistics,
  getComplaintDetails,
  bulkUpdateComplaintStatus,
  getComplaintAttachment
} from "../controllers/admin/complaint.controller.js";

import {
  generateStudentInvoice,
  getStudentInvoices,
  updateStudentInvoiceStatus,
  createManagementInvoice,
  getManagementInvoices,
  updateManagementInvoiceStatus,
  generateStaffSalary,
  getStaffSalaries,
  updateSalaryStatus,
  generateSalarySlip,
  initiateRefund,
  getRefunds,
  updateRefundStatus
} from "../controllers/admin/financial.controller.js";

import {
  getAuditLogs,
  getAuditLogStatistics,
  getAuditLogDetails,
  exportAuditLogs
} from "../controllers/admin/audit.controller.js";

import {
  issueNotice,
  upload,
  addInventoryItem
} from "../controllers/admin/notice_inventory.controller.js";

const router = Router();

// ====================== AUTH ROUTES ======================
router.post('/register', verifyAdminToken, register);
router.post('/login', login);
router.post('/generate-refresh-token', generateRefreshToken);
router.post('/refresh-token', refreshAccessToken);
router.post('/forgot-password', forgotPassword);
router.post('/verify-otp', verifyOtp);
router.post('/reset-password', resetPassword);

// ====================== USER MANAGEMENT ROUTES ======================
router.post('/register-student', registerStudent);
router.post('/register-parent', registerParent);
router.post('/register-warden', registerWarden);

// ====================== DASHBOARD ROUTES ======================
router.get('/todays-checkin-checkout', getTodaysCheckInOutStatus);
router.get('/bed-occupancy-status', getBedOccupancyStatus);
router.get('/dashboard/total-revenue', getTotalRevenue);
router.get('/dashboard/pending-payments', getPendingPayments);
router.get('/dashboard/financial-summary', getFinancialSummary);

// ====================== LEAVE MANAGEMENT ROUTES ======================
router.get('/leaves/pending', getPendingLeaveRequests);
router.get('/leaves', getAllLeaveRequests);
router.put('/leaves/:leaveId/status', updateLeaveStatus);
router.post('/leaves/:leaveId/message', sendLeaveMessage);
router.put('/leaves/bulk-status', bulkUpdateLeaveStatus);
router.get('/leaves/statistics', getLeaveStatistics);
router.get('/leaves/student/:studentId', getStudentLeaveHistory);

// ====================== COMPLAINT MANAGEMENT ROUTES ======================
router.get('/complaints', getAllComplaints);
router.get('/complaints/open', getOpenComplaints);
router.get('/complaints/resolved', getResolvedComplaints);
router.get('/complaints/statistics', getComplaintStatistics);
router.get('/complaints/:complaintId', getComplaintDetails);
router.get('/complaints/:complaintId/attachment/:attachmentId', getComplaintAttachment);
router.put('/complaints/:complaintId/status', updateComplaintStatus);
router.put('/complaints/bulk-status', bulkUpdateComplaintStatus);

// ====================== FINANCIAL MANAGEMENT ROUTES ======================
// Student Invoices
router.post('/invoices/student', generateStudentInvoice);
router.get('/invoices/student', getStudentInvoices);
router.put('/invoices/student/:invoiceId/status', updateStudentInvoiceStatus);

// Management Invoices
router.post('/invoices/management', createManagementInvoice);
router.get('/invoices/management', getManagementInvoices);
router.put('/invoices/management/:invoiceId/status', updateManagementInvoiceStatus);

// Staff Salary Management
router.post('/salary/generate', generateStaffSalary);
router.get('/salary', getStaffSalaries);
router.put('/salary/:salaryId/status', updateSalaryStatus);
router.get('/salary/:salaryId/slip', generateSalarySlip);

// Refund Management
router.post('/refunds', initiateRefund);
router.get('/refunds', getRefunds);
router.put('/refunds/:refundId/status', updateRefundStatus);

// ====================== AUDIT LOG ROUTES ======================
router.get('/audit-logs', getAuditLogs);
router.get('/audit-logs/statistics', getAuditLogStatistics);
router.get('/audit-logs/:logId', getAuditLogDetails);
router.get('/audit-logs/export/csv', exportAuditLogs);

// ====================== CONTENT MANAGEMENT ROUTES ======================
router.post('/inventory/add', upload.single('receipt'), addInventoryItem);
router.post('/issue-notice', issueNotice);

// ====================== PUBLIC ROUTES ======================
// GET /api/inventory/public/:slug
router.get('/public/:slug', async (req, res) => {
  const { slug } = req.params;
  const item = await Inventory.findOne({ publicSlug: slug })
    .select('itemName barcodeId category location status description purchaseDate purchaseCost qrCodeUrl publicSlug');

  if (!item) return res.status(404).json({ message: 'Not found' });
  res.json(item);
});

export default router;