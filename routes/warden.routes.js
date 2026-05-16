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
  getAllLeaveRequests,
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
  getAvailableRoomsInventory,
  getInventoryItemById,
  getStudentInvoicesForWarden,
  updateParentWarden,
  deleteParentWarden,
  submitNoticeRequisition,
  submitInventoryReplacement
} from "../controllers/warden.controller.js";
import { upload } from "../middleware/upload.js";
import { verifyWardenToken } from "../middleware/auth.middleware.js";

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
router.put("/update-student/:studentId", verifyWardenToken, upload.fields([{ name: 'aadharCard' }, { name: 'panCard' }, { name: 'studentIdCard' }, { name: 'feesReceipt' }]), updateStudentWarden);


// Inventory for Warden
router.get("/inventory/available-beds", verifyWardenToken, getAvailableBedsInventory);
router.get("/inventory/available-rooms", verifyWardenToken, getAvailableRoomsInventory);
router.get("/inventory/:id", verifyWardenToken, getInventoryItemById);


// Invoices for Warden
router.get("/invoices/student", verifyWardenToken, getStudentInvoicesForWarden);



// Inspections Management Page
router.get('/recent-inspections',getRecentInspections);
router.get('/filtered-inspections', getFilteredInspections);
router.get('/recent-inspections/:id', getInspectionById); 
router.patch('/recent-inspections/complete/:id', completeInspection);
router.get('/inspection-stats', getInspectionStats);
router.delete('/recent-inspections/:id', deleteInspection);



// Leave Management Page
router.get('/requested-leave', getAllLeaveRequests);
router.put('/:leaveId/status', verifyWardenToken, updateLeaveStatusWarden);
router.get('/leave-stats', verifyWardenToken, getLeaveRequestStats);
router.get('/leave-filter', verifyWardenToken, filterLeaveRequests);
router.delete('/leave/:leaveId', verifyWardenToken, deleteLeaveRequest);


// Warden Profile Page.
router.get("/profile/:id", getWardenProfile);
router.put("/profile/:id", upload.single("profilePhoto"), updateWardenProfile);
router.get("/all", getAllWarden);
router.put("/update/:id", updateWarden);
router.delete("/delete/:id", deleteWarden);


// Emergency Contacts.
router.get("/emergency-contact", getEmergencyContacts);
router.put('/emergency-contact/:studentId', updateEmergencyContact);


// Student Intern Registration and Management
router.post("/register-worker", verifyWardenToken, upload.fields([{ name: 'aadharCard' }, { name: 'panCard' }]), registerIntern);
router.get("/workers", getAllInterns);


// Student Registration
router.post("/register-student", verifyWardenToken, upload.fields([{ name: 'aadharCard' }, { name: 'panCard' }]), registerStudent);


// Parent Registration and Management
router.post("/register-parent", verifyWardenToken, upload.fields([{ name: 'aadharCard' }, { name: 'panCard' }]), registerParent);
router.get("/parents", getAllParents);
router.put("/update-parent/:id", verifyWardenToken, updateParentWarden);
router.delete("/delete-parent/:id", verifyWardenToken, deleteParentWarden);


// Requisitions
router.get("/requisitions", verifyWardenToken, getWardenRequisitions);
router.post("/submit-notice-requisition", verifyWardenToken, submitNoticeRequisition);
router.post("/submit-inventory-replacement", verifyWardenToken, upload.fields([{ name: 'photo' }]), submitInventoryReplacement);


export default router;




