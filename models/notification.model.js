import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true,
  },
  message: String,
  type: String, // e.g., 'notice', 'leave', 'complaint', 'refund'
  link: String, // route to redirect (e.g., `/notices`, `/leave`, etc.)
  seen: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

export const Notification = mongoose.model("Notification", notificationSchema);
