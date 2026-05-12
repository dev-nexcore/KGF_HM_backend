import mongoose from 'mongoose';

const requisitionSchema = new mongoose.Schema({
  wardenId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Warden',
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String
  },
  items: [{
    itemName: String,
    quantity: Number,
    unit: String,
    estimatedCost: Number
  }],
  totalAmount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'completed'],
    default: 'pending'
  },
  adminRemarks: {
    type: String
  },
  requestedDate: {
    type: Date,
    default: Date.now
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  }
}, {
  timestamps: true
});

export default mongoose.model('Requisition', requisitionSchema);
