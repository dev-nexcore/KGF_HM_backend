import "dotenv/config";
import nodemailer from "nodemailer";
import jwt from 'jsonwebtoken';
import bcrypt from "bcrypt";
import { Parent } from "../models/parent.model.js";
import { Student } from "../models/student.model.js";
import { Warden } from "../models/warden.model.js";
import { Otp } from "../models/otp.model.js";
import { Leave } from "../models/leave.model.js";
import { Notice } from "../models/notice.model.js"; 
import path from 'path';
import fs from 'fs';


const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: +process.env.MAIL_PORT,
  secure: process.env.MAIL_SECURE === "true",
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

// Generate access token for parent
const generateToken = (parent) => {
  if (!process.env.JWT_SECRET || !process.env.JWT_EXPIRES_IN) {
    throw new Error("JWT_SECRET or JWT_EXPIRES_IN is not defined in environment variables");
  }

  return jwt.sign(
    { studentId: parent.studentId, email: parent.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN } // e.g., '1h' for access token
  );
};

// Generate refresh token for parent
const generateRefreshToken = async (parent) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not defined in environment variables");
  }

  const refreshToken = jwt.sign(
    { studentId: parent.studentId, email: parent.email },
    process.env.JWT_SECRET,
    { expiresIn: "30d" } // Longer expiration for refresh token
  );

  // Save refresh token to database (MongoDB)
  parent.refreshToken = refreshToken;
  await parent.save(); // Await the save operation

  return refreshToken;
};

// NEW: Send OTP for login
const sendLoginOTP = async (req, res) => {
  const { studentId } = req.body;

  if (!studentId) {
    return res.status(400).json({ message: "Student ID is required" });
  }

  try {
    // Find parent by studentId
    const parent = await Parent.findOne({ studentId });
    if (!parent) {
      return res.status(404).json({ message: "No parent account found for this Student ID" });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Set OTP expiry (5 minutes from now)
    const otpExpiry = new Date(Date.now() + 5 * 60 * 1000);

    // Save OTP using the existing Otp model or create a new record
    await Otp.findOneAndUpdate(
      { email: parent.email },
      { 
        code: otp, 
        expires: otpExpiry, 
        verified: false,
        purpose: 'login' // Add purpose to distinguish from password reset
      },
      { upsert: true }
    );

    // Send OTP via email
    await transporter.sendMail({
      from: `"Hostel Admin" <${process.env.MAIL_USER}>`,
      to: parent.email,
      subject: 'Your Parent Login OTP',
      text: `Hello ${parent.firstName},

Your OTP for parent panel login is: ${otp}

This OTP is valid for 5 minutes only.

If you didn't request this OTP, please ignore this email.

– Hostel Admin`
    });

    return res.json({
      message: 'OTP sent successfully to your registered email address',
      email: parent.email.replace(/(.{2})(.*)(@.*)/, '$1***$3'), // Mask email for security
      expiresIn: '5 minutes'
    });

  } catch (err) {
    console.error("Error sending login OTP:", err);
    return res.status(500).json({ message: "Error sending OTP" });
  }
};

// UPDATED: Login controller with OTP verification (replaces old password-based login)
const login = async (req, res) => {
  const { studentId, otp } = req.body;

  // Input validation
  if (!studentId || !otp) {
    return res.status(400).json({ message: "Student ID and OTP are required" });
  }

  try {
    // Find parent by studentId
    const parent = await Parent.findOne({ studentId });
    if (!parent) {
      return res.status(401).json({ message: "Invalid Student ID" });
    }

    // Find OTP record for this parent's email
    const otpRecord = await Otp.findOne({ 
      email: parent.email, 
      code: otp, 
      purpose: 'login' // Make sure it's a login OTP, not password reset
    });

    if (!otpRecord) {
      return res.status(401).json({ message: "Invalid OTP" });
    }

    // Check if OTP is expired
    if (new Date() > otpRecord.expires) {
      // Delete expired OTP
      await Otp.deleteOne({ _id: otpRecord._id });
      return res.status(401).json({ message: "OTP has expired. Please request a new OTP." });
    }

    // OTP is valid, delete it after successful verification
    await Otp.deleteOne({ _id: otpRecord._id });

    // Generate tokens
    const token = generateToken(parent);
    const refreshToken = await generateRefreshToken(parent);

    // Return response
    return res.json({
      message: "Login successful",
      token,
      refreshToken,
      parent: {
        studentId: parent.studentId,
        email: parent.email,
        firstName: parent.firstName,
        lastName: parent.lastName,
        contactNumber: parent.contactNumber
      },
    });
  } catch (err) {
    console.error("Parent login error:", err);
    return res.status(500).json({ message: "Server error during login" });
  }
};

// Refresh access token controller (unchanged)
const refreshAccessToken = async (req, res) => {
  const { refreshToken } = req.body;

  try {
    if (!refreshToken) {
      return res.status(401).json({ message: "No refresh token provided" });
    }

    // Verify the refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    if (!decoded.studentId) {
      return res.status(401).json({ message: "Invalid refresh token payload" });
    }

    // Find parent by studentId, explicitly select refreshToken
    const parent = await Parent.findOne({ studentId: decoded.studentId }).select("+refreshToken");
    if (!parent || parent.refreshToken !== refreshToken) {
      return res.status(401).json({ message: "Invalid or expired refresh token" });
    }

    // Generate new tokens
    const newAccessToken = generateToken(parent);
    const newRefreshToken = await generateRefreshToken(parent);

    return res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (err) {
    console.error("Refresh token error:", err);
    if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Invalid or expired refresh token" });
    }
    return res.status(500).json({ message: "Server error during token refresh" });
  }
};

// Forgot password controller for parent panel (unchanged)
const forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const parent = await Parent.findOne({ email });
    if (!parent) {
      return res.status(400).json({ message: "Email not recognized" });
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await Otp.findOneAndUpdate(
      { email },
      { code: otp, expires, verified: false, purpose: 'password_reset' },
      { upsert: true }
    );

    await transporter.sendMail({
      from: `"Hostel Admin" <${process.env.MAIL_USER}>`,
      to: email,
      subject: "Parent Password Reset OTP",
      text: `Dear ${parent.firstName} ${parent.lastName},\n\nYour OTP for password reset is ${otp}. It expires in 10 minutes.\n\n– Hostel Admin`,
    });

    return res.json({ message: "OTP sent" });
  } catch (err) {
    console.error("Forgot password error:", err);
    return res
      .status(500)
      .json({ message: "Server error during OTP generation." });
  }
};

// Verify OTP controller for parent panel (unchanged)
const verifyOtp = async (req, res) => {
  const { email, otp } = req.body;
  const record = await Otp.findOne({ email, code: otp, purpose: 'password_reset' });

  if (!record || record.code !== otp || record.expires < Date.now()) {
    return res.status(400).json({ message: "Invalid or expired OTP" });
  }

  record.verified = true;
  await record.save();
  return res.json({ message: "OTP verified" });
};

// Reset password controller for parent panel (unchanged)
const resetPassword = async (req, res) => {
  const { email, otp, newPassword } = req.body;
  const record = await Otp.findOne({ email, code: otp, verified: true, purpose: 'password_reset' });

  if (!record || record.code !== otp || !record.verified) {
    return res.status(400).json({ message: "OTP not verified" });
  }

  try {
    const parent = await Parent.findOne({ email });
    if (!parent) {
      return res.status(404).json({ message: "Parent not found" });
    }

    // OPTION 1: Let the pre-save middleware handle the hashing
    parent.password = newPassword; // Set plain password, let middleware hash it
    await parent.save();

    await Otp.deleteOne({ email, purpose: 'password_reset' });

    return res.json({ message: "Password has been reset" });
  } catch (err) {
    console.error("Reset password error:", err);
    return res
      .status(500)
      .json({ message: "Server error during password reset." });
  }
};

const getProfile = async (req, res) => {
  const parentStudentId = req.studentId; // From authenticateParent middleware

  try {
    // Find parent by studentId
    const parent = await Parent.findOne({ studentId: parentStudentId });
    if (!parent) {
      return res.status(404).json({ message: "Parent not found" });
    }

    // Find associated student
    const student = await Student.findOne({ studentId: parentStudentId });
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    // Prepare profile data
    const profileData = {
      parentInfo: {
        _id: parent._id,
        studentId: parent.studentId,
        firstName: parent.firstName,
        lastName: parent.lastName,
        email: parent.email,
        contactNumber: parent.contactNumber,
        profileImage: parent.profileImage || null,
        createdAt: parent.createdAt,
        updatedAt: parent.updatedAt
      },
      studentInfo: {
        firstName: student.firstName,
        lastName: student.lastName,
        email: student.email,
        contactNumber: student.contactNumber,
        admissionDate: student.admissionDate,
        emergencyContactName: student.emergencyContactName,
        emergencyContactNumber: student.emergencyContactNumber
      }
    };

    return res.json({
      message: "Profile data fetched successfully",
      profile: profileData
    });

  } catch (err) {
    console.error("Get profile error:", err);
    return res.status(500).json({ message: "Server error while fetching profile data." });
  }
};

const getStudentProfile = async (req, res) => {
  try {
    const parentStudentId = req.studentId; // From the parent's JWT token
    
    console.log('🔍 Fetching profile for student ID:', parentStudentId);
    
    // Fetch student data with populated room information (matching your student controller)
    const student = await Student.findOne({ studentId: parentStudentId })
      .populate("roomBedNumber") // This is crucial for room details
      .select('firstName lastName studentId email contactNumber profileImage createdAt updatedAt roomBedNumber attendanceLog');
    
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    console.log('👤 Found student:', student.firstName, student.lastName);
    console.log('📸 Profile image field:', student.profileImage);

    // Extract room details from populated roomBedNumber (matching your student controller logic)
    const inventoryData = student.roomBedNumber || {};
    const roomNo = inventoryData.roomNo || "N/A";
    const bedAllotment = inventoryData.itemName || "N/A";
    const barcodeId = inventoryData.barcodeId || "N/A";
    const floor = inventoryData.floor || "N/A";

    // Handle profile image properly
    let imageUrl = null;
    if (student.profileImage && typeof student.profileImage === "string" && student.profileImage.trim() !== "") {
      const imgPath = student.profileImage.replace(/\\/g, "/");
      
      // Avoid double prefix - check if it already starts with http
      imageUrl = imgPath.startsWith("http")
        ? imgPath
        : `${req.protocol}://${req.get("host")}/${imgPath}`;
    }

    console.log('🖼️ Final image URL:', imageUrl);

    // Get last check-in info (matching your student controller)
    const lastLog = student.attendanceLog?.at(-1);
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

    // Format the response to match what the parent panel expects
    const studentProfile = {
      firstName: student.firstName,
      lastName: student.lastName,
      studentId: student.studentId,
      email: student.email,
      contactNumber: student.contactNumber,
      roomNo: roomNo,
      bedAllotment: bedAllotment,
      barcodeId: barcodeId,
      floor: floor,
      lastCheckInDate: lastLog?.checkInDate || null,
      checkStatus: checkStatus,
      checkTime: checkTime,
      profileImage: imageUrl, // This should now work properly
      photo: imageUrl, // Also provide as 'photo' field for compatibility
      createdAt: student.createdAt,
      updatedAt: student.updatedAt
    };

    console.log('✅ Sending profile with image:', studentProfile.profileImage);

    res.json({
      success: true,
      student: studentProfile
    });

  } catch (error) {
    console.error('❌ Error fetching student profile for parent:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch student profile'
    });
  }
};
 
// Upload profile image
const uploadProfileImage = async (req, res) => {
  const parentStudentId = req.studentId; // From authenticateParent middleware

  try {
    // Find parent by studentId
    const parent = await Parent.findOne({ studentId: parentStudentId });
    if (!parent) {
      return res.status(404).json({ message: "Parent not found" });
    }

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({ message: "No image file provided" });
    }

    // Delete old profile image if exists
    if (parent.profileImage) {
      const oldImagePath = path.join(process.cwd(), parent.profileImage);
      if (fs.existsSync(oldImagePath)) {
        try {
          fs.unlinkSync(oldImagePath);
        } catch (error) {
          console.log("Warning: Could not delete old profile image:", error.message);
        }
      }
    }

    // Update parent with new profile image path
    const imagePath = `uploads/parents/${req.file.filename}`;
    parent.profileImage = imagePath;
    await parent.save();

    return res.json({
      message: "Profile image uploaded successfully",
      profileImage: imagePath,
      imageUrl: `${req.protocol}://${req.get('host')}/${imagePath}`
    });

  } catch (err) {
    console.error("Upload profile image error:", err);
    
    // Delete uploaded file if there was an error
    if (req.file) {
      const filePath = path.join(process.cwd(), 'uploads/parents', req.file.filename);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (deleteError) {
          console.log("Warning: Could not delete uploaded file after error:", deleteError.message);
        }
      }
    }
    
    return res.status(500).json({ message: "Server error while uploading profile image." });
  }
};

// Update profile information
const updateProfile = async (req, res) => {
  const parentStudentId = req.studentId; // From authenticateParent middleware
  const { firstName, lastName, contactNumber } = req.body;

  try {
    // Find parent by studentId
    const parent = await Parent.findOne({ studentId: parentStudentId });
    if (!parent) {
      return res.status(404).json({ message: "Parent not found" });
    }

    // Update fields if provided
    if (firstName && firstName.trim()) parent.firstName = firstName.trim();
    if (lastName && lastName.trim()) parent.lastName = lastName.trim();
    if (contactNumber && contactNumber.trim()) parent.contactNumber = contactNumber.trim();

    await parent.save();

    return res.json({
      message: "Profile updated successfully",
      parent: {
        studentId: parent.studentId,
        firstName: parent.firstName,
        lastName: parent.lastName,
        email: parent.email,
        contactNumber: parent.contactNumber,
        profileImage: parent.profileImage
      }
    });

  } catch (err) {
    console.error("Update profile error:", err);
    return res.status(500).json({ message: "Server error while updating profile." });
  }
};

// Remove profile image
const removeProfileImage = async (req, res) => {
  const parentStudentId = req.studentId; // From authenticateParent middleware

  try {
    // Find parent by studentId
    const parent = await Parent.findOne({ studentId: parentStudentId });
    if (!parent) {
      return res.status(404).json({ message: "Parent not found" });
    }

    // Delete profile image file if exists
    if (parent.profileImage) {
      const imagePath = path.join(process.cwd(), parent.profileImage);
      if (fs.existsSync(imagePath)) {
        try {
          fs.unlinkSync(imagePath);
        } catch (error) {
          console.log("Warning: Could not delete profile image file:", error.message);
        }
      }
    }

    // Remove profile image from database
    parent.profileImage = null;
    await parent.save();

    return res.json({
      message: "Profile image removed successfully"
    });

  } catch (err) {
    console.error("Remove profile image error:", err);
    return res.status(500).json({ message: "Server error while removing profile image." });
  }
};


// Dashboard controller for parent panel (unchanged)
const dashboard = async (req, res) => {
  const { studentId } = req.query;

  if (!studentId) {
    return res.status(400).json({ message: "studentId is required" });
  }

  try {
    // Populate the roomBedNumber field to get actual room/bed details
    const student = await Student.findOne({ studentId })
      .populate({
        path: 'roomBedNumber',
        select: 'location floor roomNo itemName description barCodeId' // Select specific fields you need
      })
      .exec();

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    // Create detailed room and bed information
    let roomBedDisplay = 'Not Assigned';
    let roomBedDetails = {
      display: 'Not Assigned',
      floor: 'N/A',
      room: 'N/A',
      bedType: 'N/A',
      location: 'N/A'
    };

    if (student.roomBedNumber) {
      const bed = student.roomBedNumber;
      
      // Create a readable display format
      if (bed.location) {
        roomBedDisplay = bed.location; // e.g., "Floor 1, Room 101"
      } else if (bed.floor && bed.roomNo) {
        roomBedDisplay = `Floor ${bed.floor}, Room ${bed.roomNo}`;
      } else if (bed.roomNo) {
        roomBedDisplay = `Room ${bed.roomNo}`;
      } else {
        roomBedDisplay = bed.itemName || 'Bed Assigned';
      }

      roomBedDetails = {
        display: roomBedDisplay,
        floor: bed.floor || 'N/A',
        room: bed.roomNo || 'N/A',
        bedType: bed.itemName || bed.description || 'Bed',
        location: bed.location || 'N/A',
        barCodeId: bed.barCodeId || 'N/A'
      };
    }

    // Fetch warden name directly using wardenId "W123"
    const warden = await Warden.findOne({ wardenId: "W123" });
    const wardenName = warden ? `${warden.firstName} ${warden.lastName}` : "Not Assigned";

    const dashboardData = {
      studentInfo: {
        studentId: student.studentId,
        firstName: student.firstName,
        lastName: student.lastName,
        photo: student.photo || null,
        contactNumber: student.contactNumber,
        email: student.email,
        roomBedNumber: roomBedDisplay, // Now shows readable format instead of ObjectId
        roomBedDetails: roomBedDetails, // Additional detailed info if needed
        admissionDate: student.admissionDate,
        emergencyContactName: student.emergencyContactName,
        emergencyContactNumber: student.emergencyContactNumber,
        checkInDate: student.checkInDate,
        checkOutDate: student.checkOutDate,
      },
      attendanceSummary: {
        totalDays: student.attendanceSummary?.totalDays || 0,
        presentDays: student.attendanceSummary?.presentDays || 0,
        absentDays: student.attendanceSummary?.absentDays || 0,
      },
      feesOverview: {
        status: student.feeStatus || "Not Available",
        amountDue: student.feeStatus === "Pending" ? student.feeAmount || 0 : 0,
        totalAmount: student.feeAmount || 0, // Add total amount for better fee display
      },
      wardenInfo: {
        wardenName: wardenName
      },
    };

    return res.json(dashboardData);
  } catch (err) {
    console.error("Dashboard fetch error:", err);
    return res
      .status(500)
      .json({ message: "Server error while fetching dashboard data." });
  }
};

const attendance = async (req, res) => {
  const { studentId } = req.query;

  if (!studentId) {
    return res.status(400).json({ message: "studentId is required" });
  }

  try {
    const student = await Student.findOne({ studentId });

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    // Assuming you have a term start date - adjust as needed
    const termStartDate = new Date('2024-08-01'); // Replace with your actual term start
    const today = new Date();
    
    // Calculate total school days (excluding weekends)
    let totalSchoolDays = 0;
    let currentDate = new Date(termStartDate);
    
    while (currentDate <= today) {
      const dayOfWeek = currentDate.getDay();
      // Exclude Saturdays (6) and Sundays (0) - adjust based on your school schedule
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        totalSchoolDays++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Process attendance log
    const attendanceLog = student.attendanceLog || [];
    const presentDates = new Set();
    
    attendanceLog.forEach(entry => {
      const entryDate = new Date(entry.checkInDate);
      presentDates.add(entryDate.toDateString());
    });
    
    const presentDays = presentDates.size;
    const absentDays = Math.max(0, totalSchoolDays - presentDays);
    const attendancePercentage = totalSchoolDays > 0 ? Math.round((presentDays / totalSchoolDays) * 100) : 0;
    
    // Check today's status
    const todayString = today.toDateString();
    const isPresentToday = presentDates.has(todayString);
    
    // Find most recent absence
    let lastAbsenceDate = null;
    let checkDate = new Date(today);
    checkDate.setDate(checkDate.getDate() - 1); // Start from yesterday
    
    while (checkDate >= termStartDate) {
      const dayOfWeek = checkDate.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Skip weekends
        if (!presentDates.has(checkDate.toDateString())) {
          lastAbsenceDate = checkDate.toDateString();
          break;
        }
      }
      checkDate.setDate(checkDate.getDate() - 1);
    }

    const attendanceData = {
      studentId: student.studentId,
      firstName: student.firstName,
      lastName: student.lastName,
      attendanceSummary: {
        totalDays: totalSchoolDays,
        presentDays,
        absentDays,
        attendancePercentage,
        isPresentToday,
        lastAbsence: lastAbsenceDate || "No recent absences"
      }
    };

    return res.json(attendanceData);
  } catch (err) {
    console.error("Attendance fetch error:", err);
    return res
      .status(500)
      .json({ message: "Server error while fetching attendance data." });
  }
};

//

// Leave Management controller for parent panel (unchanged)
const leaveManagement = async (req, res) => {
  const { studentId } = req.query;

  if (!studentId) {
    return res.status(400).json({ message: "studentId is required" });
  }

  try {
    const student = await Student.findOne({ studentId });
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    console.log("Student found:", student);

    // Fetch leave history from Leave model
    const leaves = await Leave.find({ studentId: student._id })
      .select("leaveType startDate endDate reason status appliedAt _id")
      .sort({ appliedAt: -1 });

    console.log("Leaves found:", leaves);

    const leaveHistory = leaves.map(leave => {
      const startDate = new Date(leave.startDate).toISOString();
      const endDate = new Date(leave.endDate).toISOString();
      const durationMs = new Date(endDate) - new Date(startDate);
      const durationDays = Math.ceil(durationMs / (1000 * 60 * 60 * 24));

      return {
        _id: leave._id,
        leaveType: leave.leaveType,
        duration: `${durationDays} day${durationDays !== 1 ? 's' : ''}`,
        startDate: startDate,
        endDate: endDate,
        reason: leave.reason,
        status: leave.status
      };
    });

    // Use dynamic current date from the backend
    const currentDate = new Date();

    return res.json({
      studentId: student.studentId,
      leaveHistory,
      currentDate: currentDate.toISOString()
    });
  } catch (err) {
    console.error("Leave management fetch error:", err);
    return res.status(500).json({ message: "Server error while fetching leave data." });
  }
};

// Approve or reject leave request by parent
const updateLeaveStatus = async (req, res) => {
  const { leaveId, status, parentComment } = req.body;
  const parentStudentId = req.studentId; // From authentication middleware

  // Validate status
  if (!['approved', 'rejected'].includes(status.toLowerCase())) {
    return res.status(400).json({ message: "Status must be 'approved' or 'rejected'" });
  }

  try {
    // Find the leave request
    const leave = await Leave.findById(leaveId).populate('studentId');
    if (!leave) {
      return res.status(404).json({ message: "Leave request not found" });
    }

    // Verify this parent has permission to update this leave (their child's leave)
    const student = leave.studentId;
    if (student.studentId !== parentStudentId) {
      return res.status(403).json({ message: "You can only update your child's leave requests" });
    }

    // Check if leave is still pending
    if (leave.status.toLowerCase() !== 'pending') {
      return res.status(400).json({ 
        message: `Leave request is already ${leave.status}. Cannot update.` 
      });
    }

    // Update leave status
    leave.status = status.toLowerCase();
    leave.parentComment = parentComment || '';
    leave.parentApprovalDate = new Date();
    await leave.save();

    // Format dates for email
    const formattedStartDate = new Date(leave.startDate).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit', 
      year: 'numeric',
      timeZone: 'Asia/Kolkata'
    });
    
    const formattedEndDate = new Date(leave.endDate).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric', 
      timeZone: 'Asia/Kolkata'
    });

    // Calculate duration
    const durationMs = new Date(leave.endDate) - new Date(leave.startDate);
    const durationDays = Math.ceil(durationMs / (1000 * 60 * 60 * 24));

    // Get parent info
    const parent = await Parent.findOne({ studentId: student.studentId });

    // Send email notification to student
    await transporter.sendMail({
      from: `"Hostel Admin" <${process.env.MAIL_USER}>`,
      to: student.email,
      subject: `Leave Request ${status === 'approved' ? 'Approved' : 'Rejected'} - ${leave.leaveType}`,
      text: `Dear ${student.firstName} ${student.lastName},

Your leave request has been ${status} by your parent.

Leave Details:
• Leave Type: ${leave.leaveType}
• From Date: ${formattedStartDate}  
• To Date: ${formattedEndDate}
• Duration: ${durationDays} day${durationDays !== 1 ? 's' : ''}
• Reason: ${leave.reason}
• Status: ${status.toUpperCase()}
${parentComment ? `• Parent Comment: ${parentComment}` : ''}

${status === 'approved' ? 
  'Your leave has been approved. Please follow hostel guidelines for your leave period.' : 
  'Your leave request has been rejected. Please contact your parent or hostel administration for more details.'
}

– Hostel Admin`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
          <h2 style="color: #333; text-align: center;">Leave Request ${status === 'approved' ? 'Approved' : 'Rejected'}</h2>
          
          <p>Dear <strong>${student.firstName} ${student.lastName}</strong>,</p>
          
          <p>Your leave request has been <strong style="color: ${status === 'approved' ? '#4CAF50' : '#f44336'};">${status.toUpperCase()}</strong> by your parent.</p>
          
          <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #555; margin-top: 0;">Leave Details:</h3>
            <ul style="list-style: none; padding: 0;">
              <li style="margin: 8px 0;"><strong>Leave Type:</strong> ${leave.leaveType}</li>
              <li style="margin: 8px 0;"><strong>From Date:</strong> ${formattedStartDate}</li>
              <li style="margin: 8px 0;"><strong>To Date:</strong> ${formattedEndDate}</li>
              <li style="margin: 8px 0;"><strong>Duration:</strong> ${durationDays} day${durationDays !== 1 ? 's' : ''}</li>
              <li style="margin: 8px 0;"><strong>Reason:</strong> ${leave.reason}</li>
              <li style="margin: 8px 0;"><strong>Status:</strong> <span style="color: ${status === 'approved' ? '#4CAF50' : '#f44336'};">${status.toUpperCase()}</span></li>
              ${parentComment ? `<li style="margin: 8px 0;"><strong>Parent Comment:</strong> ${parentComment}</li>` : ''}
            </ul>
          </div>
          
          <div style="background-color: ${status === 'approved' ? '#e8f5e8' : '#ffebee'}; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 0; color: ${status === 'approved' ? '#2e7d32' : '#c62828'};">
              ${status === 'approved' ? 
                '✅ Your leave has been approved. Please follow hostel guidelines for your leave period.' : 
                '❌ Your leave request has been rejected. Please contact your parent or hostel administration for more details.'
              }
            </p>
          </div>
          
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
          <p style="text-align: center; color: #666; font-size: 12px;">– Hostel Admin</p>
        </div>
      `
    });

    // Send email to admin about parent's decision
    await transporter.sendMail({
      from: `"Hostel Admin" <${process.env.MAIL_USER}>`,
      to: process.env.MAIL_USER,
      subject: `Parent ${status === 'approved' ? 'Approved' : 'Rejected'} Leave - ${student.firstName} ${student.lastName}`,
      text: `Parent has ${status} a leave request.

Student: ${student.firstName} ${student.lastName} (${student.studentId})
Parent: ${parent ? `${parent.firstName} ${parent.lastName}` : 'Unknown'}
Leave Type: ${leave.leaveType}
From: ${formattedStartDate} To: ${formattedEndDate}
Status: ${status.toUpperCase()}
${parentComment ? `Parent Comment: ${parentComment}` : ''}

Please update your records accordingly.`
    });

    return res.json({
      message: `Leave request ${status} successfully`,
      leave: {
        _id: leave._id,
        leaveType: leave.leaveType,
        startDate: leave.startDate,
        endDate: leave.endDate,
        reason: leave.reason,
        status: leave.status,
        parentComment: leave.parentComment,
        parentApprovalDate: leave.parentApprovalDate
      }
    });

  } catch (err) {
    console.error("Update leave status error:", err);
    return res.status(500).json({ message: "Server error while updating leave status." });
  }
};
// Fees controller for parent panel (unchanged)
const fees = async (req, res) => {
  const { studentId } = req.query;

  if (!studentId) {
    return res.status(400).json({ message: "studentId is required" });
  }

  try {
    const student = await Student.findOne({ studentId });
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const feesData = {
      studentId: student.studentId,
      firstName: student.firstName,
      lastName: student.lastName,
      feesOverview: {
        status: student.feeStatus || "Not Available",
        totalAmount: student.feeAmount || 0,
        amountDue: student.feeStatus === "Pending" ? student.feeAmount || 0 : 0,
        dueDate: student.feeDueDate ? new Date(student.feeDueDate).toISOString() : null,
        paymentHistory: student.paymentHistory?.map(payment => ({
          amount: payment.amount || 0,
          date: payment.date ? new Date(payment.date).toISOString() : null,
          method: payment.method || "Not specified",
          status: payment.status || "Completed"
        })) || []
      }
    };

    return res.json(feesData);
  } catch (err) {
    console.error("Fees fetch error:", err);
    return res.status(500).json({ message: "Server error while fetching fees data." });
  }
};

// Notices controller for parent panel (unchanged)
const notices = async (req, res) => {
  const { studentId } = req.query;

  if (!studentId) {
    return res.status(400).json({ message: "studentId is required" });
  }

  try {
    // Verify student exists
    const student = await Student.findOne({ studentId });
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    // Fetch all notices (you can add filtering logic if needed)
    const noticesList = await Notice.find()
      .sort({ issueDate: -1 }) // Sort by issue date, newest first
      .lean(); // Use lean() for better performance

    console.log("Raw notices from database:", noticesList);

    // Transform notices data to match frontend expectations
    const noticesData = noticesList.map(notice => ({
      _id: notice._id,
      issueDate: notice.issueDate || notice.createdAt || new Date(),
      title: notice.title || "No Subject",
      message: notice.message || "No Description",
      template: notice.template || "default",
      recipientType: notice.recipientType || "Student",
      readStatus: notice.readStatus || "Unread" // Default to Unread if not specified
    }));

    console.log("Processed notices data:", noticesData);

    // Return response in the format expected by frontend
    return res.json({
      message: "Notices fetched successfully",
      notices: noticesData, // Frontend expects response.data.notices
      count: noticesData.length
    });

  } catch (err) {
    console.error("Notices fetch error:", err);
    return res.status(500).json({ 
      message: "Server error while fetching notices data.",
      error: err.message 
    });
  }
};

const markNoticeAsRead = async (req, res) => {
  const { noticeId } = req.params;
  const studentId = req.studentId; // From authentication middleware

  if (!noticeId) {
    return res.status(400).json({ message: "Notice ID is required" });
  }

  try {
    // Find the notice
    const notice = await Notice.findById(noticeId);
    if (!notice) {
      return res.status(404).json({ message: "Notice not found" });
    }

    // Update read status (you might need to modify your Notice schema to support per-student read status)
    // For now, this is a simple approach - you might want to create a separate collection for read statuses
    notice.readStatus = "Read";
    await notice.save();

    return res.json({
      message: "Notice marked as read",
      noticeId: noticeId
    });

  } catch (err) {
    console.error("Mark notice as read error:", err);
    return res.status(500).json({ 
      message: "Server error while marking notice as read",
      error: err.message 
    });
  }
};

export {
  sendLoginOTP,      // NEW: Added for OTP login
  login,             // UPDATED: Now uses OTP instead of password
  generateToken, 
  generateRefreshToken, 
  refreshAccessToken,
  forgotPassword,    
  verifyOtp,
  resetPassword,
  getProfile,
  getStudentProfile,
  uploadProfileImage,
  updateProfile,
  removeProfileImage,
  dashboard,
  attendance,
  leaveManagement,
  updateLeaveStatus,
  fees,
  notices,
  markNoticeAsRead
};