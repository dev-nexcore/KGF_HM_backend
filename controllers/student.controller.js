import 'dotenv/config';
import nodemailer from 'nodemailer';
import bcrypt from 'bcrypt';
import { Student } from '../models/student.model.js';

// Simple in-memory store for OTPs
const otpStore = {};

// Configure SMTP transporter
const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: +process.env.MAIL_PORT,
  secure: process.env.MAIL_SECURE === 'true',
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  }
});

// Login controller for student panel
const login = async (req, res) => {
  const { studentId, password } = req.body;

  try {
    // Find student by studentId
    const student = await Student.findOne({ studentId });
    if (!student) {
      return res.status(401).json({ message: "Invalid student ID" });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, student.password); // Assuming password is hashed
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid password" });
    }

    return res.json({ message: "Login successful", studentId });
  } catch (err) {
    console.error("Student login error:", err);
    return res.status(500).json({ message: "Server error during login." });
  }
};

// Forgot password controller for student panel
const forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const student = await Student.findOne({ email });
    if (!student) {
      return res.status(400).json({ message: "Email not recognized" });
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    otpStore[email] = {
      code: otp,
      expires: Date.now() + 10 * 60 * 1000, // 10 minutes expiry
      verified: false
    };

    await transporter.sendMail({
      from: `"Hostel Admin" <${process.env.MAIL_USER}>`,
      to: email,
      subject: "Student Password Reset OTP",
      text: `Dear ${student.firstName} ${student.lastName},\n\nYour OTP for password reset is ${otp}. It expires in 10 minutes.\n\n– Hostel Admin`
    });

    return res.json({ message: "OTP sent" });
  } catch (err) {
    console.error("Forgot password error:", err);
    return res.status(500).json({ message: "Server error during OTP generation." });
  }
};

// Verify OTP controller for student panel
const verifyOtp = (req, res) => {
  const { email, otp } = req.body;
  const record = otpStore[email];

  if (!record || record.code !== otp || record.expires < Date.now()) {
    return res.status(400).json({ message: "Invalid or expired OTP" });
  }

  record.verified = true;
  return res.json({ message: "OTP verified" });
};

// Reset password controller for student panel
const resetPassword = async (req, res) => {
  const { email, otp, newPassword } = req.body;
  const record = otpStore[email];

  if (!record || record.code !== otp || !record.verified) {
    return res.status(400).json({ message: "OTP not verified" });
  }

  try {
    const student = await Student.findOne({ email });
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    student.password = await bcrypt.hash(newPassword, 10);
    await student.save();

    delete otpStore[email];

    return res.json({ message: "Password has been reset" });
  } catch (err) {
    console.error("Reset password error:", err);
    return res.status(500).json({ message: "Server error during password reset." });
  }
};

export { login, forgotPassword, verifyOtp, resetPassword };
