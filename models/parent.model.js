import mongoose from "mongoose";
import bcrypt from "bcrypt";

const parentSchema = new mongoose.Schema({
  studentId: {
    type: String,
    required: true,
    unique: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    select: false // This ensures password is not included by default
  },
  firstName: {
    type: String,
    required: true
  },
  lastName: {
    type: String,
    required: true
  },
  contactNumber: {
    type: String,
    required: true
  },
  refreshToken: {
    type: String,
    select: false // Also hide refresh token by default
  }
}, {
  timestamps: true // Add createdAt and updatedAt fields
});

// Password hash middleware
parentSchema.pre("save", async function (next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified("password")) return next();
  
  try {
    // Hash password with cost of 12 (more secure than 10)
    this.password = await bcrypt.hash(this.password, 12);
    next();
  } catch (error) {
    next(error);
  }
});

// Password verification method
parentSchema.methods.comparePassword = async function (candidatePassword) {
  try {
    if (!candidatePassword || !this.password) {
      return false;
    }
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    console.error("Password comparison error:", error);
    return false;
  }
};

// Remove password from JSON output
parentSchema.methods.toJSON = function() {
  const parentObject = this.toObject();
  delete parentObject.password;
  delete parentObject.refreshToken;
  return parentObject;
};

export const Parent = mongoose.models.Parent || mongoose.model("Parent", parentSchema);