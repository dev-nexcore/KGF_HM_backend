import mongoose from 'mongoose';

const complaintSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    complaintType: {
      type: String,
      required: true,
      enum: ["Maintenance issue", "Noice Disturbance", "Damages fee"],
    },
    subject: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["resolved", "in progress"],
      default: "in progress",
    },
    filedDate: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

export const Complaint = mongoose.model("Complaint", complaintSchema);
