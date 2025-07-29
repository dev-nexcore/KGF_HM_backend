// models/inventory.model.js
import mongoose from 'mongoose';

const inventorySchema = new mongoose.Schema({
  itemName: { type: String, required: true },
  barcodeId: { type: String, required: true, unique: true },
  category: { type: String, required: true },
  location: { type: String, required: true },
  floor: { type: String, required: true },
  roomNo: { type: String, required: true },
  status: {
    type: String,
    enum: ['Available', 'In Use', 'In maintenance', 'Damaged'],
    default: 'Available'
  },
  description: { type: String },
  purchaseDate: { type: Date },
  purchaseCost: { type: Number },
  receiptUrl: { type: String }, // File upload path or Cloudinary link
  qrCodeUrl: { type: String, default: null }  // <— add this
}, { timestamps: true });

export const Inventory = mongoose.model('Inventory', inventorySchema);
