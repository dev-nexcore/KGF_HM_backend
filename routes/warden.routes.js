import express from "express";
import {
  loginWarden,
  forgotPasswordWarden,
  verifyOtpWarden,
  resetPasswordWarden,
  getWardenProfile,
  updateWardenProfile,
  getEmergencyContacts,
  getStudentListForWarden,
  updateStudentRoom,
  getTotalStudents,
  punchInWarden,
  punchOutWarden,
  getAttendanceLog,
  getAllLeaveRequests as getWardenAllLeaveRequests,
  updateLeaveStatusWarden,
  getLeaveRequestStats,
  filterLeaveRequests,
  getBedStats,
  getBedStatusOverview,
  getRecentInspections,
  getFilteredInspections,
  getInspectionById,
  completeInspection,
  getInspectionStats,
  getWardenDashboardStats,
  updateEmergencyContact,
    getAllWarden, 
    updateWarden,
    deleteWarden,
    deleteLeaveRequest,
  getAllAvailableBed,
  deleteInspection,
  checkPunchStatus,
  sendLoginOTP,
  getStudentDocument,
  registerIntern,
  registerStudent,
  registerParent,
  getAllInterns,
  getAllParents,
  getWardenRequisitions,
  getStudentsWithoutParents,
  updateStudentWarden,
  getAvailableBedsInventory,
  getBedOccupancyStatus,
  getAvailableRoomsInventory,
  getInventoryItemById,
  getStudentInvoicesForWarden,
  updateParentWarden,
  deleteParentWarden,
  submitNoticeRequisition,
  getWardenInspections,
  createWardenInspection,
  updateWardenInspectionStatus,
  deleteWardenInspection,
  getWardenInspectionTemplates,
  createWardenInspectionTemplate,
  submitInventoryReplacement,
  registerStaffWarden
} from "../controllers/warden.controller.js";
import { upload, uploadWardenDocuments, uploadStudentDocuments, uploadParentDocuments } from "../middleware/upload.js";
import { verifyWardenToken } from "../middleware/auth.middleware.js";
import { getAuditLogs } from "../controllers/admin/audit.controller.js";
import { getAttendanceLogs, getAttendanceStats } from "../controllers/admin/attendance.controller.js";

import {
  getAllComplaints,
  getOpenComplaints,
  getInProgressComplaints,
  getResolvedComplaints,
  getRejectedComplaints,
  updateComplaintStatus,
  getComplaintStatistics,
  getComplaintDetails,
  bulkUpdateComplaintStatus,
  getComplaintAttachment
} from "../controllers/admin/complaint.controller.js";

import {
  getAllLeaveRequests as getAdminAllLeaveRequests,
  updateLeaveStatus as updateAdminLeaveStatus
} from "../controllers/admin/leave.controller.js";
import {
  issueNotice,
  getAllNotices,
  updateNotice,
  deleteNotice,
  getNoticeTemplates,
  createNoticeTemplate,
  updateNoticeTemplate,
  deleteNoticeTemplate,
  approveNoticeAction,
  rejectNoticeAction,
  approveNoticeTemplateAction,
  rejectNoticeTemplateAction,
  getInventoryItems,
  addInventoryItem,
  bulkUploadInventory,
  bulkDeleteInventory,
  updateInventoryItem,
  updateInventoryReceipt,
  deleteInventoryItem,
  deleteAllInventory,
  replaceInventoryItem,
  generateStockReport,
  generateQRCode,
  downloadQRCode,
  bulkGenerateQRCodes,
  getAvailableRoomsFloors
} from "../controllers/admin/notice_inventory.controller.js";

const router = express.Router();

// login page
router.post("/send-login-otp", sendLoginOTP);
router.post("/login", loginWarden);
router.post("/forgot-password", forgotPasswordWarden);
router.post("/verify-otp", verifyOtpWarden);
router.post("/reset-password", resetPasswordWarden);


// Warden Puch in and Punch out page
router.post('/attendance/punch-in', verifyWardenToken,  punchInWarden);
router.post('/attendance/punch-out', verifyWardenToken,  punchOutWarden);
router.get('/attendance/log', verifyWardenToken, getAttendanceLog);
router.get('/punch-status', verifyWardenToken, checkPunchStatus);

// Warden Attendance Monitoring (For Students & Staff)
router.get('/attendance-monitoring/logs', verifyWardenToken, getAttendanceLogs);
router.get('/attendance-monitoring/stats', verifyWardenToken, getAttendanceStats);
router.get('/attendance/logs', verifyWardenToken, getAttendanceLogs); // Alias for Attendance.jsx
router.get('/attendance/stats', verifyWardenToken, getAttendanceStats); // Alias for Attendance.jsx

// warden Dashboard
router.get("/warden-dashboard", verifyWardenToken, getWardenDashboardStats);


// Bed allotments Management Page
router.get('/bed-stats', getBedStats);
router.get('/bed-status', getBedStatusOverview);


// Student Management.
router.get("/students", getStudentListForWarden);
router.put("/students/:studentId", updateStudentRoom);
router.get('/students/count', getTotalStudents);
router.get('/students/available-bed', getAllAvailableBed);
router.get("/students-without-parents", verifyWardenToken, getStudentsWithoutParents);
router.get('/student-document/:studentId/:docType', getStudentDocument);

import { getParentDocument } from "../controllers/admin/user.controller.js";
router.get('/parent-document/:parentId/:docType', getParentDocument);

router.put("/update-student/:studentId", verifyWardenToken, uploadStudentDocuments, updateStudentWarden);


// Inventory for Warden
router.get("/inventory/stock-report", verifyWardenToken, generateStockReport);
router.get("/inventory/available-rooms-floors", verifyWardenToken, getAvailableRoomsFloors);
router.get("/inventory/available-beds", verifyWardenToken, getAvailableBedsInventory);
router.get("/inventory/available-rooms", verifyWardenToken, getAvailableRoomsInventory);
router.get("/inventory", verifyWardenToken, getInventoryItems);
router.post("/inventory/add", verifyWardenToken, upload.single('receipt'), addInventoryItem);
router.post("/inventory/bulk-upload", verifyWardenToken, upload.single('file'), bulkUploadInventory);
router.post("/inventory/bulk-delete", verifyWardenToken, bulkDeleteInventory);
router.post("/inventory/bulk-qr-generate", verifyWardenToken, bulkGenerateQRCodes);
router.get("/inventory/:id", verifyWardenToken, getInventoryItemById);
router.put("/inventory/:id", verifyWardenToken, upload.single('receipt'), updateInventoryItem);
router.put("/inventory/:id/receipt", verifyWardenToken, upload.single('receipt'), updateInventoryReceipt);
router.post("/inventory/:id/replace", verifyWardenToken, upload.single('receipt'), replaceInventoryItem);
router.post("/inventory/:id/qr-code", verifyWardenToken, generateQRCode);
router.get("/inventory/:id/qr-code/download", verifyWardenToken, downloadQRCode);
router.delete("/inventory/delete-all", verifyWardenToken, deleteAllInventory);
router.delete("/inventory/:id", verifyWardenToken, deleteInventoryItem);

// Audit logs for Warden
router.get('/audit-logs', verifyWardenToken, getAuditLogs);

// Bed occupancy status
router.get("/bed-occupancy-status", verifyWardenToken, getBedOccupancyStatus);


// Invoices for Warden
router.get("/invoices/student", verifyWardenToken, getStudentInvoicesForWarden);



// Inspections Management Page
router.get('/inspections', verifyWardenToken, getWardenInspections);
router.post('/inspections', verifyWardenToken, createWardenInspection);
router.patch('/inspections/:id/status', verifyWardenToken, updateWardenInspectionStatus);
router.delete('/inspections/:id', verifyWardenToken, deleteWardenInspection);
router.get('/inspection-templates', verifyWardenToken, getWardenInspectionTemplates);
router.post('/inspection-templates', verifyWardenToken, createWardenInspectionTemplate);

router.get('/recent-inspections',getRecentInspections);
router.get('/filtered-inspections', getFilteredInspections);
router.get('/recent-inspections/:id', getInspectionById); 
router.patch('/recent-inspections/complete/:id', completeInspection);
router.get('/inspection-stats', getInspectionStats);
router.delete('/recent-inspections/:id', deleteInspection);



// Leave Management Page
router.get('/requested-leave', getWardenAllLeaveRequests);
router.get('/leaves', verifyWardenToken, getAdminAllLeaveRequests); // Alias for w-leave.jsx
router.put('/:leaveId/status', verifyWardenToken, updateLeaveStatusWarden);
router.put('/leaves/:leaveId/status', verifyWardenToken, updateAdminLeaveStatus); // Alias for w-leave.jsx
router.get('/leave-stats', verifyWardenToken, getLeaveRequestStats);
router.get('/leave-filter', verifyWardenToken, filterLeaveRequests);
router.delete('/leave/:leaveId', verifyWardenToken, deleteLeaveRequest);


// Warden Profile Page.
router.get("/profile/:id", getWardenProfile);
router.put("/profile/:id", upload.single("profilePhoto"), updateWardenProfile);
router.get("/all", getAllWarden);
router.get("/wardens", getAllWarden); // Added alias for notices.jsx
router.put("/update/:id", uploadWardenDocuments, updateWarden);
router.delete("/delete/:id", deleteWarden);


// Emergency Contacts.
router.get("/emergency-contact", getEmergencyContacts);
router.put('/emergency-contact/:studentId', updateEmergencyContact);


// Student Intern Registration and Management
router.post("/register-worker", verifyWardenToken, uploadStudentDocuments, registerIntern);
router.get("/workers", getAllInterns);


// Student Registration
router.post("/register-student", verifyWardenToken, uploadStudentDocuments, registerStudent);

// Staff Registration
router.post("/register-staff", verifyWardenToken, uploadParentDocuments, registerStaffWarden);


// Parent Registration and Management
router.post("/register-parent", verifyWardenToken, uploadParentDocuments, registerParent);
router.get("/parents", getAllParents);
router.put("/update-parent/:id", verifyWardenToken, uploadParentDocuments, updateParentWarden);
router.delete("/delete-parent/:id", verifyWardenToken, deleteParentWarden);


// Requisitions
router.get("/requisitions", verifyWardenToken, getWardenRequisitions);
router.post("/submit-notice-requisition", verifyWardenToken, submitNoticeRequisition);
router.post("/submit-inventory-replacement", verifyWardenToken, upload.fields([{ name: 'photo' }]), submitInventoryReplacement);


// Notices Management for Warden
router.get("/notices", verifyWardenToken, getAllNotices);
router.get("/notice-templates", verifyWardenToken, getNoticeTemplates);
router.post("/notice-templates", verifyWardenToken, createNoticeTemplate);
router.put("/notice-templates/:id", verifyWardenToken, updateNoticeTemplate);
router.delete("/notice-templates/:id", verifyWardenToken, deleteNoticeTemplate);
router.post("/issue-notice", verifyWardenToken, issueNotice);
router.put("/notices/:noticeId", verifyWardenToken, updateNotice);
router.delete("/notices/:noticeId", verifyWardenToken, deleteNotice);
router.put('/notices/:noticeId/approve', verifyWardenToken, approveNoticeAction);
router.put('/notices/:noticeId/reject', verifyWardenToken, rejectNoticeAction);
router.patch('/notice-templates/:id/approve', verifyWardenToken, approveNoticeTemplateAction);
router.patch('/notice-templates/:id/reject', verifyWardenToken, rejectNoticeTemplateAction);

// ====================== COMPLAINT MANAGEMENT ROUTES ======================
router.get('/complaints', verifyWardenToken, getAllComplaints);
router.get('/complaints/pending', verifyWardenToken, getOpenComplaints);
router.get('/complaints/inprogress', verifyWardenToken, getInProgressComplaints);
router.get('/complaints/resolved', verifyWardenToken, getResolvedComplaints);
router.get('/complaints/rejected', verifyWardenToken, getRejectedComplaints);
router.get('/complaints/statistics', verifyWardenToken, getComplaintStatistics);
router.get('/complaints/:complaintId', verifyWardenToken, getComplaintDetails);
router.get('/complaints/:complaintId/attachment/:attachmentId', verifyWardenToken, getComplaintAttachment);
router.put('/complaints/:complaintId/status', verifyWardenToken, updateComplaintStatus);
router.put('/complaints/bulk-status', verifyWardenToken, bulkUpdateComplaintStatus);

export default router;




