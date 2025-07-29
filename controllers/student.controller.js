import "dotenv/config";
import nodemailer from "nodemailer";
import bcrypt from "bcrypt";
import { Student } from "../models/student.model.js";
import { Otp } from "../models/otp.model.js";
import { Complaint } from "../models/complaint.model.js";
import { Leave } from "../models/leave.model.js";
import { Refund } from "../models/refund.model.js";
import { Fee } from "../models/fee.model.js";
//import { Payment } from "../models/payment.model.js";


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
    return res.json({ message: "Login successful", studentId });
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
      { upsert: true }
    );

    await transporter.sendMail({
      from: `"Hostel Admin" <${process.env.MAIL_USER}>`,
      to: email,
      subject: "Student Password Reset OTP",
      text: `Dear ${student.firstName} ${student.lastName},\n\nYour OTP for password reset is ${otp}. It expires in 10 minutes.\n\n– Hostel Admin`,
    });

    return res.json({ message: "OTP sent" });
  } catch (err) {
    console.error("Forgot password error:", err);
    return res
      .status(500)
      .json({ message: "Server error during OTP generation." });
  }
};

const verifyOtp = async (req, res) => {
  const { email, otp } = req.body;
  const record = await Otp.findOne({ email, code });

  if (!record || record.code !== otp || record.expires < Date.now()) {
    return res.status(400).json({ message: "Invalid or expired OTP" });
  }

  record.verified = true;
  await record.save();
  return res.json({ message: "OTP verified" });
};

const resetPassword = async (req, res) => {
  const { email, otp, newPassword } = req.body;
  const record = await Otp.findOne({ email, code: otp, verified: true });

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

    await Otp.deleteOne({ email });

    return res.json({ message: "Password has been reset" });
  } catch (err) {
    console.error("Reset password error:", err);
    return res
      .status(500)
      .json({ message: "Server error during password reset." });
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
    const student = await Student.findOne({ _id: studentId });
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
    const student = await Student.findById(studentId);
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
    const student = await Student.findById(studentId);
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
  const { studentId } = req.params;

  try {
    const student = await Student.findOne({ studentId });
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const fullRoomBed = student.roomBedNumber;
    const lastDashIndex = fullRoomBed.lastIndexOf("-");

    const roomNo = fullRoomBed.substring(0, lastDashIndex);
    const bedAllotment = fullRoomBed.substring(lastDashIndex + 1);


    const roommate = await Student.findOne({
      roomBedNumber: { $regex: `^${roomNo}-` },
      studentId: { $ne: studentId },
    });

    const lastCheckIn =
      student.attendanceLog.length > 0
        ? student.attendanceLog.at(-1).checkInDate
        : null;

    return res.json({
      firstName: student.firstName,
      lastName: student.lastName,
      studentId: student.studentId,
      email: student.email,
      contactNumber: student.contactNumber,
      roomNo,
      roommateName: roommate?.studentName || "No roommate",
      bedAllotment,
      lastCheckInDate: lastCheckIn,
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
    const fees = await Fee.find({ studentId }).select("feeType amount status dueDate");
    res.json({ fees });
  } catch (error) {
    res.status(500).json({ message: "Error fetching fee status" });
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
  getCurrentFeesStatus
}