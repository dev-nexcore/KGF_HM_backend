import "dotenv/config";
import nodemailer from "nodemailer";
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

// Login controller for parent panel
const login = async (req, res) => {
  const { studentId, password } = req.body;

  try {
    const parent = await Parent.findOne({ studentId });
    if (!parent) {
      return res.status(401).json({ message: "Invalid student ID" });
    }

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

    parent.password = await bcrypt.hash(newPassword, 10);
    await parent.save();

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

    // Update currentDate to current time (05:37 PM IST, July 23, 2025)
    const currentDate = new Date("2025-07-23T12:07:00Z");

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
const notices = async (req, res) => {
  try {
    const noticesList = await Notice.find().sort({ date: -1 });
    const noticesData = noticesList.map(notice => ({
      date: notice.issueDate ? new Date(notice.issueDate).toISOString() : null,
      subject: notice.title || "No Subject",
      description: notice.message || "No Description",
      
    }));

    return res.json(noticesData);
  } catch (err) {
    console.error("Notices fetch error:", err);
    return res.status(500).json({ message: "Server error while fetching notices data." });
  }
};

export {
  login,
  forgotPassword,
  verifyOtp,
  resetPassword,
  dashboard,
  attendance,
  leaveManagement,
  fees,
  notices
};