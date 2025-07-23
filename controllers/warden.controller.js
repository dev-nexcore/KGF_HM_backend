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

//  Login warden
const login = async (req, res) => {
  const { wardenId, password } = req.body;

  try {
    const warden = await Warden.findOne({ wardenId });
    if (!warden) return res.status(401).json({ message: "Invalid warden ID" });

    const isMatch = await warden.comparePassword(password);
    if (!isMatch) return res.status(401).json({ message: "Invalid password" });

    return res.json({
      message: "Login successful",
      wardenId,
      name: `${warden.firstName} ${warden.lastName}`,
    });
  } catch (err) {
    console.error("Warden login error:", err);
    return res.status(500).json({ message: "Server error during login." });
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


// Get emergency contacts of all students

// const getEmergencyContacts = async (req, res) => {
//   try {
//     const students = await Student.find({}, {
//       studentId: 1,
//       studentName: 1,
//       emergencyContactName: 1,
//       relation: 1,
//       emergencyContactNumber: 1,
//       _id: 0
//     });

//     res.status(200).json({
//       success: true,
//       contacts: students,
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: "Failed to fetch emergency contacts",
//       error: error.message,
//     });
//   }
// };



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




export {
  login as loginWarden,
  forgotPassword as forgotPasswordWarden,
  verifyOtp as verifyOtpWarden,
  resetPassword as resetPasswordWarden,
  getWardenProfile,
  updateWardenProfile,
  getEmergencyContacts,
};
