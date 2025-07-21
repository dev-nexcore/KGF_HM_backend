import 'dotenv/config';

import nodemailer from 'nodemailer';
import bcrypt from "bcrypt";

// simple in-memory stores
const otpStore = {};       
const studentStore = [];  // { [email]: { code, expires, verified } }
let adminPassword = process.env.ADMIN_PASSWORD;

// configure SMTP transporter
const transporter = nodemailer.createTransport({

    host:    process.env.MAIL_HOST,      // smtp.gmail.com
  port:   +process.env.MAIL_PORT,      // 587
  secure: process.env.MAIL_SECURE === 'true',
 
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  }
});

const register = async (req, res) => {
  const { adminId, email, password } = req.body;

  try {
    const existingAdmin = await Admin.findOne({ $or: [{ adminId }, { email }] });
    if (existingAdmin) {
      return res.status(409).json({ message: "Admin already exists with same ID or email." });
    }

    const newAdmin = new Admin({ adminId, email, password });
    await newAdmin.save();

    return res.status(201).json({ message: "Admin registered successfully." });
  } catch (err) {
    console.error("Admin registration error:", err);
    return res.status(500).json({ message: "Server error during registration." });
  }
};


const login = async (req, res) => {
  const { adminId, password } = req.body;

  try {
    const admin = await Admin.findOne({ adminId });
    if (!admin) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    return res.json({ message: "Login successful", adminId: admin.adminId });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ message: "Server error during login." });
  }
};


const forgotPassword = async (req, res) => {
  const { email } = req.body;

  const admin = await Admin.findOne({ email });
  if (!admin) {
    return res.status(400).json({ message: "Email not recognized" });
  }

  const otp = String(Math.floor(100000 + Math.random() * 900000));
  otpStore[email] = {
    code: otp,
    expires: Date.now() + 10 * 60 * 1000,
    verified: false
  };

  await transporter.sendMail({
    from: `"Hostel Admin" <${process.env.MAIL_USER}>`,
    to: email,
    subject: "Admin Password Reset OTP",
    text: `Your OTP is ${otp}. Expires in 10 minutes.`
  });

  return res.json({ message: "OTP sent" });
};


const verifyOtp = (req, res) => {
  const { email, otp } = req.body;
  const record = otpStore[email];
  if (
    !record ||
    record.code !== otp ||
    record.expires < Date.now()
  ) {
    return res.status(400).json({ message: 'Invalid or expired OTP' });
  }
  record.verified = true;
  return res.json({ message: 'OTP verified' });
};

const resetPassword = async (req, res) => {
  const { email, otp, newPassword } = req.body;
  const record = otpStore[email];

  if (!record || record.code !== otp || !record.verified) {
    return res.status(400).json({ message: "OTP not verified" });
  }

  const admin = await Admin.findOne({ email });
  if (!admin) {
    return res.status(404).json({ message: "Admin not found" });
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  admin.password = hashedPassword;
  await admin.save();

  delete otpStore[email];

  return res.json({ message: "Password has been reset" });
};


const registerStudent = async (req, res) => {
  const {
    studentName,
    studentId,
    contactNumber,
    roomBedNumber,
    email,
    admissionDate,
    feeStatus,
    emergencyContactName,
    emergencyContactNumber
  } = req.body;

  // Generate a password: lowercase name (no spaces) + studentId
  const cleanName = studentName.replace(/\s+/g, '').toLowerCase();
  const password  = `${cleanName}${studentId}`;

  // Store student record (in-memory demo)
  const studentRecord = {
    studentName,
    studentId,
    contactNumber,
    roomBedNumber,
    email,
    admissionDate,
    feeStatus,
    emergencyContactName,
    emergencyContactNumber,
    password
  };
  studentStore.push(studentRecord);

  // Email credentials to student
  try {
    await transporter.sendMail({
      from:    `"Hostel Admin" <${process.env.MAIL_USER}>`,
      to:       email,
      subject: 'Your Student Panel Credentials',
      text:    `Hello ${studentName},

Your student account has been created.

• Student ID: ${studentId}
• Password:   ${password}

Please log in at https://www.KGF-HM.com and change your password after first login.

– Hostel Admin`
    });
  } catch (err) {
    console.error('Error sending student credentials:', err);
    return res
      .status(500)
      .json({ message: 'Student registered but failed to send email.' });
  }

  return res.json({
    message: 'Student registered and credentials emailed.',
    student: { studentName, studentId, email }
  });
};

export {
    resetPassword,
    verifyOtp,
    forgotPassword,
    register,
    login,
    registerStudent
};
