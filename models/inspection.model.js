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
    trim: true
  },
  createdBy: {
    type: String,
    required: true
  },
  status: {
      type: String,
      enum: ["pending", "completed"],
      default: "pending",
    },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export const Inspection = mongoose.model("Inspection", inspectionSchema);