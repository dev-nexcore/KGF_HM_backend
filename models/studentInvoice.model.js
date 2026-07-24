import mongoose from 'mongoose';

const studentInvoiceSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  invoiceNumber: {
    type: String,
    required: true,
    unique: true
  },
  amount: {
    type: Number,
    required: true
  },
  paidAmount: {
    type: Number,
    default: 0
  },
  dueDate: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['paid', 'pending', 'overdue', 'pending_verification'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'online', 'bank_transfer', 'razorpay'],
    default: null
  },
  paidDate: {
    type: Date,
    default: null
  },
  invoiceType: {
    type: String,
    required: true
  },
  items: [{
    categoryName: { type: String, required: true },
    amount: { type: Number, required: true }
  }],
  billingCycleStart: {
    type: Date,
    default: null
  },
  billingCycleEnd: {
    type: Date,
    default: null
  },
  description: {
    type: String,
    default: ''
  },
  generatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  // Payment gateway fields
  transactionId: {
    type: String,
    default: null
  },
  parentScreenshot: {
    type: String,
    default: null
  },
  adminScreenshot: {
    type: String,
    default: null
  },
  razorpayPaymentId: {
    type: String,
    default: null
  },
  razorpayOrderId: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

export const StudentInvoice = mongoose.model('StudentInvoice', studentInvoiceSchema);