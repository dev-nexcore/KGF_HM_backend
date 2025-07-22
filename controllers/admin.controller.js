import 'dotenv/config';
import {Admin} from '../models/admin.model.js';
import nodemailer from 'nodemailer';
import bcrypt from "bcrypt";
import jwt from 'jsonwebtoken';
import { Student } from '../models/student.model.js';
import { Parent } from '../models/parent.model.js';
import { Otp } from '../models/otp.model.js';

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

const generateToken = (admin) => {
  return jwt.sign(
    { adminId: admin.adminId, email: admin.email }, 
    process.env.JWT_SECRET, 
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );
};


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

const generateRefreshToken = (admin) => {
  const refreshToken = jwt.sign(
    { adminId: admin.adminId, email: admin.email },
    process.env.JWT_SECRET, // Same secret as access token
    { expiresIn: "30d" } // Longer expiration for refresh token (e.g., 30 days)
  );
  
  // Save refresh token to database (MongoDB)
  admin.refreshToken = refreshToken;
  admin.save(); // Save to database
  
  return refreshToken;
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

    const token = generateToken(admin);
    const refreshToken = generateRefreshToken(admin);

    return res.json({ message: "Login successful",token,refreshToken,admin:{ adminId: admin.adminId, adminEmail: admin.email } });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ message: "Server error during login." });
  }
};

const refreshAccessToken = async (req, res) => {
  const { refreshToken } = req.body;

  try {
    if (!refreshToken) {
      return res.status(401).json({ message: "No refresh token provided" });
    }

    const decoded = jwt.verify(refreshToken, JWT_SECRET); // Verify the refresh token

    const admin = await Admin.findOne({ adminId: decoded.adminId });
    if (!admin || admin.refreshTokens !== refreshToken) {
      return res.status(401).json({ message: "Invalid or expired refresh token" });
    }

    const newAccessToken = generateToken(admin); // New access token
    const newRefreshToken = generateRefreshToken(admin); // New refresh token
    
    return res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken
    });
  } catch (err) {
    console.error("Refresh token error:", err);
    return res.status(401).json({ message: "Invalid or expired refresh token" });
  }
};



const forgotPassword = async (req, res) => {
  const { email } = req.body;

  const admin = await Admin.findOne({ email });
  if (!admin) {
    return res.status(400).json({ message: "Email not recognized" });
  }

  const otp = String(Math.floor(100000 + Math.random() * 900000));
  await Otp.findOneAndUpdate(
    {email},
    { code: otp, expires, verified: false },
    { upsert: true }
  );

  await transporter.sendMail({
    from: `"Hostel Admin" <${process.env.MAIL_USER}>`,
    to: email,
    subject: "Admin Password Reset OTP",
    text: `Your OTP is ${otp}. Expires in 10 minutes.`
  });

  return res.json({ message: "OTP sent" });
};


const verifyOtp = async (req, res) => {
  const { email, otp } = req.body;
  await Otp.findOne({ email, code});
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
  const record = await Otp.findOne({ email, code: otp, verified: true });

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

  await Otp.deleteOne({ email });

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
  const password = `${cleanName}${studentId}`;

  try {
    // Create student record
    const newStudent = new Student({
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
    });

    await newStudent.save();

    // Send email with student credentials
    await transporter.sendMail({
      from: `"Hostel Admin" <${process.env.MAIL_USER}>`,
      to: email,
      subject: 'Your Student Panel Credentials',
      text: `Hello ${studentName},

Your student account has been created.

• Student ID: ${studentId}
• Password: ${password}

Please log in at https://www.KGF-HM.com and change your password after first login.

– Hostel Admin`
    });

    return res.json({
      message: 'Student registered and credentials emailed.',
      student: { studentName, studentId, email, password }
    });
  } catch (err) {
    console.error('Error registering student:', err);
    return res.status(500).json({ message: 'Error registering student.' });
  }
};


const registerParent = async (req, res) => {
  const { firstName, lastName, email, contactNumber, studentId } = req.body;

  try {
    // Check if the parent already exists
    const existingParent = await Parent.findOne({ studentId });
    if (existingParent) {
      return res.status(409).json({ message: "Parent already exists with the same ID or email." });
    }

    // Fetch the student details from the database using studentId
    const student = await Student.findOne({ studentId });
    if (!student) {
      return res.status(404).json({ message: "Student not found with the provided studentId." });
    }

    // Generate password for the parent
    const cleanName = firstName.replace(/\s+/g, '').toLowerCase(); // Remove spaces from first name
    const parentPassword = `${cleanName}${studentId}`; // Password will be a combination of firstName and student's studentId

    // Create new parent record
    const newParent = new Parent({
      firstName,
      lastName,
      email,
      contactNumber,
      studentId,
      password: parentPassword 
    });

    await newParent.save();

    // Send email with the login credentials
    await transporter.sendMail({
      from: `"Hostel Admin" <${process.env.MAIL_USER}>`,
      to: email,
      subject: 'Your Parent Panel Credentials',
      text: `Hello ${firstName} ${lastName},

Your parent account has been created.


• Your Child's Student ID: ${studentId}
• Your Login Password: ${parentPassword}

Please log in at https://www.KGF-HM.com and change your password after first login.

– Hostel Admin`
    });

    return res.json({
      message: 'Parent registered and login credentials emailed.',
      parent: { firstName, lastName, email, studentId, parentPassword }
    });
  } catch (err) {
    console.error("Error registering parent:", err);
    return res.status(500).json({ message: "Error registering parent." });
  }
};

const registerWarden = async (req, res) => {
  const { firstName, lastName, email, contactNumber, wardenId } = req.body;

  try {
    // Check if the warden already exists by email
    const existingWarden = await Warden.findOne({ email });
    if (existingWarden) {
      return res.status(409).json({ message: "Warden already exists with the same email." });
    }

    // Generate a password for the warden (can be a combination of firstName, lastName, or something else)
    const cleanName = firstName.replace(/\s+/g, '').toLowerCase(); // Remove spaces from first name
    const password = `${cleanName}${lastName}`; // Password will be a combination of firstName and lastName

    // Create new warden record
    const newWarden = new Warden({
      firstName,
      lastName,
      email,
      contactNumber,
      password,
      wardenId // Set the generated password
    });

    await newWarden.save();

    // Send email with the login credentials
    await transporter.sendMail({
      from: `"Hostel Admin" <${process.env.MAIL_USER}>`,
      to: email,
      subject: 'Your Warden Panel Credentials',
      text: `Hello ${firstName} ${lastName},

Your warden account has been created.

• Warden Name: ${firstName} ${lastName}
• Your Login Password: ${password}

Please log in at https://www.KGF-HM.com and change your password after first login.

– Hostel Admin`
    });

    return res.json({
      message: 'Warden registered and login credentials emailed.',
      warden: { firstName, lastName, email }
    });
  } catch (err) {
    console.error("Error registering warden:", err);
    return res.status(500).json({ message: "Error registering warden." });
  }
};


const getTodaysCheckInOutStatus = async (req, res) => {
  try {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    // Find students who checked in today
    const checkIns = await Student.find({
      checkInDate: { $gte: startOfDay, $lte: endOfDay }
    });

    // Find students who checked out today
    const checkOuts = await Student.find({
      checkOutDate: { $gte: startOfDay, $lte: endOfDay }
    });

    return res.json({
      checkIns: checkIns.length,
      checkOuts: checkOuts.length
    });
  } catch (err) {
    console.error("Error fetching today's check-in/check-out data:", err);
    return res.status(500).json({ message: "Error fetching data." });
  }
};

const getBedOccupancyStatus = async (req, res) => {
  try {
    // Get all students with a room number
    const totalBeds = await Student.countDocuments({ roomBedNumber: { $ne: null } });

    // Get the number of students who have checked in
    const occupiedBeds = await Student.countDocuments({
      roomBedNumber: { $ne: null }
      
    });

    const availableBeds = totalBeds - occupiedBeds;

    return res.json({
      totalBeds,

      occupiedBeds,
      availableBeds
    });
  } catch (err) {
    console.error("Error fetching bed occupancy data:", err);
    return res.status(500).json({ message: "Error fetching data." });
  }
};


export {
    resetPassword,
    verifyOtp,
    forgotPassword,
    register,
    login,
    registerStudent,
    registerParent,
    registerWarden,
    refreshAccessToken,
    generateRefreshToken,
    getTodaysCheckInOutStatus,
    getBedOccupancyStatus
};
