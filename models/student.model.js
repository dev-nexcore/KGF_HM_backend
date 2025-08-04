import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const studentSchema = new mongoose.Schema({
  // studentName: { type: String, required: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  studentId: { type: String, required: true, unique: true },
  contactNumber: { type: String, required: true },
  // roomBedNumber: { type: String, required: true },
  roomBedNumber: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Inventory',
    required: true
  },
  profileImage: { type: String, default: null },
  email: { type: String, required: true, unique: true },
  admissionDate: { type: Date, required: true },
  feeStatus: { type: String, required: true },
  emergencyContactName: { type: String },
  relation: { type: String },
  emergencyContactNumber: { type: String },
  password: { type: String, required: true },
  attendanceLog: [
    {
      checkInDate: { type: Date, required: true },
      checkOutDate: { type: Date, default: null },
      checkInSelfie: { type: String },
      checkOutSelfie: { type: String },
      checkInLocation: { lat: Number, lng: Number },
      checkOutLocation: { lat: Number, lng: Number }
    }
  ],
});

studentSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

studentSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

export const Student = mongoose.model('Student', studentSchema);


