import mongoose from "mongoose";

const feeSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Student",
    required: true,
  },
  feeType: {
    type: String,
    required: true,
    enum: ["Hostel", "Mess", "Maintenance", "Other"],
  },
  amount: { type: Number, required: true },
  status: {
    type: String,
    enum: ["paid", "unpaid", "overdue"],
    default: "unpaid",
  },
  dueDate: { type: Date, required: true },
}, { timestamps: true });

export const Fee = mongoose.model("Fee", feeSchema);
