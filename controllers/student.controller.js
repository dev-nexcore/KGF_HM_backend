import "dotenv/config";
import fs from "fs";
import path from "path";
import nodemailer from "nodemailer";
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

    return res.json({ message: "Login successful", studentId: student.studentId, email: student.email });
  } catch (err) {
    console.error("Student login error:", err);
    return res.status(500).json({ message: "Server error during login." });
  }
};

const forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const student = await Student.findOne({ email });
    if (!student) {
      return res.status(400).json({ message: "Email not recognized" });
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await Otp.findOneAndUpdate(
      { email },
      { code: otp, expires, verified: false },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await transporter.sendMail({
      from: `"Hostel Admin" <${process.env.MAIL_USER}>`,
      to: email,
      subject: "Student Password Reset OTP",
      text: `Dear ${student.studentName},\n\nYour OTP for password reset is ${otp}. It expires in 10 minutes.\n\n– Hostel Admin`,
    });

    return res.json({ message: "OTP sent" });
  } catch (err) {
    console.error("Forgot password error:", err);
    return res.status(500).json({ message: "Server error during OTP generation." });
  }
};

const verifyOtp = async (req, res) => {
  const { email, otp } = req.body;

  try {
    const record = await Otp.findOne({ email, code: otp });
    if (!record) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }
    if (record.expires.getTime() < Date.now()) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    record.verified = true;
    await record.save();
    return res.json({ message: "OTP verified" });
  } catch (err) {
    console.error("Verify OTP error:", err);
    return res.status(500).json({ message: "Server error during OTP verification." });
  }
};

const resetPassword = async (req, res) => {
  const { email, otp, newPassword } = req.body;

  try {
    const record = await Otp.findOne({ email, code: otp, verified: true });
    if (!record) {
      return res.status(400).json({ message: "OTP not verified" });
    }
    if (record.expires.getTime() < Date.now()) {
      return res.status(400).json({ message: "OTP expired" });
    }

    const student = await Student.findOne({ email });
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    student.password = newPassword;
    await student.save();

    await Otp.deleteOne({ email });

    return res.json({ message: "Password has been reset" });
  } catch (err) {
    console.error("Reset password error:", err);
    return res.status(500).json({ message: "Server error during password reset." });
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


// controller/student.controller.js
const getAttendanceLog = async (req, res) => {
  const { studentId } = req.params;

  try {
    const student = await Student.findOne({ studentId });
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    return res.json({ attendanceLog: student.attendanceLog });
  } catch (err) {
    console.error("Error fetching attendance log:", err);
    return res.status(500).json({ message: "Server error" });
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

// Upload student's own profile image
const uploadMyProfileImage = async (req, res) => {
  try {
    const { studentId } = req.params; // Get from URL params like your other routes
    
    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided'
      });
    }

    // Find student using your existing pattern
    const student = await Student.findOne({ studentId });
    if (!student) {
      // Delete uploaded file if student not found
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(404).json({
        success: false, 
        message: 'Student not found'
      });
    }

    // Delete old profile image if exists
    if (student.profileImage) {
      const oldImagePath = path.join(process.cwd(), student.profileImage);
      if (fs.existsSync(oldImagePath)) {
        try {
          fs.unlinkSync(oldImagePath);
          console.log('Old profile image deleted');
        } catch (error) {
          console.error('Error deleting old image:', error);
          // Continue anyway - don't fail the upload for this
        }
      }
    }

    // Update student with new image path
    const imagePath = req.file.path.replace(/\\/g, '/'); // Normalize path separators
    student.profileImage = imagePath;
    await student.save();

    // Create full URL for frontend
    const imageUrl = `${req.protocol}://${req.get('host')}/${imagePath}`;

    res.status(200).json({
      success: true,
      message: 'Profile image uploaded successfully',
      imageUrl: imageUrl,
      student: {
        studentId: student.studentId,
        profileImage: imagePath
      }
    });

  } catch (error) {
    console.error('Upload error:', error);
    
    // Clean up uploaded file if there was an error
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.error('Error cleaning up file:', cleanupError);
      }
    }

    res.status(500).json({
      success: false,
      message: 'Failed to upload profile image',
      error: error.message
    });
  }
};

// Delete student's own profile image
const deleteMyProfileImage = async (req, res) => {
  try {
    const { studentId } = req.params;

    const student = await Student.findOne({ studentId });
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Delete image file if exists
    if (student.profileImage) {
      const imagePath = path.join(process.cwd(), student.profileImage);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
        console.log('Profile image file deleted');
      }
    }

    // Remove image path from database
    student.profileImage = null;
    await student.save();

    res.status(200).json({
      success: true,
      message: 'Profile image deleted successfully'
    });

  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete profile image',
      error: error.message
    });
  }
};


const getStudentProfile = async (req, res) => {
  const { studentId } = req.params;

  try {
    const student = await Student.findOne({ studentId }).populate("roomBedNumber");

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const inventoryData = student.roomBedNumber;

    if (!inventoryData) {
      return res.status(500).json({
        message: "Student room data is missing or invalid",
      });
    }

    const roomNo = inventoryData.roomNo;
    const bedAllotment = inventoryData.itemName;

    const roommate = await Student.findOne({
      studentId: { $ne: studentId },
    }).populate("roomBedNumber");

    const roommateInSameRoom =
      roommate && roommate.roomBedNumber?.roomNo === roomNo ? roommate : null;

    const lastLog = student.attendanceLog.at(-1);

    let checkStatus = "Pending Check-in";
    let checkTime = "--:--:--";

    if (lastLog) {
      if (!lastLog.checkOutDate) {
        checkStatus = "Checked In";
        checkTime = new Date(lastLog.checkInDate).toLocaleTimeString("en-IN", {
          timeZone: "Asia/Kolkata",
          hour12: false
        });
      } else {
        checkStatus = "Checked Out";
        checkTime = new Date(lastLog.checkOutDate).toLocaleTimeString("en-IN", {
          timeZone: "Asia/Kolkata",
          hour12: false
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
      roommateName: roommateInSameRoom?.studentName || "No roommate",
      bedAllotment,
      lastCheckInDate: lastLog?.checkInDate || null,
      checkStatus,
      checkTime
    });
  } catch (err) {
    console.error("Fetch student profile error:", err);
    return res
      .status(500)
      .json({ message: "Server error while fetching profile." });
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

    res.json({ fees });
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
  const { studentId } = req.params;

  try {
    const student = await Student.findOne({ studentId }).populate('roomBedNumber');

    if (!student || !student.roomBedNumber) {
      return res.status(404).json({ message: 'Student room not found' });
    }

    const targetRoom = `Room ${student.roomBedNumber.roomNo}`;

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
  getAttendanceLog,
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