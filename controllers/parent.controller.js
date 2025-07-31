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

// Login controller for parent panel
const login = async (req, res) => {
  const { studentId, password } = req.body;

  // Input validation
  if (!studentId || !password) {
    return res.status(400).json({ message: "Student ID and password are required" });
  }

  try {
    // Find parent by studentId, explicitly select password
    const parent = await Parent.findOne({ studentId }).select("+password");
    if (!parent) {
      return res.status(401).json({ message: "Invalid student ID" });
    }

    // Detailed debugging
   

    // Test direct bcrypt comparison
    const directBcryptResult = await bcrypt.compare(password, parent.password);
    console.log("Direct bcrypt.compare result:", directBcryptResult);

    // Test the model method
    const modelMethodResult = await parent.comparePassword(password);
    console.log("Model comparePassword result:", modelMethodResult);

    // Test with string conversion (in case of type issues)
    const stringPassword = String(password);
    const stringDirectResult = await bcrypt.compare(stringPassword, parent.password);
    console.log("String converted direct result:", stringDirectResult);

    // Test if password contains hidden characters
    console.log("Password char codes:", Array.from(password).map(char => char.charCodeAt(0)));
    console.log("Hash char codes (first 20):", Array.from(parent.password.substring(0, 20)).map(char => char.charCodeAt(0)));

    // Generate a new hash with the plain password to compare
    const newHash = await bcrypt.hash(password, 12);
    console.log("Newly generated hash:", newHash);
    const newHashTest = await bcrypt.compare(password, newHash);
    console.log("New hash comparison test:", newHashTest);




    // Use direct bcrypt comparison as fallback
    const isMatch = directBcryptResult;
    
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid password" });
    }

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
        firstname: parent.firstName,
        lastName: parent.lastName,
        contactNumber:parent.contactNumber
      },
    });
  } catch (err) {
    console.error("Parent login error:", err);
    return res.status(500).json({ message: "Server error during login" });
  }
};

// Refresh access token controller
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
// Forgot password controller for parent panel
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
      { code: otp, expires, verified: false },
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

// Verify OTP controller for parent panel
const verifyOtp = async (req, res) => {
  const { email, otp } = req.body;
  const record = await Otp.findOne({ email, code: otp });

  if (!record || record.code !== otp || record.expires < Date.now()) {
    return res.status(400).json({ message: "Invalid or expired OTP" });
  }

  record.verified = true;
  await record.save();
  return res.json({ message: "OTP verified" });
};

// Reset password controller for parent panel
const resetPassword = async (req, res) => {
  const { email, otp, newPassword } = req.body;
  const record = await Otp.findOne({ email, code: otp, verified: true });

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

    // OPTION 2: Alternative - Use updateOne to bypass middleware entirely
    // await Parent.updateOne(
    //   { email },
    //   { $set: { password: await bcrypt.hash(newPassword, 12) } }
    // );

    await Otp.deleteOne({ email });

    return res.json({ message: "Password has been reset" });
  } catch (err) {
    console.error("Reset password error:", err);
    return res
      .status(500)
      .json({ message: "Server error during password reset." });
  }
};

// Dashboard controller for parent panel
const dashboard = async (req, res) => {
  const { studentId } = req.query;

  if (!studentId) {
    return res.status(400).json({ message: "studentId is required" });
  }

  try {
    const student = await Student.findOne({ studentId });
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    // Fetch warden name directly using wardenId "W123"
    const warden = await Warden.findOne({ wardenId: "W123" });
    const wardenName = warden ? `${warden.firstName} ${warden.lastName}` : "Not Assigned";

    const dashboardData = {
      studentInfo: {
        studentId: student.studentId,
        studentName: student.studentName,
        photo: student.photo || null,
        contactNumber: student.contactNumber,
        email: student.email,
        roomBedNumber: student.roomBedNumber,
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



// Attendance controller for parent panel
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

    const attendanceData = {
      studentId: student.studentId,
      studentName: student.studentName,
      checkInDate: student.checkInDate || null,
      checkOutDate: student.checkOutDate || null,
      attendanceSummary: {
        totalDays: 1,
        presentDays: student.checkInDate ? 1 : 0,
        absentDays: student.checkInDate ? 0 : 1,
        attendancePercentage: student.checkInDate ? 100 : 0,
      },
    };

    return res.json(attendanceData);
  } catch (err) {
    console.error("Attendance fetch error:", err);
    return res
      .status(500)
      .json({ message: "Server error while fetching attendance data." });
  }
};


// Leave Management controller for parent panel
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
      .sort({ appliedAt: -1 }); // Fixed missing closing parenthesis

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


// Fees controller for parent panel
const fees = async (req, res) => {
  const { studentId } = req.query; // Changed from req.body to req.query

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

// Notices controller for parent panel
// Updated notices controller for parent panel
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
  login,
  generateToken, 
  generateRefreshToken, 
  refreshAccessToken,
  forgotPassword,
  verifyOtp,
  resetPassword,
  dashboard,
  attendance,
  leaveManagement,
  fees,
  notices,
  markNoticeAsRead
};