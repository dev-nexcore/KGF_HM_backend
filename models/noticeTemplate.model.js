import mongoose from 'mongoose';

const noticeTemplateSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  title: { type: String, default: "" },
  message: { type: String, default: "" },
  status: {
    type: String,
    enum: ['Active', 'Pending Approval', 'Pending Edit', 'Pending Deletion', 'Rejected'],
    default: 'Active'
  },
  pendingAction: {
    type: String,
    enum: ['None', 'Create', 'Edit', 'Delete'],
    default: 'None'
  },
  pendingData: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Warden',
    default: null
  }
}, { timestamps: true });

export const NoticeTemplate = mongoose.model("NoticeTemplate", noticeTemplateSchema);
