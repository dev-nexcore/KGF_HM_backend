import 'dotenv/config';
import { Admin } from '../../models/admin.model.js'; // ← FIX: Update path for nested folder
import { Otp } from '../../models/otp.model.js'; // ← ADD: Missing import
import nodemailer from 'nodemailer';
import jwt from 'jsonwebtoken';
import { createAuditLog, AuditActionTypes } from '../../utils/auditLogger.js'; // ← FIX: Update path
import { sendWhatsAppMessage } from '../../utils/sendWhatsApp.js';
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
  const { adminId, email, password, contactNumber } = req.body;  // ADD contactNumber

  try {
    // Validate phone number format
    if (!contactNumber || contactNumber.length < 10) {
      return res.status(400).json({ message: "Valid contact number is required" });
    }

    const existingAdmin = await Admin.findOne({ 
      $or: [{ adminId }, { email }, { contactNumber }]  // Check phone too
    });
    
    if (existingAdmin) {
      return res.status(409).json({ 
        message: "Admin already exists with same ID, email, or contact number." 
      });
    }

    const newAdmin = new Admin({ adminId, email, password, contactNumber });
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
const sendLoginOTP = async (req, res) => {
  const { adminId } = req.body;

  if (!adminId) {
    return res.status(400).json({ message: "Admin ID is required" });
  }

  try {
    // Find admin by adminId
    const admin = await Admin.findOne({ adminId });
    if (!admin) {
      return res.status(404).json({ message: "Admin account not found" });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Set OTP expiry (5 minutes from now)
    const otpExpiry = new Date(Date.now() + 5 * 60 * 1000);

    // Save OTP record
    await Otp.findOneAndUpdate(
      { email: admin.email },
      { 
        code: otp, 
        expires: otpExpiry, 
        verified: false, 
        purpose: 'admin_login' 
      },
      { upsert: true }
    );

    // Send OTP via WhatsApp
    if (admin.contactNumber) {
      await sendWhatsAppMessage(
        admin.contactNumber, 
        `Hello Admin,\n\nYour OTP for admin panel login is: *${otp}*\n\nValid for 5 minutes.\n\n– Hostel Management System`
      );
    } else {
      return res.status(400).json({ message: "Admin contact number not found" });
    }

    // Optional: Also send via email as backup
    await transporter.sendMail({
      from: `"Hostel Admin" <${process.env.MAIL_USER}>`,
      to: admin.email,
      subject: 'Admin Login OTP',
      text: `Hello Admin,\n\nYour OTP for admin panel login is: ${otp}\n\nThis OTP is valid for 5 minutes only.\n\n– Hostel Admin`
    });

    return res.json({
      message: 'OTP sent successfully to your WhatsApp',
      contactNumber: admin.contactNumber.replace(/(\d{2})(\d+)(\d{4})/, '$1****$3'), // Mask number
      expiresIn: '5 minutes'
    });

  } catch (err) {
    console.error("Error sending admin login OTP:", err);
    return res.status(500).json({ message: "Error sending OTP" });
  }
};

// UPDATED: Login with OTP verification
const login = async (req, res) => {
  const { adminId, otp } = req.body;

  if (!adminId || !otp) {
    return res.status(400).json({ message: "Admin ID and OTP are required" });
  }

  try {
    // Find admin by adminId
    const admin = await Admin.findOne({ adminId });
    if (!admin) {
      return res.status(401).json({ message: "Invalid Admin ID" });
    }

    // Find OTP record
    const otpRecord = await Otp.findOne({ 
      email: admin.email, 
      code: otp, 
      purpose: 'admin_login'
    });

    if (!otpRecord) {
      return res.status(401).json({ message: "Invalid OTP" });
    }

    // Check if OTP is expired
    if (new Date() > otpRecord.expires) {
      await Otp.deleteOne({ _id: otpRecord._id });
      return res.status(401).json({ message: "OTP has expired. Please request a new OTP." });
    }

    // OTP is valid, delete it
    await Otp.deleteOne({ _id: otpRecord._id });

    // Generate tokens
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
    console.error("Admin login error:", err);
    return res.status(500).json({ message: "Server error during login" });
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
    sendLoginOTP,
    login,
    generateRefreshToken,
    refreshAccessToken,
    forgotPassword,
    verifyOtp,
    resetPassword
}