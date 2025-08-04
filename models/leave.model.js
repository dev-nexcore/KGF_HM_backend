import mongoose from 'mongoose';

const leaveSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true,
  },
  leaveType: {
    type: String,
    required: true,
    enum: ['Sick Leave', 'Casual Leave', 'Vacation', 'Others'],
  },
  otherLeaveType: {
    type: String,
    default: '',
  },
  startDate: {
    type: Date,
    required: true,
  },
  endDate: {
    type: Date,
    required: true,
  },
  reason: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  },
  adminComments: {
    type: String,
    default: null,
  },
  appliedAt: {
    type: Date,
    default: Date.now,
  },
  processedAt: {
    type: Date,
    default: null,
  },
  parentComment: { type: String, default: '' },
  parentApprovalDate: { type: Date },
});

export const Leave = mongoose.model('Leave', leaveSchema);
