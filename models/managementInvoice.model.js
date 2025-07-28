import mongoose from 'mongoose';

const managementInvoiceSchema = new mongoose.Schema({
  invoiceNumber: {
    type: String,
    required: true,
    unique: true
  },
  vendorName: {
    type: String,
    required: true
  },
  itemDescription: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  category: {
    type: String,
    enum: ['maintenance', 'utilities', 'supplies', 'food', 'cleaning', 'security', 'other'],
    required: true
  },
  purchaseDate: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['approved', 'pending', 'rejected'],
    default: 'pending'
  },
  paymentDate: {
    type: Date,
    default: null
  },
  receiptUrl: {
    type: String // File upload path
  },
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  adminNotes: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

export const ManagementInvoice = mongoose.model('ManagementInvoice', managementInvoiceSchema);