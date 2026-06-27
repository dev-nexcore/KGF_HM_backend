// models/notice.model.js
import mongoose from 'mongoose';

const noticeSchema = new mongoose.Schema({
  template: String,
  title: { type: String, required: true },
  message: { type: String, required: true },
  issueDate: { type: Date, required: true },
  recipientType: {
    type: String,
    enum: ['All', 'Student', 'Parent', 'Warden', 'Worker'],
    required: true,
  },
  expiryDate: { type: Date },
   isIssued: { type: Boolean, default: false },
   createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
   creatorName: { type: String },
  readBy: [{
    studentId: {
      type: String,
      required: true
    },
    readAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  individualRecipient: String,
   readStatus: {
    type: String,
    enum: ['Read', 'Unread'],
    default: 'Unread'
  },
  status: {
    type: String,
    enum: ['Active', 'Scheduled', 'Archived', 'Pending Approval', 'Pending Edit', 'Pending Deletion', 'Rejected'],
    default: 'Active'
  },
  pendingAction: {
    type: String,
    enum: ['Create', 'Edit', 'Delete', 'None'],
    default: 'None'
  },
  pendingActionBy: {
    type: String,
    default: ''
  },
  rejectionReason: {
    type: String,
    default: ''
  },
  pendingData: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  }
},

 { timestamps: true });

export const Notice = mongoose.model("Notice", noticeSchema);
