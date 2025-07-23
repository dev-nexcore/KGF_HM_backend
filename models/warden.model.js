import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

// Define the schema
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
    unique: true,
  },
  contactNumber: {
    type: String,
  },
  profilePhoto: {
    type: String, // File path or filename
  },
  attendanceLog: [
    {
      date: { type: Date, required: true },
      punchIn: { type: Date, required: true },
      punchOut: { type: Date },
      totalHours: { type: Number } // in hours
    }
  ],
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

//  Password Hash Middleware
wardenSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

//  Method to Compare Password
wardenSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Export the model
export const Warden = mongoose.model('Warden', wardenSchema);
