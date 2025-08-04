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
      enum: ["Maintenance issue", "Noice Disturbance", "Cleanliness issue", "Others"],
    },
    otherComplaintType: {
      type: String,
      default: "",
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
    attachments: [{
    filename: {
      type: String,
      required: true
    },
    originalName: {
      type: String,
      required: true
    },
    mimeType: {
      type: String,
      required: true
    },
    size: {
      type: Number,
      required: true
    },
    path: {
      type: String,
      required: true
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }]
  },
  { timestamps: true }
);

export const Complaint = mongoose.model("Complaint", complaintSchema);
