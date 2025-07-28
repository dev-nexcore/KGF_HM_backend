import mongoose from 'mongoose';

const staffSalarySchema = new mongoose.Schema({
  staffId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Warden',
    required: true
  },
  month: {
    type: String,
    required: true // "2025-07"
  },
  year: {
    type: Number,
    required: true
  },
  basicSalary: {
    type: Number,
    required: true
  },
  allowances: {
    type: Number,
    default: 0
  },
  deductions: {
    type: Number,
    default: 0
  },
  tax: {
    type: Number,
    default: 0
  },
  pf: {
    type: Number,
    default: 0
  },
  loanDeduction: {
    type: Number,
    default: 0
  },
  netSalary: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['paid', 'pending', 'processing'],
    default: 'pending'
  },
  paymentDate: {
    type: Date,
    default: null
  },
  paymentMethod: {
    type: String,
    enum: ['bank_transfer', 'cash', 'cheque'],
    default: 'bank_transfer'
  },
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  }
}, {
  timestamps: true
});

// Ensure unique salary record per staff per month
staffSalarySchema.index({ staffId: 1, month: 1, year: 1 }, { unique: true });

export const StaffSalary = mongoose.model('StaffSalary', staffSalarySchema);