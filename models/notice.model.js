
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
  }
},
 { timestamps: true });

export const Notice = mongoose.model("Notice", noticeSchema);
