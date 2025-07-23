import "dotenv/config";
import nodemailer from "nodemailer";
import bcrypt from "bcrypt";
import { Student } from "../models/student.model.js";
import { Otp } from "../models/otp.model.js";

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: +process.env.MAIL_PORT,
  secure: process.env.MAIL_SECURE === "true",
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

const login = async(req, res) => {
  const { studentId, password } = req.body;

  try {
    const student = await Student.findOne({ studentId });
    if (!student) { 
      return res.status(401).json({ message: "Invalid student ID" });
    }
    
    const isMatch = student.password === password; // Direct plain comparison

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
  const record = await Otp.findOne({email,code});

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

    await Otp.deleteOne({email});

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




export{
    login,
    forgotPassword,
    resetPassword,
    verifyOtp,
    checkInStudent,
    checkOutStudent
}