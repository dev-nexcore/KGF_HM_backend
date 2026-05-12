// Create a new file: models/auditLog.model.js
import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: false, // Changed from true to false
  },
  adminName: {
    type: String,
    required: true // Store admin name for quick display
  },
  actionType: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  targetType: {
    type: String,
    required: true
  },
  targetId: {
    type: String, // Can be studentId, leaveId, complaintId, etc.
    required: false
  },
  targetName: {
    type: String, // Student name, leave type, etc.
    required: false
  },
  sessionInfo: {
    type: String,
    required: false // Optional session identifier for tracking
  },
  additionalData: {
    type: mongoose.Schema.Types.Mixed, // Store any additional context
    required: false
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for better query performance
auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ adminId: 1 });
auditLogSchema.index({ actionType: 1 });

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);