import "dotenv/config";
import nodemailer from "nodemailer";
import bcrypt from "bcrypt";
import { Warden } from "../models/warden.model.js";
import { Otp } from "../models/otp.model.js";
import fs from "fs";
import path from "path";
import { Student } from "../models/student.model.js";

// Nodemailer transporter
const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: +process.env.MAIL_PORT,
  secure: process.env.MAIL_SECURE === "true",
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

// //  Login warden
// const login = async (req, res) => {
//   const { wardenId, password } = req.body;

//   try {
//     const warden = await Warden.findOne({ wardenId });
//     if (!warden) return res.status(401).json({ message: "Invalid warden ID" });

//     const isMatch = await warden.comparePassword(password);
//     if (!isMatch) return res.status(401).json({ message: "Invalid password" });

//     return res.json({
//       message: "Login successful",
//       wardenId,
//       name: `${warden.firstName} ${warden.lastName}`,
//     });
//   } catch (err) {
//     console.error("Warden login error:", err);
//     return res.status(500).json({ message: "Server error during login." });
//   }
// };




import jwt from "jsonwebtoken";


// --------------------
// POST /api/wardenauth/login
// --------------------
 const login = async (req, res) => {
  const { wardenId, password } = req.body;

  try {
    const warden = await Warden.findOne({ wardenId });
    if (!warden) return res.status(401).json({ message: "Invalid Warden ID" });

    const isMatch = await warden.comparePassword(password);
    if (!isMatch) return res.status(401).json({ message: "Invalid password" });

    // ✅ Generate JWT Token
    const token = jwt.sign(
      {
        id: warden._id,
        wardenId: warden.wardenId,
        role: "warden",
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" } // token valid for 1 day
    );

    res.status(200).json({
      message: "Login successful",
      token,
      warden: {
        id: warden._id,
        wardenId: warden.wardenId,
        name: `${warden.firstName} ${warden.lastName}`,
        email: warden.email,
        phone: warden.phone,
        profilePhoto: warden.profilePhoto || null,
      },
    });
  } catch (err) {
    console.error("Warden login error:", err);
    res.status(500).json({ message: "Server error during login." });
  }
};


//  Forgot Password
const forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const warden = await Warden.findOne({ email });
    if (!warden) return res.status(400).json({ message: "Email not found" });

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const expires = new Date(Date.now() + 10 * 60 * 1000);

    await Otp.findOneAndUpdate(
      { email },
      { code: otp, expires, verified: false },
      { upsert: true }
    );

    await transporter.sendMail({
      from: `"Hostel Admin" <${process.env.MAIL_USER}>`,
      to: email,
      subject: "Warden Password Reset OTP",
      text: `Dear ${warden.firstName} ${warden.lastName},\n\nYour OTP for password reset is ${otp}. It expires in 10 minutes.\n\n– Hostel Admin`,
    });

    return res.json({ message: "OTP sent" });
  } catch (err) {
    console.error("Warden forgot password error:", err);
    return res.status(500).json({ message: "Error sending OTP." });
  }
};

//  Verify OTP
const verifyOtp = async (req, res) => {
  const { email, otp } = req.body;

  const record = await Otp.findOne({ email, code: otp });

  if (!record || record.expires < Date.now()) {
    return res.status(400).json({ message: "Invalid or expired OTP" });
  }

  record.verified = true;
  await record.save();
  return res.json({ message: "OTP verified" });
};


//  Reset Password
const resetPassword = async (req, res) => {
  const { email, otp, newPassword } = req.body;

  const record = await Otp.findOne({ email, code: otp, verified: true });

  if (!record) {
    return res.status(400).json({ message: "OTP not verified" });
  }

  try {
    const warden = await Warden.findOne({ email });
    if (!warden) return res.status(404).json({ message: "Warden not found" });

    // Just assign plain password — schema will hash it
    warden.password = newPassword;
    await warden.save();

    // Clean up OTP
    await Otp.deleteOne({ email });

    return res.json({ message: "Password has been reset" });
  } catch (err) {
    console.error("Warden reset password error:", err);
    return res.status(500).json({ message: "Error resetting password." });
  }
};






// GET warden profile

const getWardenProfile = async (req, res) => {
  try {
    const warden = await Warden.findById(req.params.id).select(
      "firstName lastName contactNumber email wardenId profilePhoto"
    );

    if (!warden) {
      return res.status(404).json({ message: "Warden not found" });
    }

    res.status(200).json(warden);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};


// update wardenprofile

 const updateWardenProfile = async (req, res) => {
  try {
    const { firstName, lastName, email, contactNumber } = req.body;

    let warden = await Warden.findById(req.params.id);
    if (!warden) return res.status(404).json({ message: "Warden not found" });

    warden.firstName = firstName || warden.firstName;
    warden.lastName = lastName || warden.lastName;
    warden.email = email || warden.email;
    warden.contactNumber = contactNumber || warden.contactNumber;

    if (req.file) {
      // Delete old profile photo if exists
      if (warden.profilePhoto) {
        const oldPath = `uploads/${warden.profilePhoto}`;
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      warden.profilePhoto = req.file.filename;
    }

    await warden.save();
    res.status(200).json({ message: "Profile updated successfully", warden });
  } catch (error) {
    res.status(500).json({ message: "Update failed", error });
  }
};





const getEmergencyContacts = async (req, res) => {
  try {
    const { studentName, studentId } = req.query;

    // Build dynamic search filter
    let filter = {};

    if (studentName) {
      filter.studentName = { $regex: studentName, $options: 'i' }; // Case-insensitive search
    }

    if (studentId) {
      filter.studentId = { $regex: studentId, $options: 'i' }; // Case-insensitive partial match
    }

    const students = await Student.find(filter, {
      studentId: 1,
      studentName: 1,
      emergencyContactName: 1,
      relation: 1,
      emergencyContactNumber: 1,
      _id: 0,
    });

    res.status(200).json({
      success: true,
      contacts: students,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch emergency contacts",
      error: error.message,
    });
  }
};


// Get student list for warden

const getStudentListForWarden = async (req, res) => {
  try {
    const { studentId, roomBedNumber } = req.query;

    // Build dynamic search filter
    let filter = {};

    if (studentId) {
      filter.studentId = { $regex: studentId, $options: "i" }; // case-insensitive partial match
    }

    if (roomBedNumber) {
      filter.roomBedNumber = { $regex: roomBedNumber, $options: "i" };
    }

    const students = await Student.find(filter, {
      studentId: 1,
      studentName: 1,
      roomBedNumber: 1,
      contactNumber: 1,
      _id: 0,
    });

    res.status(200).json({
      success: true,
      students,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch student list",
      error: error.message,
    });
  }
};

// Update student room/bed number

const updateStudentRoom = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { roomBedNumber } = req.body;

    const student = await Student.findOneAndUpdate(
      { studentId },
      { roomBedNumber },
      { new: true } // returns the updated document
    );

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Room/Bed number updated successfully",
      student,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update student room",
      error: error.message,
    });
  }
};



// Get total number of students
const getTotalStudents = async (req, res) => {
  try {
    const count = await Student.countDocuments();

    res.status(200).json({
      success: true,
      totalStudents: count,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to get total students",
      error: error.message,
    });
  }
};

// POST /api/warden/attendance/punch-in
const punchIn = async (req, res) => {
  try {
    const wardenId = req.user.id;
    const warden = await Warden.findById(wardenId);

    if (!warden) return res.status(404).json({ message: 'Warden not found' });

    const today = new Date().toDateString();
    const alreadyPunchedIn = warden.attendanceLog.find(entry =>
      new Date(entry.date).toDateString() === today
    );

    if (alreadyPunchedIn) {
      return res.status(400).json({ message: 'Already punched in for today' });
    }

    warden.attendanceLog.push({
      date: new Date(),
      punchIn: new Date(),
      punchOut: null,
      totalHours: null,
    });

    await warden.save();
    res.status(200).json({ message: 'Punch in recorded successfully' });

  } catch (error) {
    console.error('Punch In Error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};




// POST /api/warden/attendance/punch-out
const punchOut = async (req, res) => {
  try {
    const wardenId = req.user.id;
    const warden = await Warden.findById(wardenId);

    if (!warden) return res.status(404).json({ message: 'Warden not found' });

    const today = new Date().toDateString();
    const log = warden.attendanceLog.find(entry =>
      new Date(entry.date).toDateString() === today
    );

    if (!log) return res.status(400).json({ message: 'Punch in not found for today' });
    if (log.punchOut) return res.status(400).json({ message: 'Already punched out for today' });

    log.punchOut = new Date();
    const durationMs = log.punchOut - log.punchIn;
    log.totalHours = Math.round((durationMs / (1000 * 60 * 60)) * 100) / 100;

    await warden.save();
    res.status(200).json({ message: 'Punch out recorded successfully' });

  } catch (error) {
    console.error('Punch Out Error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};




// GET /api/warden/attendance/log
const getAttendanceLog = async (req, res) => {
  try {
    const wardenId = req.user.id;
    const warden = await Warden.findById(wardenId);

    if (!warden) return res.status(404).json({ message: 'Warden not found' });

    const log = warden.attendanceLog.sort((a, b) => new Date(b.date) - new Date(a.date)); // recent first
    res.status(200).json({ attendanceLog: log });

  } catch (error) {
    console.error('Get Attendance Log Error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};


export {
  login as loginWarden,
  forgotPassword as forgotPasswordWarden,
  verifyOtp as verifyOtpWarden,
  resetPassword as resetPasswordWarden,
  getWardenProfile,
  updateWardenProfile,
  getEmergencyContacts,
  getStudentListForWarden,
  updateStudentRoom,
  getTotalStudents,
  punchIn as punchInWarden,
  punchOut as punchOutWarden,
  getAttendanceLog,
};
