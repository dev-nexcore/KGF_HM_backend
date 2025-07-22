import mongoose from 'mongoose';

const studentSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  studentId: { type: String, required: true, unique: true },
  contactNumber: { type: String, required: true },
  roomBedNumber: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  admissionDate: { type: Date, required: true },
  feeStatus: { type: String, required: true },
  emergencyContactName: { type: String },
  emergencyContactNumber: { type: String },
  password: { type: String, required: true },
  checkInDate: { type: Date, default: null },
  checkOutDate: { type: Date, default: null },
});

export const Student = mongoose.model('Student', studentSchema);


