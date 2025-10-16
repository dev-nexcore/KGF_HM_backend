// models/complaint.model.js
import mongoose from "mongoose";

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
      enum: [
        "Noise Disturbance",
        "Maintenance issue",
        "Cleanliness issue",
        "Others",
      ],
    },
    otherComplaintType: {
      type: String,
      default: "",
    },
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    // NEW: Maintenance-specific fields 
    floorNumber: {
      type: String,
      default: null,
    },
    maintenanceItems: [
      {
        type: String,
      },
    ],
    status: {
      type: String,
      enum: ["in progress", "resolved"],
      default: "in progress",
    },
    filedDate: {
      type: Date,
      default: Date.now,
    },
    adminNotes: {
      type: String,
      default: "",
    },
    // Attachments
    attachments: [
      {
        filename: {
          type: String,
          required: true,
        },
        originalName: {
          type: String,
          required: true,
        },
        mimeType: {
          type: String,
          required: true,
        },
        size: {
          type: Number,
          required: true,
        },
        path: {
          type: String,
          required: true,
        },
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Index for better query performance
complaintSchema.index({ studentId: 1, status: 1 });
complaintSchema.index({ filedDate: -1 });
complaintSchema.index({ complaintType: 1 }); 

export const Complaint = mongoose.model("Complaint", complaintSchema);
