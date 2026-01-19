import { Router } from 'express';
import { verifyAdminToken } from '../middleware/auth.middleware.js';
import { Inventory } from '../models/inventory.model.js';
import { uploadStudentDocuments, uploadParentDocuments } from '../middleware/upload.js';
import { uploadBulk } from "../middleware/upload.js";

// Import from individual controller files
import {
  login,
  sendLoginOTP,
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
  registerWarden,
   getAllStudents,
   getStudentsWithoutParents,
  getStudentById,
  updateStudent,
  deleteStudent,
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
  getAllNotices,
  getNoticeById,
  updateNotice,
  deleteNotice,
  updateNoticeReadStatus,
  upload,
  addInventoryItem,
  updateInventoryItem,
  getInventoryItemById,
  getInventoryItemBySlug,
  generateQRCode,
  downloadQRCode,
  deleteInventoryItem,
  getAvailableBeds,
  getAvailableRooms,
  updateInventoryReceipt,
  getInventoryItems,
  getAvailableRoomsFloors,
  getItemByQRSlug,
  generateStockReport,
  bulkUploadInventory,
  bulkGenerateQRCodes
} from "../controllers/admin/notice_inventory.controller.js";

import{
  createInspection,
  getAllInspections,
  getInspectionById,
  updateInspection,
  deleteInspection,
  updateInspectionStatus
} from "../controllers/admin/inspection.controller.js"

const router = Router();

// In admin.route.js - AUTH ROUTES section
router.post('/send-login-otp', sendLoginOTP);  // NEW ROUTE
router.post('/register',register);
router.post('/login', login);  // Now uses OTP instead of password
router.post('/generate-refresh-token', generateRefreshToken);
router.post('/refresh-token', refreshAccessToken);
router.post('/forgot-password', forgotPassword);
router.post('/verify-otp', verifyOtp);
router.post('/reset-password', resetPassword);

// ====================== USER MANAGEMENT ROUTES ======================
router.post(
  '/register-student',
  verifyAdminToken,
  uploadStudentDocuments.fields([
    { name: 'aadharCard', maxCount: 1 },
    { name: 'panCard', maxCount: 1 }
  ]),
  registerStudent
);
router.post(
  '/register-parent',
  verifyAdminToken,
  uploadParentDocuments.fields([
    { name: 'aadharCard', maxCount: 1 },
    { name: 'panCard', maxCount: 1 }
  ]),
  registerParent
);
router.post('/register-warden', registerWarden);
router.get('/students', getAllStudents);
router.get('/students-without-parents', getStudentsWithoutParents);
router.get('/student/:studentId', getStudentById);
router.put('/update-student/:studentId', updateStudent);
router.delete('/delete-student/:studentId', deleteStudent);

router.post(
  "/inventory/bulk-upload",
  uploadBulk.single("file"),
  bulkUploadInventory
);

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

// ====================== INSPECTION ROUTES ======================
router.post('/inspections',verifyAdminToken, createInspection);
router.get('/inspections', getAllInspections);
router.get('/inspections/:inspectionId', getInspectionById);
router.put('/inspections/:inspectionId', updateInspection);
router.delete('/inspections/:inspectionId', deleteInspection);
router.patch('/inspections/:inspectionId/status',verifyAdminToken, updateInspectionStatus);

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
// General inventory routes
router.get('/inventory', getInventoryItems);
router.post('/inventory/add', upload.single('receipt'), addInventoryItem);

// ADD THESE TWO NEW ROUTES HERE (before specific routes)
router.post('/inventory/bulk-upload', upload.single('file'), bulkUploadInventory);
router.post('/inventory/bulk-qr-generate', bulkGenerateQRCodes);

// Specific inventory routes (these must come BEFORE /inventory/:id)
router.get('/inventory/stock-report', generateStockReport);
router.get('/inventory/available-beds', getAvailableBeds);
router.get('/inventory/available-rooms', getAvailableRooms);
router.get('/inventory/available-rooms-floors', getAvailableRoomsFloors);
router.get('/inventory/qr/:slug', getItemByQRSlug);


// Parameterized inventory routes
router.get('/inventory/:id', getInventoryItemById);
router.put('/inventory/:id', updateInventoryItem);
router.put('/inventory/:id/receipt', upload.single('receipt'), updateInventoryReceipt);
router.post('/inventory/:id/qr-code', generateQRCode);
router.get('/inventory/:id/qr-code/download', downloadQRCode); 
router.delete('/inventory/:id', deleteInventoryItem);

// *** NOTICE ROUTES ***
router.post('/issue-notice', issueNotice);
router.get('/notices', getAllNotices);
router.get('/notices/:noticeId', getNoticeById);
router.put('/notices/:noticeId', updateNotice);
router.delete('/notices/:noticeId', deleteNotice);
router.patch('/notices/:noticeId/read-status', updateNoticeReadStatus);

// ====================== PUBLIC ROUTES ======================
// Public inventory routes
router.get('/public/:slug', getInventoryItemBySlug);

export default router;