import 'dotenv/config';
import { Admin } from '../../models/admin.model.js';
import { Otp } from '../../models/otp.model.js';
import jwt from 'jsonwebtoken';
import { createAuditLog, AuditActionTypes } from '../../utils/auditLogger.js';
import { sendWhatsAppMessage } from '../../utils/sendWhatsApp.js';
import bcrypt from 'bcrypt';

import sendEmail from '../../utils/sendEmail.js';


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
    process.env.JWT_SECRET,
    { expiresIn: "30d" }
  );
  
  admin.refreshToken = refreshToken;
  admin.save();
  
  return refreshToken;
};

const register = async (req, res) => {
  const { adminId, email, password, contactNumber } = req.body;

  try {
    // Validate phone number format
    if (!contactNumber || contactNumber.length < 10) {
      return res.status(400).json({ message: "Valid contact number is required" });
    }

    const existingAdmin = await Admin.findOne({ 
      $or: [{ adminId }, { email }, { contactNumber }]
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

// const sendLoginOTP = async (req, res) => {
//   const { adminId } = req.body;

//   if (!adminId) {
//     return res.status(400).json({ message: "Admin ID is required" });
//   }

//   try {
//     // Find admin by adminId
//     const admin = await Admin.findOne({ adminId });
//     if (!admin) {
//       return res.status(404).json({ message: "Admin account not found" });
//     }

//     // Generate 6-digit OTP
//     const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
//     // Set OTP expiry (5 minutes from now)
//     const otpExpiry = new Date(Date.now() + 5 * 60 * 1000);

//     // Save OTP record
//     await Otp.findOneAndUpdate(
//       { email: admin.email },
//       { 
//         code: otp, 
//         expires: otpExpiry, 
//         verified: false, 
//         purpose: 'admin_login' 
//       },
//       { upsert: true }
//     );

//     // Send OTP via WhatsApp only
//     if (admin.contactNumber) {
//       try {
//         await sendWhatsAppMessage(
//           admin.contactNumber, 
//           `Hello Admin,\n\nYour OTP for admin panel login is: *${otp}*\n\nValid for 5 minutes.\n\n– Hostel Management System`
//         );
//       } catch (whatsappError) {
//         console.error("WhatsApp sending error:", whatsappError);
//         return res.status(500).json({ message: "Failed to send OTP via WhatsApp" });
//       }
//     } else {
//       return res.status(400).json({ message: "Admin contact number not found" });
//     }

//     return res.json({
//       message: 'OTP sent successfully to your WhatsApp',
//       contactNumber: admin.contactNumber.replace(/(\d{2})(\d+)(\d{4})/, '$1****$3'), // Mask number
//       expiresIn: '5 minutes'
//     });

//   } catch (err) {
//     console.error("Error sending admin login OTP:", err);
//     return res.status(500).json({ message: "Error sending OTP" });
//   }
// };

const sendLoginOTP = async (req, res) => {
  const { adminId } = req.body;

  if (!adminId) {
    return res.status(400).json({ message: "Admin ID is required" });
  }

  try {
    const admin = await Admin.findOne({ adminId });
    if (!admin) {
      return res.status(404).json({ message: "Admin account not found" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 5 * 60 * 1000);

    // Save OTP
    await Otp.findOneAndUpdate(
      { email: admin.email, purpose: 'admin_login' },
      { code: otp, expires: otpExpiry },
      { upsert: true }
    );

    /* ---------- SEND EMAIL OTP ---------- */
    try {
      await sendEmail({
        to: admin.email,
        subject: 'Admin Login OTP',
        text: `Hello Admin,

Your OTP for admin panel login is: ${otp}

This OTP is valid for 5 minutes.

– Hostel Management System`
      });
    } catch (mailError) {
      console.error("Email sending error:", mailError);
      return res.status(500).json({ message: "Failed to send OTP via Email" });
    }

    /* ---------- SEND WHATSAPP OTP ---------- */
    if (admin.contactNumber) {
      try {
        await sendWhatsAppMessage(
          admin.contactNumber,
          `Hello Admin,\n\nYour OTP for admin panel login is: *${otp}*\n\nValid for 5 minutes.\n\n– Hostel Management System`
        );
      } catch (whatsappError) {
        console.error("WhatsApp sending error:", whatsappError);
        return res.status(500).json({ message: "Failed to send OTP via WhatsApp" });
      }
    }

    return res.json({
      message: "OTP sent successfully via Email and WhatsApp",
      email: admin.email,
      contactNumber: admin.contactNumber.replace(/(\d{2})(\d+)(\d{4})/, '$1****$3'),
      expiresIn: "5 minutes"
    });

  } catch (err) {
    console.error("Error sending admin login OTP:", err);
    return res.status(500).json({ message: "Error sending OTP" });
  }
};



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

    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);

    const admin = await Admin.findOne({ adminId: decoded.adminId });
    if (!admin || admin.refreshToken !== refreshToken) {
      return res.status(401).json({ message: "Invalid or expired refresh token" });
    }

    const newAccessToken = generateToken(admin);
    const newRefreshToken = generateRefreshToken(admin);
    
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
  const { adminId } = req.body; // Changed from email to adminId for consistency

  try {
    const admin = await Admin.findOne({ adminId });
    if (!admin) {
      return res.status(400).json({ message: "Admin ID not recognized" });
    }

    if (!admin.contactNumber) {
      return res.status(400).json({ message: "No contact number on file" });
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const expires = new Date(Date.now() + 10 * 60 * 1000);

    await Otp.findOneAndUpdate(
      { email: admin.email },
      { code: otp, expires, verified: false, purpose: 'password_reset' },
      { upsert: true }
    );

    // Send OTP via WhatsApp
    try {
      await sendWhatsAppMessage(
        admin.contactNumber,
        `Hello Admin,\n\nYour password reset OTP is: *${otp}*\n\nValid for 10 minutes.\n\n– Hostel Management System`
      );
    } catch (whatsappError) {
      console.error("WhatsApp sending error:", whatsappError);
      return res.status(500).json({ message: "Failed to send OTP via WhatsApp" });
    }

    return res.json({ 
      message: "OTP sent to your WhatsApp",
      contactNumber: admin.contactNumber.replace(/(\d{2})(\d+)(\d{4})/, '$1****$3')
    });
  } catch (err) {
    console.error("Forgot password error:", err);
    return res.status(500).json({ message: "Server error while sending OTP." });
  }
};

const verifyOtp = async (req, res) => {
  const { adminId, otp } = req.body; // Changed from email to adminId

  try {
    const admin = await Admin.findOne({ adminId });
    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    const record = await Otp.findOne({ 
      email: admin.email, 
      code: otp,
      purpose: 'password_reset'
    });

    if (!record || record.expires < Date.now()) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }
    
    record.verified = true;
    await record.save();

    return res.json({ message: 'OTP verified' });
  } catch (err) {
    console.error("Verify OTP error:", err);
    return res.status(500).json({ message: "Server error while verifying OTP." });
  }
};

const resetPassword = async (req, res) => {
  const { adminId, otp, newPassword } = req.body; // Changed from email to adminId

  try {
    const admin = await Admin.findOne({ adminId });
    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    const record = await Otp.findOne({ 
      email: admin.email, 
      code: otp, 
      verified: true,
      purpose: 'password_reset'
    });

    if (!record) {
      return res.status(400).json({ message: "OTP not verified" });
    }

    admin.password = newPassword;
    await admin.save();

    await Otp.deleteOne({ email: admin.email, purpose: 'password_reset' });

    return res.json({ message: "Password has been reset successfully" });
  } catch (err) {
    console.error("Reset password error:", err);
    return res.status(500).json({ message: "Server error while resetting password." });
  }
};

export {
  register,
  sendLoginOTP,
  login,
  generateRefreshToken,
  refreshAccessToken,
  forgotPassword,
  verifyOtp,
  resetPassword
};