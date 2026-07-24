// Create a new file: utils/auditLogger.js
import { AuditLog } from '../models/auditLog.model.js';

// Helper function to create audit log entries
const createAuditLog = async ({
  adminId,
  adminName,
  actionType,
  description,
  targetType,
  targetId = null,
  targetName = null,
  sessionInfo = null,
  additionalData = null
}) => {
  try {
    const auditLog = new AuditLog({
      adminId,
      adminName,
      actionType,
      description,
      targetType,
      targetId,
      targetName,
      sessionInfo,
      additionalData
    });

    await auditLog.save();
    console.log(`📝 Audit log created: ${actionType} by ${adminName}`);
    return auditLog;
  } catch (error) {
    console.error('Error creating audit log:', error);
    // Don't throw error to prevent disrupting main operations
  }
};

// Generate session identifier (optional)
const generateSessionId = () => {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Predefined audit log templates for common actions
const AuditActionTypes = {
  STUDENT_REGISTERED: 'Student Registered',
  STUDENT_UPDATED:'Student updated',
  PARENT_REGISTERED: 'Parent Registered',
  WARDEN_REGISTERED: 'Warden Registered',
  LEAVE_APPROVED: 'Leave Approved',
  LEAVE_REJECTED: 'Leave Rejected',
  LEAVE_MESSAGE_SENT: 'Leave Message Sent',
  COMPLAINT_RESOLVED: 'Complaint Resolved',
  COMPLAINT_UPDATED: 'Complaint Updated',
  NOTICE_ISSUED: 'Notice Issued',
  NOTICE_UPDATED: 'Notice Updated',
  NOTICE_DELETED: 'Notice Deleted',
  INVENTORY_ADDED: 'Inventory Added',
  INVENTORY_UPDATED: 'Inventory Updated',
  INVENTORY_DELETED: 'Inventory Deleted',
  INVENTORY_STATUS_CHANGED: 'Inventory Status Changed',
  INVENTORY_REPLACEMENT: 'Inventory Replacement',
  ADMIN_LOGIN: 'Admin Login',
  ADMIN_LOGOUT: 'Admin Logout',
  PASSWORD_RESET: 'Password Reset',
  BULK_LEAVE_UPDATE: 'Bulk Leave Update',
  BULK_COMPLAINT_UPDATE: 'Bulk Complaint Update',
  SALARY_GENERATED: 'Salary Generated',
  INVENTORY_BULK_UPLOADED: 'Inventory Bulk Uploaded',
  INVENTORY_BULK_DELETED: 'Inventory Bulk Deleted'
};

export{
    createAuditLog,
    generateSessionId,
    AuditActionTypes
}