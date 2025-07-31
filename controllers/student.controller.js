import "dotenv/config";
import nodemailer from "nodemailer";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { Student } from "../models/student.model.js";
import { Otp } from "../models/otp.model.js";
import { Complaint } from "../models/complaint.model.js";
import { Leave } from "../models/leave.model.js";
import { Refund } from "../models/refund.model.js";
import { Fee } from "../models/fee.model.js";
import { Notice } from "../models/notice.model.js";
import { Inspection } from '../models/inspection.model.js';
import { Inventory } from '../models/inventory.model.js';
// import { Payment } from "../models/payment.model.js";


const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: +process.env.MAIL_PORT,
  secure: process.env.MAIL_SECURE === "true",
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

const login = async (req, res) => {
  const { studentId, password } = req.body;

  try {
    const student = await Student.findOne({ studentId });
    if (!student) {
      return res.status(401).json({ message: "Invalid student ID" });
    }

    const isMatch = await student.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid password" });
    }

    const token = jwt.sign(
      {
        sub: student._id.toString(),
        role: 'student',
        email: student.email,
        studentId: student.studentId,
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      message: "Login successful",
      token,
      student: {
        _id: student._id,
        studentId: student.studentId,
        email: student.email,
        firstName: student.firstName,
        lastName: student.lastName,
      },
    });
  } catch (err) {
    console.error("Student login error:", err);
    return res.status(500).json({ message: "Server error during login." });
  }
};

const LOWER = s => (s || '').trim().toLowerCase();

const forgotPassword = async (req, res) => {
  const emailRaw = req.body?.email;
  const email = LOWER(emailRaw);

  try {
    const student = await Student.findOne({ email });
    if (!student) {
      // You can return 200 for privacy; keeping your current behavior:
      return res.status(400).json({ message: 'Email not recognized' });
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000)); // 6-digit
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    await Otp.findOneAndUpdate(
      { email },
      { code: otp, expires, verified: false },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const firstName = student.firstName || 'Student';
    await transporter.sendMail({
      from: `"Hostel Admin" <${process.env.MAIL_USER}>`,
      to: email,
      subject: 'Student Password Reset OTP',
      text:
        `Dear ${firstName},

Your OTP for password reset is ${otp}.
It expires in 10 minutes.

– Hostel Admin`,
    });

    return res.json({ message: 'OTP sent' });
  } catch (err) {
    console.error('Forgot password error:', err);
    return res.status(500).json({ message: 'Server error during OTP generation.' });
  }
};

const verifyOtp = async (req, res) => {
  const email = (req.body?.email || '').toLowerCase().trim();
  const rawCode = String(req.body?.otp || '').replace(/\D/g, '').slice(0, 6);

  if (rawCode.length !== 6) {
    return res.status(400).json({ message: 'Invalid OTP format' });
  }

  try {
    const otpDoc = await Otp.findOne({ email });
    if (!otpDoc) return res.status(400).json({ message: 'OTP not found. Please request a new one.' });
    if (otpDoc.expires < new Date()) return res.status(400).json({ message: 'OTP expired. Please request a new one.' });
    if (otpDoc.code !== rawCode) return res.status(400).json({ message: 'Incorrect OTP' });

    otpDoc.verified = true;
    await otpDoc.save();

    return res.json({ message: 'OTP verified' }); // no resetToken sent
  } catch (err) {
    console.error('Verify OTP error:', err);
    return res.status(500).json({ message: 'Server error during OTP verification.' });
  }
};

const PASSWORD_REGEX = /^(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

const resetPassword = async (req, res) => {
  const { email, otp, newPassword } = req.body;
  const normalizedEmail = (email || '').toLowerCase().trim();
  const sanitizedOtp = String(otp || '').replace(/\D/g, '').slice(0, 6);

  if (!normalizedEmail || !sanitizedOtp || sanitizedOtp.length !== 6) {
    return res.status(400).json({ message: 'Invalid email or OTP' });
  }

  if (!newPassword || !PASSWORD_REGEX.test(newPassword)) {
    return res.status(400).json({
      message: 'Password must be at least 8 characters, include at least 1 number and 1 special character.',
    });
  }

  try {
    // Find OTP record and check it
    const otpDoc = await Otp.findOne({ email: normalizedEmail });
    if (!otpDoc) return res.status(400).json({ message: 'OTP not found. Please request a new one.' });
    if (otpDoc.expires < new Date()) return res.status(400).json({ message: 'OTP expired. Please request a new one.' });
    if (otpDoc.code !== sanitizedOtp) return res.status(400).json({ message: 'Incorrect OTP' });
    if (!otpDoc.verified) return res.status(400).json({ message: 'OTP not verified. Please verify first.' });

    // Find student by email
    const student = await Student.findOne({ email: normalizedEmail });
    if (!student) return res.status(400).json({ message: 'Student not found' });

    // Set new password and save (bcrypt hook will hash)
    student.password = newPassword;
    await student.save();

    // Remove OTP to prevent reuse
    await Otp.deleteOne({ _id: otpDoc._id });

    return res.json({ message: 'Password has been reset successfully' });
  } catch (err) {
    console.error('Reset password error:', err);
    return res.status(500).json({ message: 'Server error during password reset.' });
  }
};


const checkInStudent = async (req, res) => {
  const { studentId } = req.body;

  try {
    const student = await Student.findOne({ studentId });
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const latestEntry = student.attendanceLog.at(-1); // Get last entry

    // Prevent multiple check-ins without checkout
    if (latestEntry && !latestEntry.checkOutDate) {
      return res.status(400).json({ message: "Already checked in, checkout first" });
    }

    const newCheckIn = {
      checkInDate: new Date()
    };

    student.attendanceLog.push(newCheckIn);
    await student.save();

    const istTime = new Date(newCheckIn.checkInDate).toLocaleString("en-US", {
      timeZone: "Asia/Kolkata",
      hour12: false
    });

    return res.json({
      message: "Check In recorded successfully",
      checkInDate: istTime
    });
  } catch (err) {
    console.error("Check-in error:", err);
    return res.status(500).json({ message: "Server error during check-in." });
  }
};


const checkOutStudent = async (req, res) => {
  const { studentId } = req.body;

  try {
    const student = await Student.findOne({ studentId });
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const latestEntry = student.attendanceLog.at(-1);

    if (!latestEntry || latestEntry.checkOutDate) {
      return res.status(400).json({ message: "No active check-in found" });
    }

    latestEntry.checkOutDate = new Date();
    await student.save();

    const istTime = new Date(latestEntry.checkOutDate).toLocaleString("en-US", {
      timeZone: "Asia/Kolkata",
      hour12: false
    });

    return res.json({
      message: "Check Out recorded successfully",
      checkOutDate: istTime
    });
  } catch (err) {
    console.error("Check-out error:", err);
    return res.status(500).json({ message: "Server error during check-out." });
  }
};


const fileComplaint = async (req, res) => {
  const { studentId, complaintType, subject, description } = req.body;

  try {
    const student = await Student.findOne({ studentId });
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const newComplaint = new Complaint({
      studentId: student._id,
      complaintType,
      subject,
      description,
    });

    await newComplaint.save();

    await transporter.sendMail({
      from: `<${student.email}>`,
      to: process.env.MAIL_USER,
      subject: `${subject}`,
      text: `${description}`
    });

    return res.json({ message: "Complaint filed successfully", complaint: newComplaint });
  } catch (err) {
    console.error("File complaint error:", err);
    return res.status(500).json({ message: "Server error while filing complaint." });
  }
};


const getComplaintHistory = async (req, res) => {
  const { studentId } = req.params;

  try {
    const student = await Student.findOne({ studentId });
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const complaints = await Complaint.find({ studentId: student._id }).select(
      "complaintType subject filedDate status createdAt"
    );

    return res.json({ complaints });
  } catch (err) {
    console.error("Fetch complaint history error:", err);
    return res.status(500).json({ message: "Server error while fetching complaints." });
  }
};


const applyForLeave = async (req, res) => {
  const { studentId, leaveType, startDate, endDate, reason } = req.body;

  try {
    const student = await Student.findOne({ studentId });
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const newLeave = new Leave({
      studentId: student._id,
      leaveType,
      startDate,
      endDate,
      reason,
      status: "pending",
    });

    await newLeave.save();

    await transporter.sendMail({
      from: `<${student.email}>`,
      to: process.env.MAIL_USER,
      subject: `Leave Application: ${leaveType} from ${student.firstName}`,
      text: `${newLeave.reason}`,
    });

    return res.json({ message: "Leave application submitted", leave: newLeave });
  } catch (err) {
    console.error("Apply leave error:", err);
    return res.status(500).json({ message: "Server error while applying for leave." });
  }
};


const getLeaveHistory = async (req, res) => {
  const { studentId } = req.params;

  try {
    const student = await Student.findOne({ studentId });
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const leaves = await Leave.find({ studentId: student._id })
      .select("leaveType startDate endDate reason status appliedAt")
      .sort({ appliedAt: -1 });

    return res.json({ leaves });
  } catch (err) {
    console.error("Fetch leave history error:", err);
    return res.status(500).json({ message: "Server error while fetching leave history." });
  }
};


const requestRefund = async (req, res) => {
  const { studentId, refundType, amount, reason } = req.body;

  try {
    const student = await Student.findOne({ studentId });
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const newRefund = new Refund({
      studentId: student._id,
      refundType,
      amount,
      reason,
      status: "pending",
    });

    await newRefund.save();

    await transporter.sendMail({
      from: `<${student.email}>`,
      to: process.env.MAIL_USER,
      subject: `Refund Request: ${refundType} from ${student.firstName}`,
      text: `Refund Amount: ${amount}\nReason: ${reason}`,
    });

    return res.json({
      message: "Refund request submitted successfully",
      refund: newRefund,
    });
  } catch (err) {
    console.error("Refund request error:", err);
    return res
      .status(500)
      .json({ message: "Server error while requesting refund." });
  }
};


const getRefundHistory = async (req, res) => {
  const { studentId } = req.params;

  try {
    const student = await Student.findOne({ studentId });
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const refunds = await Refund.find({ studentId: student._id })
      .select("refundType amount reason status requestedAt")
      .sort({ requestedAt: -1 });

    return res.json({ refunds });
  } catch (err) {
    console.error("Fetch refund history error:", err);
    return res
      .status(500)
      .json({ message: "Server error while fetching refund history." });
  }
};


const getStudentProfile = async (req, res) => {
  const studentId = req.studentId; // from verifyStudentToken

  try {
    const student = await Student.findOne({ studentId }).populate("roomBedNumber");

    if (!student) return res.status(404).json({ message: "Student not found" });

    const inventoryData = student.roomBedNumber || {};

    const roomNo = inventoryData.roomNo || student.roomBedNumber;
    const bedAllotment = inventoryData.itemName || "N/A";

    const roommate = await Student.findOne({
      studentId: { $ne: studentId },
      roomBedNumber: student.roomBedNumber,
    });

    const lastLog = student.attendanceLog.at(-1);

    let checkStatus = "Pending Check-in";
    let checkTime = "--:--:--";

    if (lastLog) {
      if (!lastLog.checkOutDate) {
        checkStatus = "Checked In";
        checkTime = new Date(lastLog.checkInDate).toLocaleTimeString("en-IN", {
          timeZone: "Asia/Kolkata",
          hour12: false,
        });
      } else {
        checkStatus = "Checked Out";
        checkTime = new Date(lastLog.checkOutDate).toLocaleTimeString("en-IN", {
          timeZone: "Asia/Kolkata",
          hour12: false,
        });
      }
    }

    return res.json({
      firstName: student.firstName,
      lastName: student.lastName,
      studentId: student.studentId,
      email: student.email,
      contactNumber: student.contactNumber,
      roomNo,
      roommateName: roommate?.firstName || "No roommate",
      bedAllotment,
      lastCheckInDate: lastLog?.checkInDate || null,
      checkStatus,
      checkTime,
    });
  } catch (err) {
    console.error("Fetch student profile error:", err);
    return res.status(500).json({ message: "Server error while fetching profile." });
  }
};

const updateStudentProfile = async (req, res) => {
  const { studentId } = req.params;
  const {
    firstName,
    lastName,
    email,
    contactNumber,
  } = req.body;

  try {
    const student = await Student.findOne({ studentId });
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    if (firstName) student.firstName = firstName;
    if (lastName) student.lastName = lastName;
    if (email) student.email = email;
    if (contactNumber) student.contactNumber = contactNumber;

    await student.save();

    return res.json({ message: "Profile updated successfully" });
  } catch (err) {
    console.error("Update profile error:", err);
    return res
      .status(500)
      .json({ message: "Server error while updating profile." });
  }
};


const getCurrentFeesStatus = async (req, res) => {
  const { studentId } = req.params;

  try {
    const student = await Student.findOne({ studentId });
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const fees = await Fee.find({ studentId: student._id }).select("feeType amount status dueDate");

    const now = new Date();

    const updatedFees = fees.map((fee) => {
      const isOverdue = fee.status === 'unpaid' && new Date(fee.dueDate) < now;

      return {
        ...fee.toObject(),
        status: isOverdue ? 'overdue' : fee.status,
      };
    });

    res.json({ fees: updatedFees });
  } catch (error) {
    console.error("Fee status error:", error);
    res.status(500).json({ message: "Error fetching fee status" });
  }
};


const getNotices = async (req, res) => {
  try {
    const noticesList = await Notice.find().sort({ issueDate: -1 });

    const noticesData = noticesList.map(notice => ({
      issueDate: notice.issueDate ? new Date(notice.issueDate).toISOString() : null,
      title: notice.title || "No Subject",
      message: notice.message || "No Description",
    }));

    return res.json({ notices: noticesData }); // ✅ FIXED
  } catch (err) {
    console.error("Notices fetch error:", err);
    return res.status(500).json({ message: "Server error while fetching notices data." });
  }
};


const getNextInspection = async (req, res) => {
  try {
    const studentId = req.studentId; // Comes from token (verifyStudentToken)

    const student = await Student.findOne({ studentId }).populate('roomBedNumber');

    if (!student || !student.roomBedNumber) {
      return res.status(404).json({ message: 'Student room not found' });
    }

    const targetRoom = `Room ${student.roomBedNumber.roomNo || student.roomBedNumber}`;

    const nextInspection = await Inspection.findOne({
      target: targetRoom,
      status: 'pending',
      datetime: { $gte: new Date() }
    }).sort({ datetime: 1 });

    if (!nextInspection) {
      return res.status(404).json({ message: 'No upcoming inspections for this room' });
    }

    return res.json({
      title: nextInspection.title,
      date: nextInspection.datetime,
      status: nextInspection.status,
    });

  } catch (err) {
    console.error('Error fetching inspection:', err.message);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};


const getAttendanceSummary = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { range } = req.query;

    const student = await Student.findOne({ studentId });

    if (!student) return res.status(404).json({ message: 'Student not found' });

    const now = new Date();
    let fromDate;

    // Calculate date range
    switch (range) {
      case 'day':
        fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        const firstDayOfWeek = now.getDate() - now.getDay();
        fromDate = new Date(now.getFullYear(), now.getMonth(), firstDayOfWeek);
        break;
      case 'month':
        fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      default:
        return res.status(400).json({ message: 'Invalid range' });
    }

    const logs = student.attendanceLog;

    let present = 0;
    let absent = 0;

    const dateSet = new Set();

    // Count present days
    logs.forEach(log => {
      const checkIn = new Date(log.checkInDate);
      if (checkIn >= fromDate && checkIn <= now) {
        const dateStr = checkIn.toISOString().split('T')[0];
        dateSet.add(dateStr);
      }
    });

    present = dateSet.size;

    // Count absent days
    const today = new Date();
    let daysInRange = 0;
    let iter = new Date(fromDate);

    while (iter <= today) {
      daysInRange++;
      iter.setDate(iter.getDate() + 1);
    }

    absent = daysInRange - present;

    return res.json({ present, absent });

  } catch (error) {
    console.error('Attendance summary error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};






export {
  login,
  forgotPassword,
  resetPassword,
  verifyOtp,
  checkInStudent,
  checkOutStudent,
  fileComplaint,
  getComplaintHistory,
  applyForLeave,
  getLeaveHistory,
  requestRefund,
  getRefundHistory,
  getStudentProfile,
  updateStudentProfile,
  getCurrentFeesStatus,
  getNotices,
  getNextInspection,
  getAttendanceSummary
}