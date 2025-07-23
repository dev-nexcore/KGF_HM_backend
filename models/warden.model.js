import mongoose from 'mongoose';

const wardenSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true,
  },
   lastName: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  wardenId: {
    type: String,
    required: true,
  },
 contactNumber: {
    type: String,
  },
  profilePhoto: {
    type: String, // File path or filename
  },
  resetPasswordToken: {
    type: String,
    default: null,
  },
  resetPasswordExpires: {
    type: Date,
    default: null,
  },
  otpCode: String,
  otpExpires: Date,

}, { timestamps: true });

export const Warden = mongoose.model('Warden', wardenSchema);
