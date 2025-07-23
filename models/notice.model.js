
import mongoose from 'mongoose';

const noticeSchema = new mongoose.Schema({
  template: String,
  title: { type: String, required: true },
  message: { type: String, required: true },
  issueDate: { type: Date, required: true },
  recipientType: {
    type: String,
    enum: ['All', 'Student', 'Parent', 'Warden'],
    required: true,
  },
  individualRecipient: String
}, { timestamps: true });

export const Notice = mongoose.model("Notice", noticeSchema);
