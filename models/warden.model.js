const mongoose = require('mongoose');

const wardenSchema = new mongoose.Schema({
  name: {
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
  },
  phone: {
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

module.exports = mongoose.model('Warden', wardenSchema);
