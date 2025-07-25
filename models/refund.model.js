import mongoose from "mongoose";

const refundSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    refundType: {
      type: String,
      required: true,
      enum: ["Security Deposit", "Fee Refund", "Other"],
    },
    amount: {
      type: Number,
      required: true,
    },
    reason: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "refunded", "rejected"],
      default: "pending",
    },
    requestedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

export const Refund = mongoose.model("Refund", refundSchema);
