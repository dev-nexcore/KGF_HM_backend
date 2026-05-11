// // models/inventory.model.js
// import mongoose from 'mongoose';


// const inventorySchema = new mongoose.Schema({
//   itemName: { type: String, required: true },
//   barcodeId: { type: String, required: true, unique: true },
//   category: { type: String, required: true },
//   location: { type: String, required: true },
//   floor: { type: String, required: true },
//   roomNo: { type: String, required: true },
//   status: {
//     type: String,
//     enum: ['Available', 'In Use', 'In maintenance', 'Damaged'],
//     default: 'Available'
//   },
//   description: { type: String },
//   purchaseDate: { type: Date },
//   purchaseCost: { type: Number },
//   receiptUrl: { type: String }, // File upload path or Cloudinary link
//   qrCodeUrl: { type: String, default: null },
//   publicSlug: { type: String, unique: true, index: true } // <-- ensure this is always present and indexed
// }, { timestamps: true });

// export const Inventory = mongoose.model('Inventory', inventorySchema);



// models/inventory.model.js

import mongoose from 'mongoose';

const replacementRequestSchema = new mongoose.Schema({
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Warden"
  },

  oldItemReason: {
    type: String,
    required: true
  },

  replacementItemName: {
    type: String
  },

  replacementCategory: {
    type: String
  },

  replacementStatus: {
    type: String,
    enum: ["Pending", "Approved", "Rejected"],
    default: "Pending"
  },

  adminRemark: {
    type: String,
    default: ""
  },

  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Admin",
    default: null
  },

  approvedAt: {
    type: Date,
    default: null
  }

}, { timestamps: true });


const inventorySchema = new mongoose.Schema({

  itemName: { type: String, required: true },

  barcodeId: {
    type: String,
    required: true,
    unique: true
  },

  category: { type: String, required: true },

  location: { type: String, required: true },

  floor: { type: String, required: true },

  roomNo: { type: String, required: true },

  status: {
    type: String,
    default: 'Available'
  },

  description: { type: String },

  purchaseDate: { type: Date },

  purchaseCost: { type: Number },

  receiptUrl: { type: String },

  qrCodeUrl: {
    type: String,
    default: null
  },

  publicSlug: {
    type: String,
    unique: true,
    index: true
  },

  // ✅ ADD THIS
  replacementRequest: {
    type: replacementRequestSchema,
    default: null
  }

}, { timestamps: true });

export const Inventory = mongoose.model(
  'Inventory',
  inventorySchema
);