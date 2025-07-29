import 'dotenv/config';
import mongoose from 'mongoose';
import { Admin } from '../models/admin.model.js';
import { Inspection } from '../models/inspection.model.js';
import nodemailer from 'nodemailer';
import bcrypt from "bcrypt";
import jwt from 'jsonwebtoken';
import { Student } from '../models/student.model.js';
import { Parent } from '../models/parent.model.js';
import { Otp } from '../models/otp.model.js';
import { Warden } from '../models/warden.model.js';
import { Notice } from '../models/notice.model.js';
import { Inventory } from '../models/inventory.model.js';
import path from 'path';
import multer from 'multer';

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

const login =
 async (req, res) => {
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
    firstName,
    lastName,
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
  const cleanName = firstName.replace(/\s+/g, '').toLowerCase();
  const password = `${cleanName}${studentId}`;

  try {
    // Create student record
    const newStudent = new Student({
      firstName,
      lastName,
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
      text: `Hello ${firstName}, ${lastName}

Your student account has been created.

• Student ID: ${studentId}
• Password: ${password}

Please log in at https://www.KGF-HM.com and change your password after first login.

– Hostel Admin`
    });

    return res.json({
      message: 'Student registered and credentials emailed.',
      student: { firstName, lastName, studentId, email, password }
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
     const { firstName,lastName, email, wardenId, contactNumber} = req.body;

  try {
    // Check if the warden already exists by email
    const existingWarden = await Warden.findOne({ email });
    if (existingWarden) {
      return res.status(409).json({ message: "Warden already exists with the same email." });
    }

    // Generate a password for the warden (can be a combination of firstName, lastName, or something else)
    const cleanName = firstName.replace(/\s+/g, '').toLowerCase(); // Remove spaces from first name
    const wardenPassword = `${cleanName}${lastName}`; // Password will be a combination of firstName and lastName

    // Create new warden record
    const newWarden = new Warden({
      firstName,
      lastName,
      email,
      wardenId,
      contactNumber,
      password: wardenPassword
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
• Warden ID: ${wardenId}
• Your Login Password: ${wardenPassword}

Please log in at https://www.KGF-HM.com and change your password after first login.

– Hostel Admin`
    });

    return res.json({
      message: 'Warden registered and login credentials emailed.',
      warden: { firstName, lastName, email, wardenId, wardenPassword }
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

// ✅ File upload config (store in /uploads/receipts/)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/receipts/');
  },
  filename: (req, file, cb) => {
    cb(null, `receipt-${Date.now()}${path.extname(file.originalname)}`);
  }
});
const upload = multer({ storage });

const addInventoryItem = async (req, res) => {
  try {
    const {
      itemName,
      barcodeId,
      category,
      location,
      status,
      description,
      purchaseDate,
      purchaseCost
    } = req.body;

    const receiptUrl = req.file ? `/uploads/receipts/${req.file.filename}` : null;

    const newItem = new Inventory({
      itemName,
      barcodeId,
      category,
      location,
      status,
      description,
      purchaseDate,
      purchaseCost,
      receiptUrl
    });

    await newItem.save();
    return res.status(201).json({ message: "Inventory item added successfully", item: newItem });

  } catch (err) {
    console.error("Add Inventory Error:", err);
    return res.status(500).json({ message: "Failed to add inventory item." });
  }
};

const issueNotice = async (req, res) => {
  const {
    template,
    title,
    message,
    issueDate,
    recipientType,
    individualRecipient
  } = req.body;

  try {
    const notice = await Notice.create({
      template,
      title,
      message,
      issueDate,
      recipientType,
      individualRecipient
    });

    const subject = `Hostel Notice: ${title}`;
    const emailBody = `
${message}

Issued on: ${new Date(issueDate).toLocaleDateString("en-IN")}

– Hostel Admin
`;

    let recipients = [];

    if (recipientType === 'All') {
      const students = await Student.find({}, 'email');
      const parents = await Parent.find({}, 'email');
      const wardens = await Warden.find({}, 'email');

      recipients = [
        ...students.map(s => s.email).filter(Boolean),
        ...parents.map(p => p.email).filter(Boolean),
        ...wardens.map(w => w.email).filter(Boolean)
      ];
    } else if (recipientType === 'Student') {
      if (!individualRecipient) {
        const students = await Student.find({}, 'email');
        recipients = students.map(s => s.email).filter(Boolean);
      } else {
        const student = await Student.findOne({ studentId: individualRecipient });
        if (student?.email) recipients.push(student.email);
      }
    } else if (recipientType === 'Parent') {
      if (!individualRecipient) {
        const parents = await Parent.find({}, 'email');
        recipients = parents.map(p => p.email).filter(Boolean);
      } else {
        const parent = await Parent.findOne({ studentId: individualRecipient });
        if (parent?.email) recipients.push(parent.email);
      }
    } else if (recipientType === 'Warden') {
      if (!individualRecipient) {
        const wardens = await Warden.find({}, 'email');
        recipients = wardens.map(w => w.email).filter(Boolean);
      } else {
        const warden = await Warden.findOne({ wardenId: individualRecipient });
        if (warden?.email) recipients.push(warden.email);
      }
    }

    if (recipients.length === 0) {
      return res.status(400).json({ message: "No recipients found to send notice." });
    }

    for (const email of recipients) {
      const result = await transporter.sendMail({
        from: `"Hostel Admin" <${process.env.MAIL_USER}>`,
        to: email,
        subject,
        text: emailBody
      });

      console.log(`📤 Email sent to ${email} - MessageId: ${result.messageId}`);
    }

    return res.status(201).json({ message: "Notice issued and emailed successfully", notice });
  } catch (err) {
    console.error("Issue notice error:", err);
    return res.status(500).json({ message: "Failed to issue notice" });
  }
};

// Create a new inspection
const createInspection = async (req, res) => {
  try {
    const { title, target, area, datetime, instructions, adminId } = req.body;

    console.log("Received adminId:", adminId);

    // Check if adminId is provided
    if (!adminId || adminId.trim() === '') {
      return res.status(400).json({ message: "adminId is required" });
    }

    if (!title || !target || !area || !datetime || !instructions) {
      return res.status(400).json({
        message: "All fields (title, target, area, datetime, instructions) are required",
      });
    }

    // Find admin by the custom adminId field, not by _id
    const admin = await Admin.findOne({ adminId: adminId });
    if (!admin) {
      return res.status(404).json({ message: "Admin not found with this adminId" });
    }

    console.log("Found admin:", admin);

    const newInspection = new Inspection({
      title,
      target,
      area,
      datetime,
      instructions,
      createdBy: admin._id, // Use the MongoDB _id for the relationship
      status: "pending",
    });

    await newInspection.save();

    return res.status(201).json({
      message: "Inspection created successfully",
      inspection: newInspection,
    });
  } catch (err) {
    console.error("Create inspection error:", err);
    return res.status(500).json({
      message: "Error creating inspection",
      error: err.message,
    });
  }
};

// Get all inspections for an admin
const getAdminInspections = async (req, res) => {
  try {
    const { adminId } = req.query;

    if (!adminId || !mongoose.Types.adminId.isValid(adminId)) {
      return res.status(400).json({ message: "Valid adminId is required" });
    }

    const inspections = await Inspection.find({ createdBy: adminId })
      .populate("createdBy", "email")
      .sort({ datetime: -1 });

    return res.status(200).json({
      message: "Inspections retrieved successfully",
      inspections,
    });
  } catch (err) {
    console.error("Get inspections error:", err);
    return res.status(500).json({
      message: "Error fetching inspections",
      error: err.message,
    });
  }
};

// Get a single inspection by ID
const getInspectionById = async (req, res) => {
  try {
    const inspection = await Inspection.findById(req.params.id).populate(
      "createdBy",
      "email"
    );

    if (!inspection) {
      return res.status(404).json({ message: "Inspection not found" });
    }

    return res.status(200).json({
      message: "Inspection retrieved successfully",
      inspection,
    });
  } catch (err) {
    console.error("Get inspection error:", err);
    return res.status(500).json({
      message: "Error fetching inspection",
      error: err.message,
    });
  }
};

// Update an inspection
const updateInspection = async (req, res) => {
  try {
    const { title, target, area, datetime, instructions, status } = req.body;
    const inspection = await Inspection.findById(req.params.id);

    if (!inspection) {
      return res.status(404).json({ message: "Inspection not found" });
    }

    inspection.title = title || inspection.title;
    inspection.target = target || inspection.target;
    inspection.area = area || inspection.area;
    inspection.datetime = datetime || inspection.datetime;
    inspection.instructions = instructions || inspection.instructions;
    inspection.status = status || inspection.status;

    await inspection.save();

    return res.status(200).json({
      message: "Inspection updated successfully",
      inspection,
    });
  } catch (err) {
    console.error("Update inspection error:", err);
    return res.status(500).json({
      message: "Error updating inspection",
      error: err.message,
    });
  }
};

// Delete an inspection
const deleteInspection = async (req, res) => {
  try {
    const inspection = await Inspection.findById(req.params.id);

    if (!inspection) {
      return res.status(404).json({ message: "Inspection not found" });
    }

    await inspection.deleteOne();

    return res.status(200).json({ message: "Inspection deleted successfully" });
  } catch (err) {
    console.error("Delete inspection error:", err);
    return res.status(500).json({
      message: "Error deleting inspection",
      error: err.message,
    });
  }
};

// Get inspection history
const getInspectionHistory = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      startDate,
      endDate,
      area,
      target,
    } = req.query;

    const query = {};
    if (status) query.status = status;
    if (area) query.area = { $regex: area, $options: "i" };
    if (target) query.target = { $regex: target, $options: "i" };
    if (startDate || endDate) {
      query.datetime = {};
      if (startDate) query.datetime.$gte = new Date(startDate);
      if (endDate) query.datetime.$lte = new Date(endDate);
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const inspections = await Inspection.find(query)
      .populate("createdBy", "email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await Inspection.countDocuments(query);

    return res.status(200).json({
      message: "Inspection history retrieved successfully",
      inspections,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    console.error("Get inspection history error:", err);
    return res.status(500).json({
      message: "Error fetching inspection history",
      error: err.message,
    });
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
  getBedOccupancyStatus,
  issueNotice,
  upload,
  addInventoryItem,
  createInspection,
  getAdminInspections,
  getInspectionById,
  updateInspection,
  deleteInspection,
  getInspectionHistory,
};