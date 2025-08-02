import 'dotenv/config';
import { Admin } from '../../models/admin.model.js'; // ← FIX: Update path for nested folder
import { Otp } from '../../models/otp.model.js'; // ← ADD: Missing import
import nodemailer from 'nodemailer';
import jwt from 'jsonwebtoken';
import { createAuditLog, AuditActionTypes } from '../../utils/auditLogger.js'; // ← FIX: Update path
import bcrypt from 'bcrypt';
// configure SMTP transporter
const transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: +process.env.MAIL_PORT,
    secure: process.env.MAIL_SECURE === 'true',
    auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS
    }
});

const generateToken = (admin) => {
  return jwt.sign(
    { adminId: admin.adminId, email: admin.email }, 
    process.env.JWT_SECRET, 
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );
};

const generateRefreshToken = (admin) => {
  const refreshToken = jwt.sign(
    { adminId: admin.adminId, email: admin.email },
    process.env.JWT_SECRET, // Same secret as access token
    { expiresIn: "30d" } // Longer expiration for refresh token (e.g., 30 days)
  );
  
  // Save refresh token to database (MongoDB)
  admin.refreshToken = refreshToken;
  admin.save(); // Save to database
  
  return refreshToken;
};

const register = async (req, res) => {
  const { adminId, email, password } = req.body;

  try {
    const existingAdmin = await Admin.findOne({ $or: [{ adminId }, { email }] });
    if (existingAdmin) {
      return res.status(409).json({ message: "Admin already exists with same ID or email." });
    }

    const newAdmin = new Admin({ adminId, email, password });
    await newAdmin.save();

    // Create audit log for registration
    await createAuditLog({
      adminId: newAdmin._id,
      adminName: newAdmin.adminId,
      actionType: 'Admin Registered',
      description: `New admin registered: ${adminId}`,
      targetType: 'System'
    });

    return res.status(201).json({ message: "Admin registered successfully." });
  } catch (err) {
    console.error("Admin registration error:", err);
    return res.status(500).json({ message: "Server error during registration." });
  }
};

const login = async (req, res) => {
  const { adminId, password } = req.body;

  try {
    const admin = await Admin.findOne({ adminId });
    if (!admin) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isMatch = await admin.comparePassword(password,admin.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = generateToken(admin);
    const refreshToken = generateRefreshToken(admin);

    // Create audit log for login
    await createAuditLog({
      adminId: admin._id,
      adminName: admin.adminId,
      actionType: AuditActionTypes.ADMIN_LOGIN,
      description: `Admin ${admin.adminId} logged in successfully`,
      targetType: 'System'
    });

    return res.json({ 
      message: "Login successful",
      token,
      refreshToken,
      admin: { 
        adminId: admin.adminId, 
        adminEmail: admin.email 
      } 
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ message: "Server error during login." });
  }
};

const refreshAccessToken = async (req, res) => {
  const { refreshToken } = req.body;

  try {
    if (!refreshToken) {
      return res.status(401).json({ message: "No refresh token provided" });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET); // ← FIX: Use process.env.JWT_SECRET

    const admin = await Admin.findOne({ adminId: decoded.adminId });
    if (!admin || admin.refreshToken !== refreshToken) { // ← FIX: Use refreshToken not refreshTokens
      return res.status(401).json({ message: "Invalid or expired refresh token" });
    }

    const newAccessToken = generateToken(admin); // New access token
    const newRefreshToken = generateRefreshToken(admin); // New refresh token
    
    return res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken
    });
  } catch (err) {
    console.error("Refresh token error:", err);
    return res.status(401).json({ message: "Invalid or expired refresh token" });
  }
};

const forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(400).json({ message: "Email not recognized" });
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const expires = new Date(Date.now() + 10 * 60 * 1000); // ← FIX: Add missing expires variable

    await Otp.findOneAndUpdate(
      { email },
      { code: otp, expires, verified: false },
      { upsert: true }
    );

    await transporter.sendMail({
      from: `"Hostel Admin" <${process.env.MAIL_USER}>`,
      to: email,
      subject: "Admin Password Reset OTP",
      text: `Your OTP is ${otp}. Expires in 10 minutes.`
    });

    return res.json({ message: "OTP sent" });
  } catch (err) {
    console.error("Forgot password error:", err);
    return res.status(500).json({ message: "Server error while sending OTP." });
  }
};

const verifyOtp = async (req, res) => {
  const { email, otp } = req.body;

  try {
    const record = await Otp.findOne({ email, code: otp }); // ← FIX: Add missing const declaration
    if (
      !record ||
      record.code !== otp ||
      record.expires < Date.now()
    ) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }
    
    record.verified = true;
    await record.save(); // ← FIX: Save the record

    return res.json({ message: 'OTP verified' });
  } catch (err) {
    console.error("Verify OTP error:", err);
    return res.status(500).json({ message: "Server error while verifying OTP." });
  }
};

const resetPassword = async (req, res) => {
  const { email, otp, newPassword } = req.body;
  const record = await Otp.findOne({ email, code: otp, verified: true });

  if (!record || record.code !== otp || !record.verified) {
    return res.status(400).json({ message: "OTP not verified" });
  }

  const admin = await Admin.findOne({ email });
  if (!admin) {
    return res.status(404).json({ message: "Admin not found" });
  }

  // const hashedPassword = await bcrypt.hash(newPassword, 10);
  // admin.password = hashedPassword;
  admin.password = newPassword; // just for resetting the password . 
  await admin.save();

  await Otp.deleteOne({ email });

  return res.json({ message: "Password has been reset" });
};

export{
    register,
    login,
    generateRefreshToken,
    refreshAccessToken,
    forgotPassword,
    verifyOtp,
    resetPassword
}