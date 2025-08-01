import "dotenv/config";
import fs from "fs";
import path from "path";
import nodemailer from "nodemailer";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { Student } from "../models/student.model.js";
import { Parent } from "../models/parent.model.js";
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
      hour12: true,
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
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
      hour12: true,
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
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

    // Find the parent associated with this student
    const parent = await Parent.findOne({ studentId: student.studentId });
    if (!parent) {
      return res.status(404).json({ message: "Parent not found for this student" });
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

    // Format dates for email
    const formattedStartDate = new Date(startDate).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'Asia/Kolkata'
    });
    
    const formattedEndDate = new Date(endDate).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'Asia/Kolkata'
    });

    // Calculate duration
    const durationMs = new Date(endDate) - new Date(startDate);
    const durationDays = Math.ceil(durationMs / (1000 * 60 * 60 * 24));

    // Send email to admin (existing functionality)
    await transporter.sendMail({
      from: `<${student.email}>`,
      to: process.env.MAIL_USER,
      subject: `Leave Application: ${leaveType} from ${student.firstName}`,
      text: `${newLeave.reason}`,
    });

    // Send email to parent with leave details and link
    await transporter.sendMail({
      from: `"Hostel Admin" <${process.env.MAIL_USER}>`,
      to: parent.email,
      subject: `Leave Application from ${student.firstName} ${student.lastName}`,
      text: `Dear ${parent.firstName} ${parent.lastName},

Your child ${student.firstName} ${student.lastName} (Student ID: ${student.studentId}) has submitted a leave application.

Leave Details:
• Leave Type: ${leaveType}
• From Date: ${formattedStartDate}
• To Date: ${formattedEndDate}
• Duration: ${durationDays} day${durationDays !== 1 ? 's' : ''}
• Reason: ${reason}
• Status: Pending Approval

Please review this leave application by visiting the Parent Portal:
👉 https://www.KGF-HM.com/dashboard/leave-management

You can view all leave applications and their current status in the Leave Management section.

If you have any questions or concerns, please contact the hostel administration.

– Hostel Admin`,
    // Replace the HTML section in your applyForLeave controller:

html: `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
    <h2 style="color: #333; text-align: center;">Leave Application Notification</h2>
    
    <p>Dear <strong>${parent.firstName} ${parent.lastName}</strong>,</p>
    
    <p>Your child <strong>${student.firstName} ${student.lastName}</strong> (Student ID: <strong>${student.studentId}</strong>) has submitted a leave application.</p>
    
    <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
      <h3 style="color: #555; margin-top: 0;">Leave Details:</h3>
      <ul style="list-style: none; padding: 0;">
        <li style="margin: 8px 0;"><strong>Leave Type:</strong> ${leaveType}</li>
        <li style="margin: 8px 0;"><strong>From Date:</strong> ${formattedStartDate}</li>
        <li style="margin: 8px 0;"><strong>To Date:</strong> ${formattedEndDate}</li>
        <li style="margin: 8px 0;"><strong>Duration:</strong> ${durationDays} day${durationDays !== 1 ? 's' : ''}</li>
        <li style="margin: 8px 0;"><strong>Reason:</strong> ${reason}</li>
        <li style="margin: 8px 0;"><strong>Status:</strong> <span style="color: #orange;">Pending Approval</span></li>
      </ul>
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="http://localhost:3000/Leave?fromEmail=true" style="background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
        View Leave Application
      </a>
    </div>
    
    <p>You can view all leave applications and their current status in the Leave Management section of the Parent Portal.</p>
    
    <p>If you have any questions or concerns, please contact the hostel administration.</p>
    
    <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
    <p style="text-align: center; color: #666; font-size: 12px;">– Hostel Admin</p>
  </div>
      `
    });

    return res.json({ 
      message: "Leave application submitted successfully. Parent has been notified via email.", 
      leave: newLeave 
    });
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
  const studentId = req.studentId; // from verifyStudentToken

  try {
    const student = await Student.findOne({ studentId }).populate("roomBedNumber");

    if (!student) return res.status(404).json({ message: "Student not found" });

    const inventoryData = student.roomBedNumber || {};

    const roomNo = inventoryData.roomNo || "N/A";
    const bedAllotment = inventoryData.itemName || "N/A";
    const barcodeId = inventoryData.barcodeId || "N/A";
    const floor = inventoryData.floor || "N/A";

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
      profileImage: student.profileImage || null,
      roomNo,
      bedAllotment,
      barcodeId,
      floor,
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
  const { studentId } = req.params;
  const { range } = req.query;

  if (!['day', 'week', 'month'].includes(range)) {
    return res.status(400).json({ message: 'Invalid range parameter' });
  }

  const now = new Date();
  let startDate;
  let endDate = new Date(now); // include today

  if (range === 'day') {
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else if (range === 'week') {
    // Week starts from Sunday (0)
    const dayOfWeek = now.getDay();
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);
    // endDate = startDate + 6 days (optional, here just use now)
  } else if (range === 'month') {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    // endDate = last day of the month
    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  }

  // Helper to get number of days in the range:
  function getTotalDays(start, end) {
    const oneDay = 1000 * 60 * 60 * 24;
    return Math.floor((end - start) / oneDay) + 1;
  }

  try {
    const student = await Student.findOne({ studentId });

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Group logs by day within the range
    const logsByDay = {};

    student.attendanceLog.forEach(log => {
      const checkIn = new Date(log.checkInDate);
      // Only consider logs within range
      if (checkIn >= startDate && checkIn <= endDate) {
        const dayKey = checkIn.toISOString().split('T')[0];

        if (!logsByDay[dayKey]) {
          logsByDay[dayKey] = { checkIns: [], checkOuts: [] };
        }

        if (log.checkInDate) {
          logsByDay[dayKey].checkIns.push(new Date(log.checkInDate));
        }

        if (log.checkOutDate) {
          logsByDay[dayKey].checkOuts.push(new Date(log.checkOutDate));
        }
      }
    });

    // Calculate attendance by checking for valid first check-in and last check-out each day
    let presentDays = 0;

    Object.keys(logsByDay).forEach(day => {
      const dayLogs = logsByDay[day];

      if (dayLogs.checkIns.length > 0 && dayLogs.checkOuts.length > 0) {
        // Get earliest check-in and latest check-out for the day
        const firstCheckIn = new Date(Math.min(...dayLogs.checkIns));
        const lastCheckOut = new Date(Math.max(...dayLogs.checkOuts));

        // Make sure check-in is before check-out (valid attendance)
        if (firstCheckIn < lastCheckOut) {
          presentDays += 1;
        }
      }
    });

    const totalDays = getTotalDays(startDate, endDate);
    const absentDays = Math.max(totalDays - presentDays, 0);

    return res.json({
      range,
      totalDays,
      present: presentDays,
      absent: absentDays,
    });
  } catch (error) {
    console.error('Error fetching attendance summary:', error);
    res.status(500).json({ message: 'Server error while fetching attendance summary' });
  }
};


const getNotificationStatus = async (req, res) => {
  const studentId = req.studentId; // e.g. "MNB125" string from token

  try {
    const student = await Student.findOne({ studentId });

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    const studentObjectId = student._id;

    const unseenNotices = await Notice.countDocuments({ seenBy: { $ne: studentId } }); // assuming seenBy stores string
    const unseenRefunds = await Refund.countDocuments({ studentId: studentObjectId, statusSeen: false });
    const unseenComplaints = await Complaint.countDocuments({ studentId: studentObjectId, adminSeen: true });
    const unseenLeaves = await Leave.countDocuments({ studentId: studentObjectId, adminSeen: true });

    const hasUnseen =
      unseenNotices > 0 || unseenRefunds > 0 || unseenComplaints > 0 || unseenLeaves > 0;

    res.json({
      hasUnseen,
      notifications: [
        { message: "Your leave request was approved", link: "/leaves" },
        { message: "New notice from admin", link: "/notices" },
        { message: "Refund request updated", link: "/refunds" },
        { message: "Complaint has been responded", link: "/complaints" },
      ]
    });

  } catch (err) {
    console.error("Notification check failed:", err);
    res.status(500).json({ message: 'Server error' });
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
  getAttendanceSummary,
  deleteMyProfileImage,
  uploadMyProfileImage,
  getNotificationStatus
}