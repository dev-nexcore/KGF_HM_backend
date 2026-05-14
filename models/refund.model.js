import mongoose from "mongoose";

const refundSchema = new mongoose.Schema(
  {
    refundId: {
      type: String,
      unique: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    refundType: {
      type: String,
      required: true,
    },
    otherRefundType: {
      type: String,
      default: "",
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
      enum: ["pending", "completed", "rejected"],
      default: "pending",
    },
    paymentMethod: {
      type: String,
      enum: ["bank_transfer", "upi", "cash", "cheque", ""],
      default: "",
    },
    adminNotes: {
      type: String,
      default: "",
    },
    fees: {
      type: Number,
      default: 0,
    },
    securityDeposit: {
      type: Number,
      default: 0,
    },
    deduction: {
      type: Number,
      default: 0,
    },
    deductionReason: {
      type: String,
      default: "",
    },
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
    processedDate: {
      type: Date,
      default: null,
    },
    requestedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

export const Refund = mongoose.model("Refund", refundSchema);
