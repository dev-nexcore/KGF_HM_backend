import 'dotenv/config';
import nodemailer from 'nodemailer';
import bcrypt from 'bcrypt';
import { Parent } from '../models/parentModel.js';
import { Student } from '../models/studentModel.js';

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

// Login controller for parent panel
const login = async (req, res) => {
  const { studentId, password } = req.body;

  try {
    // Find parent by studentId
    const parent = await Parent.findOne({ studentId });
    if (!parent) {
      return res.status(401).json({ message: "Invalid student ID" });
    }

    // Verify password
    const isMatch = await parent.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid password" });
    }

    return res.json({ message: "Login successful", studentId });
  } catch (err) {
    console.error("Parent login error:", err);
    return res.status(500).json({ message: "Server error during login." });
  }
};

// Forgot password controller for parent panel
const forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const parent = await Parent.findOne({ email });
    if (!parent) {
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
      subject: "Parent Password Reset OTP",
      text: `Dear ${parent.firstName} ${parent.lastName},\n\nYour OTP for password reset is ${otp}. It expires in 10 minutes.\n\n– Hostel Admin`
    });

    return res.json({ message: "OTP sent" });
  } catch (err) {
    console.error("Forgot password error:", err);
    return res.status(500).json({ message: "Server error during OTP generation." });
  }
};

// Verify OTP controller for parent panel
const verifyOtp = (req, res) => {
  const { email, otp } = req.body;
  const record = otpStore[email];

  if (!record || record.code !== otp || record.expires < Date.now()) {
    return res.status(400).json({ message: "Invalid or expired OTP" });
  }

  record.verified = true;
  return res.json({ message: "OTP verified" });
};

// Reset password controller for parent panel
const resetPassword = async (req, res) => {
  const { email, otp, newPassword } = req.body;
  const record = otpStore[email];

  if (!record || record.code !== otp || !record.verified) {
    return res.status(400).json({ message: "OTP not verified" });
  }

  try {
    const parent = await Parent.findOne({ email });
    if (!parent) {
      return res.status(404).json({ message: "Parent not found" });
    }

    parent.password = await bcrypt.hash(newPassword, 10);
    await parent.save();

    delete otpStore[email];

    return res.json({ message: "Password has been reset" });
  } catch (err) {
    console.error("Reset password error:", err);
    return res.status(500).json({ message: "Server error during password reset." });
  }
};

// Dashboard controller for parent panel
const dashboard = async (req, res) => {
  const { studentId } = req.body;

  try {
    // Find student by studentId
    const student = await Student.findOne({ studentId });
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    // Extract and structure the dashboard details
    const dashboardData = {
      studentInfo: {
        studentId: student.studentId,
        firstName: student.firstName,
        lastName: student.lastName,
        photo: student.photo || null,
        documents: student.documents.map(doc => ({
          name: doc.name,
          status: doc.status,
          url: doc.url
        }))
      },
      hostelDetails: {
        status: student.hostelDetails.status,
        roomNo: student.hostelDetails.roomNo,
        bedNo: student.hostelDetails.bedNo
      },
      attendanceSummary: {
        totalDays: student.attendanceSummary?.totalDays || 0,
        presentDays: student.attendanceSummary?.presentDays || 0,
        absentDays: student.attendanceSummary?.absentDays || 0
      },
      feesOverview: {
        status: student.feeStatus || "Not Available",
        amountDue: student.feeStatus === "Pending" ? student.feeAmount || 0 : 0
      }
    };

    return res.json(dashboardData);
  } catch (err) {
    console.error("Dashboard fetch error:", err);
    return res.status(500).json({ message: "Server error while fetching dashboard data." });
  }
};

// Attendance controller for parent panel
const attendance = async (req, res) => {
  const { studentId } = req.body;

  try {
    // Find student by studentId
    const student = await Student.findOne({ studentId });
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    // Extract and structure attendance details
    const attendanceData = {
      studentId: student.studentId,
      firstName: student.firstName,
      lastName: student.lastName,
      attendanceSummary: {
        totalDays: student.attendanceSummary?.totalDays || 0,
        presentDays: student.attendanceSummary?.presentDays || 0,
        absentDays: student.attendanceSummary?.absentDays || 0,
        attendancePercentage: student.attendanceSummary?.totalDays > 0
          ? ((student.attendanceSummary.presentDays / student.attendanceSummary.totalDays) * 100).toFixed(2)
          : 0
      }
    };

    return res.json(attendanceData);
  } catch (err) {
    console.error("Attendance fetch error:", err);
    return res.status(500).json({ message: "Server error while fetching attendance data." });
  }
};

export { login, forgotPassword, verifyOtp, resetPassword, dashboard, attendance };