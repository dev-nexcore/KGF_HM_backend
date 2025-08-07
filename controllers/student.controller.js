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
import { Notification } from '../models/notification.model.js';
import { getDistanceKm, uploadSelfie } from '../utils/wasabiUpload.js';
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
  const { selfie, location } = req.body;
  const studentId = req.studentId;

  try {
    console.log("🔥 Student ID:", studentId);
    console.log("📸 Selfie received:", selfie?.substring(0, 100)); // trim for log

    if (
      !selfie ||
      typeof selfie !== "string" ||
      selfie.trim() === "" ||
      selfie === "null" ||
      selfie === "undefined" ||
      !/^data:image\/\w+;base64,[a-zA-Z0-9+/=]+$/.test(selfie)
    ) {
      return res.status(400).json({ message: "Selfie is missing or invalid." });
    }

    const { lat, lng } = location;
    const hostelLat = 19.072618, hostelLng = 72.880419;
    const distance = getDistanceKm(lat, lng, hostelLat, hostelLng);
    if (distance > 0.3) {
      return res.status(403).json({ message: 'You are not near the hostel.' });
    }

    const student = await Student.findOne({ studentId });
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const latestEntry = student.attendanceLog?.at(-1); // optional chaining

    if (latestEntry && !latestEntry.checkOutDate) {
      return res.status(400).json({ message: "Already checked in, checkout first" });
    }

    let selfieURL;
    try {
      selfieURL = await uploadSelfie(selfie, `${studentId}_checkin_${Date.now()}.jpg`);
    } catch (err) {
      console.error("❌ Wasabi upload failed:", err);
      return res.status(500).json({ message: "Failed to upload selfie" });
    }

    const newCheckIn = {
      checkInDate: new Date(),
      checkInSelfie: selfieURL,
      checkInLocation: { lat, lng },
    };

    if (!Array.isArray(student.attendanceLog)) {
      student.attendanceLog = [];
    }

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
    console.error("❌ Check-in server error:", err);
    return res.status(500).json({ message: "Server error during check-in." });
  }
};


const checkOutStudent = async (req, res) => {
  const { selfie, location } = req.body;
  const studentId = req.studentId;

  try {
    if (!selfie || !location) {
      return res.status(400).json({ message: "Missing selfie or location" });
    }

    const { lat, lng } = location;
    const hostelLat = 19.072618, hostelLng = 72.880419;
    const distance = getDistanceKm(lat, lng, hostelLat, hostelLng);

    if (distance > 0.3) {
      return res.status(403).json({ message: 'You are not near the hostel.' });
    }
    const student = await Student.findOne({ studentId });
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const latestEntry = student.attendanceLog.at(-1);

    if (!latestEntry || latestEntry.checkOutDate) {
      return res.status(400).json({ message: "No active check-in found" });
    }

    const selfieURL = await uploadSelfie(selfie, `${studentId}_checkout_${Date.now()}.jpg`);

    latestEntry.checkOutDate = new Date();
    latestEntry.checkOutSelfie = selfieURL;
    latestEntry.checkOutLocation = { lat, lng };
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
  const { complaintType, subject, description, otherComplaintType } = req.body;
  const studentId = req.studentId;

  try {
    const student = await Student.findOne({ studentId });
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    // Process uploaded files (if any)
    const attachments = [];
    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        attachments.push({
          filename: file.filename,
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          path: file.path
        });
      });
    }

    const newComplaint = new Complaint({
      studentId: student._id,
      complaintType,
      otherComplaintType: complaintType === "Others" ? otherComplaintType : "",
      subject,
      description,
      attachments
    });

    await newComplaint.save();

    // Determine display type for emails
    const displayType = complaintType === "Others" && otherComplaintType
      ? `Others (${otherComplaintType})`
      : complaintType;

    // Prepare email content
    let emailText = `New Complaint Filed:

Student Details:
- Name: ${student.studentName}
- Student ID: ${student.studentId}
- Email: ${student.email}
- Room/Bed: ${student.roomBedNumber || 'Not specified'}

Complaint Details:
- Type: ${displayType}
- Subject: ${subject}
- Description: ${description}
- Filed Date: ${new Date().toLocaleDateString('en-IN')}

${attachments.length > 0 ? `\nAttachments: ${attachments.length} file(s) attached` : ''}

Please review and respond accordingly.

Hostel Management System`;

    // Send email notification to admin
    await transporter.sendMail({
      from: `"Hostel System" <${process.env.MAIL_USER}>`,
      to: process.env.MAIL_USER, // Admin email
      subject: `New Complaint: ${subject} - ${student.studentName}`,
      text: emailText
    });

    // Send confirmation email to student
    await transporter.sendMail({
      from: `"Hostel Admin" <${process.env.MAIL_USER}>`,
      to: student.email,
      subject: `Complaint Filed Successfully - ${subject}`,
      text: `Hello ${student.studentName},

Your complaint has been filed successfully and assigned ticket ID: #${String(newComplaint._id).slice(-4).toUpperCase()}

Complaint Details:
- Subject: ${subject}
- Type: ${displayType}
- Status: In Progress
- Filed Date: ${new Date().toLocaleDateString('en-IN')}

${attachments.length > 0 ? `Attachments: ${attachments.length} file(s) uploaded` : ''}

We will review your complaint and get back to you soon.

Thank you for bringing this to our attention.

- Hostel Administration`
    });

    return res.json({
      message: "Complaint filed successfully",
      complaint: {
        _id: newComplaint._id,
        ticketId: `#${String(newComplaint._id).slice(-4).toUpperCase()}`,
        subject: newComplaint.subject,
        complaintType: newComplaint.complaintType,
        otherComplaintType: newComplaint.otherComplaintType,
        status: newComplaint.status,
        filedDate: newComplaint.filedDate,
        attachments: newComplaint.attachments.length
      }
    });
  } catch (err) {
    console.error("File complaint error:", err);
    return res.status(500).json({ message: "Server error while filing complaint." });
  }
};

// Get student complaints with attachments
const getStudentComplaints = async (req, res) => {
  const { studentId } = req.params;

  try {
    const student = await Student.findOne({ studentId });
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const complaints = await Complaint.find({ studentId: student._id })
      .select('complaintType otherComplaintType subject description status filedDate attachments createdAt')
      .sort({ filedDate: -1 });

    const formattedComplaints = complaints.map(complaint => ({
      _id: complaint._id,
      ticketId: `#${String(complaint._id).slice(-4).toUpperCase()}`,
      complaintType: complaint.complaintType,
      otherComplaintType: complaint.otherComplaintType || '',
      subject: complaint.subject,
      description: complaint.description,
      status: complaint.status,
      filedDate: complaint.filedDate,
      createdAt: complaint.createdAt,
      hasAttachments: complaint.attachments.length > 0,
      attachmentCount: complaint.attachments.length
    }));

    return res.json({
      message: "Complaints fetched successfully",
      complaints: formattedComplaints
    });
  } catch (err) {
    console.error("Get student complaints error:", err);
    return res.status(500).json({ message: "Server error while fetching complaints." });
  }
};

// Get complaint attachment (for downloading/viewing)
const getComplaintAttachment = async (req, res) => {
  const { complaintId, attachmentId } = req.params;

  try {
    const complaint = await Complaint.findById(complaintId);
    if (!complaint) {
      return res.status(404).json({ message: "Complaint not found" });
    }

    const attachment = complaint.attachments.id(attachmentId);
    if (!attachment) {
      return res.status(404).json({ message: "Attachment not found" });
    }

    // Check if file exists
    const fs = await import('fs');
    if (!fs.existsSync(attachment.path)) {
      return res.status(404).json({ message: "File not found on server" });
    }

    // Set appropriate headers
    res.setHeader('Content-Type', attachment.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${attachment.originalName}"`);

    // Stream the file
    const path = await import('path');
    return res.sendFile(path.resolve(attachment.path));

  } catch (err) {
    console.error("Get attachment error:", err);
    return res.status(500).json({ message: "Server error while fetching attachment." });
  }
};


const getComplaintHistory = async (req, res) => {
  const studentId = req.studentId;

  try {
    const student = await Student.findOne({ studentId });
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    // FIXED: Include 'attachments' and 'otherComplaintType' in the select
    const complaints = await Complaint.find({ studentId: student._id })
      .select("complaintType otherComplaintType subject description filedDate status createdAt attachments")
      .sort({ createdAt: -1 }); // Sort by newest first

    // FIXED: Format the response to include attachment information
    const formattedComplaints = complaints.map(complaint => ({
      _id: complaint._id,
      complaintType: complaint.complaintType,
      otherComplaintType: complaint.otherComplaintType || '',
      subject: complaint.subject,
      description: complaint.description,
      status: complaint.status || 'Pending',
      filedDate: complaint.filedDate,
      createdAt: complaint.createdAt,
      // FIXED: Add attachment information that frontend expects
      hasAttachments: complaint.attachments && complaint.attachments.length > 0,
      attachmentCount: complaint.attachments ? complaint.attachments.length : 0
    }));

    return res.json({
      message: "Complaints fetched successfully",
      complaints: formattedComplaints
    });
  } catch (err) {
    console.error("Fetch complaint history error:", err);
    return res.status(500).json({ message: "Server error while fetching complaints." });
  }
};


const applyForLeave = async (req, res) => {
  const studentId = req.studentId; // From token

  const { leaveType, startDate, endDate, reason, otherLeaveType } = req.body;

  try {
    const student = await Student.findOne({ studentId });
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    let parent = req.parent;

    if (!parent) {
      parent = await Parent.findOne({ studentId });
    }

    if (!parent || !parent.email) {
      console.log("❌ Parent not found or missing email for studentId:", studentId);
    } else {
      console.log("📘 Parent found in applyForLeave:", parent.email);
    }

    const newLeave = new Leave({
      studentId: student._id,
      leaveType,
      otherLeaveType: leaveType === 'Others' ? otherLeaveType : '',
      startDate,
      endDate,
      reason,
      status: "pending",
    });

    await newLeave.save();

    // Format dates
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

    const durationMs = new Date(endDate) - new Date(startDate);
    const durationDays = Math.ceil(durationMs / (1000 * 60 * 60 * 24));

    const leaveHtml = `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Leave Application</h2>
          <p><strong>Student:</strong> ${student.firstName} ${student.lastName} (ID: ${student.studentId})</p>
          <p><strong>Type:</strong> ${leaveType}</p>
          <p><strong>From:</strong> ${formattedStartDate}</p>
          <p><strong>To:</strong> ${formattedEndDate}</p>
          <p><strong>Duration:</strong> ${durationDays} day${durationDays !== 1 ? 's' : ''}</p>
          <p><strong>Reason:</strong> ${reason}</p>
          <p>Status: <strong style="color: orange;">Pending</strong></p>
        </div>
      `;

    //Send email to admin only
    await transporter.sendMail({
      from: `<${student.email}>`,
      to: process.env.MAIL_USER,
      subject: `Leave Application: ${leaveType} from ${student.firstName}`,
      html: leaveHtml
    });

    await transporter.sendMail({
      from: `<${student.email}>`,
      to: process.env.MAIL_USER,
      subject: `Leave Application: ${leaveType} from ${student.firstName}`,
      html: leaveHtml
    });

    await Promise.all([
      transporter.sendMail({
        from: `<${student.email}>`,
        to: process.env.MAIL_USER,
        subject: `Leave Application: ${leaveType} from ${student.firstName}`,
        html: leaveHtml
      }).then(() => console.log("📧 Mail sent to admin")),

      parent?.email ? transporter.sendMail({
        from: `"Hostel Admin" <${process.env.MAIL_USER}>`,
        to: parent.email,
        subject: `Your child ${student.firstName} has applied for leave`,
        html: leaveHtml
      }).then(() => console.log("📧 Mail sent to parent:", parent.email))
        .catch((err) => console.error("❌ Failed to send mail to parent:", err)) : Promise.resolve()
    ]);

    return res.json({
      message: "Leave application submitted successfully.",
      leave: newLeave
    });
  } catch (err) {
    console.error("Apply leave error:", err);
    return res.status(500).json({ message: "Server error while applying for leave." });
  }
};

const getLeaveHistory = async (req, res) => {
  const studentId = req.studentId;

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
  const { refundType, amount, reason, otherRefundType } = req.body;
  const studentId = req.studentId;

  try {
    const student = await Student.findOne({ studentId });
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const newRefund = new Refund({
      studentId: student._id,
      refundType,
      otherRefundType: refundType === "Others" ? otherRefundType : "",
      amount,
      reason,
      status: "pending",
    });

    await newRefund.save();

    await transporter.sendMail({
      from: `<${student.email}>`,
      to: process.env.MAIL_USER,
      subject: `Refund Request: ${refundType === "Others" ? `Other (${otherRefundType})` : refundType
        } from ${student.firstName}`,
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
  const studentId = req.studentId;

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
  // 🔧 UPDATED: Handle both parent and student tokens
  let studentId = req.params.studentId || req.studentId;

  if (!studentId) {
    return res.status(400).json({ message: "Student ID not found" });
  }

  if (req.params.studentId) {
    // Called with studentId parameter (from parent or direct access)
    studentId = req.params.studentId;
  } else if (req.studentId) {
    // Called from student token (original logic)
    studentId = req.studentId;
  } else {
    return res.status(400).json({ message: "Student ID not found" });
  }

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

    let imageUrl = null;

    if (student.profileImage && typeof student.profileImage === "string" && student.profileImage.trim() !== "") {
      const imgPath = student.profileImage.replace(/\\/g, "/");

      // Avoid double prefix
      imageUrl = imgPath.startsWith("http")
        ? imgPath
        : `${req.protocol}://${req.get("host")}/${imgPath}`;
    }

    console.log("✔️ Profile image URL sent:", imageUrl);

    return res.json({
      firstName: student.firstName,
      lastName: student.lastName,
      studentId: student.studentId,
      email: student.email,
      contactNumber: student.contactNumber,
      profileImage: imageUrl,
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
  const studentId = req.studentId;
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
  const studentId = req.studentId;

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
      return res.status(204).send();
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

const getAttendanceLog = async (req, res) => {
  try {
    const { studentId } = req.params;

    // Find the student with their attendance log
    const student = await Student.findOne({ studentId });

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Return the attendance log
    const attendanceLog = student.attendanceLog || [];

    return res.json({
      studentId: student.studentId,
      attendanceLog: attendanceLog,
      totalEntries: attendanceLog.length
    });

  } catch (error) {
    console.error('Error fetching attendance log:', error);
    return res.status(500).json({
      message: 'Internal server error while fetching attendance log'
    });
  }
};



const getAttendanceSummary = async (req, res) => {
  const studentId = req.params.studentId;
  const authenticatedStudentId = req.studentId; // set by verifyStudentOrParentToken middleware
  const { range } = req.query;

  if (studentId !== authenticatedStudentId) {
    return res.status(403).json({ message: 'Forbidden: Access denied to this student\'s attendance.' });
  }

  if (!['day', 'week', 'month'].includes(range)) {
    return res.status(400).json({ message: 'Invalid range parameter' });
  }

  const now = new Date();
  let startDate;
  let endDate = new Date(now); // include today

  if (range === 'day') {
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    endDate = new Date(startDate);
    endDate.setHours(23, 59, 59, 999);
  }
  else if (range === 'week') {
    const dayOfWeek = now.getDay(); // 0 (Sun) to 6 (Sat)
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);
    startDate.setHours(0, 0, 0, 0); // Ensure start at midnight

    endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6); // Full 7-day week
    endDate.setHours(23, 59, 59, 999); // End of last day
  }
  else if (range === 'month') {
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


// 📥 Get all notifications for a student
const getNotifications = async (req, res) => {
  try {
    const studentObjectId = req.student._id;  // get ObjectId from middleware

    const notifications = await Notification.find({ studentId: studentObjectId, seen: false, })
      .sort({ createdAt: -1 })
      .limit(50);

    res.status(200).json({ notifications });
  } catch (err) {
    console.error("❌ Error fetching notifications:", err);
    res.status(500).json({ message: "Failed to fetch notifications" });
  }
};


const markNotificationsAsSeen = async (req, res) => {
  try {
    const studentStringId = req.studentId; // e.g., "MNB125"

    // Find the actual student document to get the ObjectId (_id)
    const student = await Student.findOne({ studentId: studentStringId }).select('_id');

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    // Use the _id for matching Notification.studentId (which is an ObjectId)
    await Notification.updateMany(
      { studentId: student._id, seen: false },
      { $set: { seen: true } }
    );

    return res.status(200).json({ message: "Notifications marked as seen" });
  } catch (err) {
    console.error("❌ Error marking notifications as seen:", err);
    return res.status(500).json({ message: "Failed to update notifications" });
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
  getStudentComplaints,
  getComplaintAttachment,
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
  getAttendanceLog,
  deleteMyProfileImage,
  uploadMyProfileImage,
  getNotifications,
  markNotificationsAsSeen
}