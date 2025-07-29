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
  dueDate: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['paid', 'pending', 'overdue'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'online', 'bank_transfer'],
    default: null
  },
  paidDate: {
    type: Date,
    default: null
  },
  invoiceType: {
    type: String,
    enum: ['hostel_fee', 'mess_fee', 'security_deposit', 'maintenance_fee', 'other'],
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  generatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  // Future payment gateway fields
  transactionId: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

export const StudentInvoice = mongoose.model('StudentInvoice', studentInvoiceSchema);