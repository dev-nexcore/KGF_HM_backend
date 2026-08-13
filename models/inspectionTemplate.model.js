import mongoose from "mongoose";

const inspectionTemplateSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  target: {
    type: String,
    trim: true
  },
  area: {
    type: String,
    trim: true
  },
  instructions: {
    type: String,
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export const InspectionTemplate = mongoose.model("InspectionTemplate", inspectionTemplateSchema);
