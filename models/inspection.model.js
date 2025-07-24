import mongoose from "mongoose";

const inspectionSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  target: {
    type: String,
    required: true,
    trim: true
  },
  area: {
    type: String,
    required: true,
    trim:true
  },
  datetime: {
    type: Date,
    required: true
  },
  instructions: {
    type: String,
    required: true,
    trim: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Admin",
    required: true
  },
  status: {
      type: String,
      enum: ["pending", "refunded", "rejected"],
      default: "pending",
    },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export const Inspection = mongoose.model("Inspection", inspectionSchema);