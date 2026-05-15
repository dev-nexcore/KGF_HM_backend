import mongoose from "mongoose";

const requisitionSchema = new mongoose.Schema(
  {
    requisitionType: {
      type: String,
      enum: ["student", "parent", "worker", "staff", "notice"],
      required: true,
    },
    
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Warden",
      required: true,
    },
    
    requestedByName: {
      type: String,
      required: true,
    },
    
    data: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    
    documents: {
      aadharCard: {
        filename: { type: String },
        path: { type: String },
        uploadedAt: { type: Date },
      },
      panCard: {
        filename: { type: String },
        path: { type: String },
        uploadedAt: { type: Date },
      },
    },
    
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
    
    approvedByName: {
      type: String,
    },
    
    approvedAt: {
      type: Date,
    },
    
    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
    
    rejectedByName: {
      type: String,
    },
    
    rejectedAt: {
      type: Date,
    },
    
    rejectionReason: {
      type: String,
    },
    
    notes: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

export const Requisition = mongoose.model("Requisition", requisitionSchema);
