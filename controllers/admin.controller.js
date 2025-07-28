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
import { Leave } from '../models/leave.model.js';
import path from 'path';
import multer from 'multer';
import QRcode from 'qrcode';
import {nanoid} from 'nanoid';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { Complaint } from '../models/complaint.model.js';
import { AuditLog } from '../models/auditLog.model.js';
import { createAuditLog, AuditActionTypes } from '../utils/auditLogger.js';
import { StudentInvoice } from '../models/studentInvoice.model.js';
import { ManagementInvoice } from '../models/managementInvoice.model.js';
import { StaffSalary } from '../models/staffSalary.model.js';
import { Refund } from '../models/refund.model.js';
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

    await createAuditLog({
      adminId: admin._id,
      adminName: admin.adminId,
      actionType: AuditActionTypes.ADMIN_LOGIN,
      description: `Admin ${admin.adminId} logged in successfully`,
      targetType: 'System'
    });

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

    await createAuditLog({
      adminId: req.admin?._id, // Assuming you have admin info in req from auth middleware
      adminName: req.admin?.adminId || 'System',
      actionType: AuditActionTypes.STUDENT_REGISTERED,
      description: `Registered new student: ${studentName} (ID: ${studentId})`,
      targetType: 'Student',
      targetId: studentId,
      targetName: studentName,
      additionalData: {
        email,
        roomBedNumber,
        admissionDate
      }
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

// Financial Controllers for Dashboard - Revenue and Pending Payments Only

// Get total revenue from paid student invoices
const getTotalRevenue = async (req, res) => {
  try {
    const totalRevenue = await StudentInvoice.aggregate([
      { $match: { status: 'paid' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    return res.json({
      message: "Total revenue fetched successfully",
      totalRevenue: totalRevenue[0]?.total || 0
    });

  } catch (err) {
    console.error("Get total revenue error:", err);
    return res.status(500).json({ message: "Error fetching total revenue." });
  }
};

// Get pending payments from unpaid student invoices
const getPendingPayments = async (req, res) => {
  try {
    const pendingPayments = await StudentInvoice.aggregate([
      { $match: { status: 'pending' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    // Also get count of pending invoices
    const pendingCount = await StudentInvoice.countDocuments({ status: 'pending' });

    return res.json({
      message: "Pending payments fetched successfully",
      pendingPayments: pendingPayments[0]?.total || 0,
      pendingInvoicesCount: pendingCount
    });

  } catch (err) {
    console.error("Get pending payments error:", err);
    return res.status(500).json({ message: "Error fetching pending payments." });
  }
};

// Combined financial summary for dashboard
const getFinancialSummary = async (req, res) => {
  try {
    // Get total revenue
    const totalRevenue = await StudentInvoice.aggregate([
      { $match: { status: 'paid' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    // Get pending payments
    const pendingPayments = await StudentInvoice.aggregate([
      { $match: { status: 'pending' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    // Get overdue payments (past due date)
    const today = new Date();
    const overduePayments = await StudentInvoice.aggregate([
      { 
        $match: { 
          status: 'pending',
          dueDate: { $lt: today }
        } 
      },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    // Get counts
    const totalInvoices = await StudentInvoice.countDocuments();
    const paidInvoices = await StudentInvoice.countDocuments({ status: 'paid' });
    const pendingInvoices = await StudentInvoice.countDocuments({ status: 'pending' });
    const overdueInvoices = await StudentInvoice.countDocuments({ 
      status: 'pending',
      dueDate: { $lt: today }
    });

    return res.json({
      message: "Financial summary fetched successfully",
      revenue: {
        totalRevenue: totalRevenue[0]?.total || 0,
        pendingPayments: pendingPayments[0]?.total || 0,
        overduePayments: overduePayments[0]?.total || 0
      },
      invoiceCounts: {
        total: totalInvoices,
        paid: paidInvoices,
        pending: pendingInvoices,
        overdue: overdueInvoices
      }
    });

  } catch (err) {
    console.error("Get financial summary error:", err);
    return res.status(500).json({ message: "Error fetching financial summary." });
  }
};

const generateStudentInvoice = async (req, res) => {
  const { studentId, amount, invoiceType, dueDate, description } = req.body;

  try {
    // Find student
    const student = await Student.findOne({ studentId });
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    // Generate invoice number
    const invoiceCount = await StudentInvoice.countDocuments();
    const invoiceNumber = `INV-${Date.now()}-${(invoiceCount + 1).toString().padStart(4, '0')}`;

    // Create invoice
    const newInvoice = new StudentInvoice({
      studentId: student._id,
      invoiceNumber,
      amount,
      invoiceType,
      dueDate: new Date(dueDate),
      description,
      generatedBy: req.admin?._id
    });

    await newInvoice.save();

    // Create audit log
    await createAuditLog({
      adminId: req.admin?._id,
      adminName: req.admin?.adminId || 'System',
      actionType: 'Invoice Generated',
      description: `Generated invoice ${invoiceNumber} for ${student.studentName} - ₹${amount}`,
      targetType: 'Invoice',
      targetId: invoiceNumber,
      targetName: `${student.studentName} - ${invoiceType}`
    });

    return res.json({
      message: "Invoice generated successfully",
      invoice: {
        invoiceNumber,
        studentName: student.studentName,
        amount,
        dueDate,
        status: 'pending'
      }
    });

  } catch (err) {
    console.error("Generate invoice error:", err);
    return res.status(500).json({ message: "Error generating invoice." });
  }
};

const getStudentInvoices = async (req, res) => {
  try {
    const { status, page = 1, limit = 10, search } = req.query;

    let query = {};
    if (status && status !== 'all') {
      query.status = status;
    }

    const skip = (page - 1) * limit;

    // Get invoices with student details
    const invoices = await StudentInvoice.find(query)
      .populate('studentId', 'studentName studentId roomBedNumber email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Filter by search if provided
    let filteredInvoices = invoices;
    if (search) {
      filteredInvoices = invoices.filter(invoice => 
        invoice.studentId?.studentName?.toLowerCase().includes(search.toLowerCase()) ||
        invoice.invoiceNumber.toLowerCase().includes(search.toLowerCase())
      );
    }

    const totalInvoices = await StudentInvoice.countDocuments(query);

    return res.json({
      message: "Student invoices fetched successfully",
      invoices: filteredInvoices.map(invoice => ({
        _id: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        studentName: invoice.studentId?.studentName || 'Unknown',
        roomNumber: invoice.studentId?.roomBedNumber || 'N/A',
        amount: invoice.amount,
        dueDate: invoice.dueDate,
        status: invoice.status,
        invoiceType: invoice.invoiceType,
        paidDate: invoice.paidDate
      })),
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalInvoices / limit),
        totalInvoices
      }
    });

  } catch (err) {
    console.error("Get student invoices error:", err);
    return res.status(500).json({ message: "Error fetching student invoices." });
  }
};

const updateStudentInvoiceStatus = async (req, res) => {
  const { invoiceId } = req.params;
  const { status, paymentMethod, adminNotes } = req.body;

  try {
    const invoice = await StudentInvoice.findById(invoiceId)
      .populate('studentId', 'studentName studentId email');

    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    // Update invoice
    invoice.status = status;
    if (status === 'paid') {
      invoice.paidDate = new Date();
      invoice.paymentMethod = paymentMethod;
    }
    
    await invoice.save();

    // Create audit log
    await createAuditLog({
      adminId: req.admin?._id,
      adminName: req.admin?.adminId || 'System',
      actionType: `Invoice ${status.charAt(0).toUpperCase() + status.slice(1)}`,
      description: `Marked invoice ${invoice.invoiceNumber} as ${status} for ${invoice.studentId.studentName}`,
      targetType: 'Invoice',
      targetId: invoice.invoiceNumber,
      targetName: `${invoice.studentId.studentName} - ₹${invoice.amount}`
    });

    return res.json({
      message: `Invoice marked as ${status} successfully`,
      invoice: {
        invoiceNumber: invoice.invoiceNumber,
        status: invoice.status,
        paidDate: invoice.paidDate
      }
    });

  } catch (err) {
    console.error("Update invoice status error:", err);
    return res.status(500).json({ message: "Error updating invoice status." });
  }
};

// ====================== MANAGEMENT INVOICES ======================

const createManagementInvoice = async (req, res) => {
  const { vendorName, itemDescription, amount, category, purchaseDate } = req.body;

  try {
    // Generate invoice number
    const invoiceCount = await ManagementInvoice.countDocuments();
    const invoiceNumber = `MGT-${Date.now()}-${(invoiceCount + 1).toString().padStart(4, '0')}`;

    const newInvoice = new ManagementInvoice({
      invoiceNumber,
      vendorName,
      itemDescription,
      amount,
      category,
      purchaseDate: new Date(purchaseDate),
      processedBy: req.admin?._id
    });

    await newInvoice.save();

    // Create audit log
    await createAuditLog({
      adminId: req.admin?._id,
      adminName: req.admin?.adminId || 'System',
      actionType: 'Management Invoice Created',
      description: `Created management invoice ${invoiceNumber} for ${vendorName} - ₹${amount}`,
      targetType: 'Management Invoice',
      targetId: invoiceNumber,
      targetName: `${vendorName} - ${itemDescription}`
    });

    return res.json({
      message: "Management invoice created successfully",
      invoice: {
        invoiceNumber,
        vendorName,
        amount,
        status: 'pending'
      }
    });

  } catch (err) {
    console.error("Create management invoice error:", err);
    return res.status(500).json({ message: "Error creating management invoice." });
  }
};

const getManagementInvoices = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;

    let query = {};
    if (status && status !== 'all') {
      query.status = status;
    }

    const skip = (page - 1) * limit;

    const invoices = await ManagementInvoice.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalInvoices = await ManagementInvoice.countDocuments(query);

    return res.json({
      message: "Management invoices fetched successfully",
      invoices: invoices.map(invoice => ({
        _id: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        vendorName: invoice.vendorName,
        itemDescription: invoice.itemDescription,
        amount: invoice.amount,
        category: invoice.category,
        purchaseDate: invoice.purchaseDate,
        status: invoice.status
      })),
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalInvoices / limit),
        totalInvoices
      }
    });

  } catch (err) {
    console.error("Get management invoices error:", err);
    return res.status(500).json({ message: "Error fetching management invoices." });
  }
};

const updateManagementInvoiceStatus = async (req, res) => {
  const { invoiceId } = req.params;
  const { status, adminNotes } = req.body;

  try {
    const invoice = await ManagementInvoice.findById(invoiceId);

    if (!invoice) {
      return res.status(404).json({ message: "Management invoice not found" });
    }

    invoice.status = status;
    if (adminNotes) {
      invoice.adminNotes = adminNotes;
    }
    if (status === 'approved') {
      invoice.paymentDate = new Date();
    }

    await invoice.save();

    // Create audit log
    await createAuditLog({
      adminId: req.admin?._id,
      adminName: req.admin?.adminId || 'System',
      actionType: `Management Invoice ${status.charAt(0).toUpperCase() + status.slice(1)}`,
      description: `${status} management invoice ${invoice.invoiceNumber} for ${invoice.vendorName}`,
      targetType: 'Management Invoice',
      targetId: invoice.invoiceNumber,
      targetName: `${invoice.vendorName} - ₹${invoice.amount}`
    });

    return res.json({
      message: `Management invoice ${status} successfully`,
      invoice: {
        invoiceNumber: invoice.invoiceNumber,
        status: invoice.status
      }
    });

  } catch (err) {
    console.error("Update management invoice status error:", err);
    return res.status(500).json({ message: "Error updating management invoice status." });
  }
};


const generateStaffSalary = async (req, res) => {
  const { staffId, month, year, basicSalary, allowances, deductions, tax, pf, loanDeduction } = req.body;

  try {
    // Find staff member
    const staff = await Warden.findById(staffId);
    if (!staff) {
      return res.status(404).json({ message: "Staff member not found" });
    }

    // Check if salary already exists for this month/year
    const existingSalary = await StaffSalary.findOne({ staffId, month, year });
    if (existingSalary) {
      return res.status(400).json({ message: "Salary already generated for this month" });
    }

    // Calculate net salary
    const netSalary = basicSalary + allowances - deductions - tax - pf - loanDeduction;

    const newSalary = new StaffSalary({
      staffId,
      month,
      year,
      basicSalary,
      allowances,
      deductions,
      tax,
      pf,
      loanDeduction,
      netSalary,
      processedBy: req.admin?._id
    });

    await newSalary.save();

    // Create audit log
    await createAuditLog({
      adminId: req.admin?._id,
      adminName: req.admin?.adminId || 'System',
      actionType: 'Salary Generated',
      description: `Generated salary for ${staff.firstName} ${staff.lastName} for ${month}/${year} - ₹${netSalary}`,
      targetType: 'Salary',
      targetId: newSalary._id.toString(),
      targetName: `${staff.firstName} ${staff.lastName} - ${month}/${year}`
    });

    return res.json({
      message: "Staff salary generated successfully",
      salary: {
        staffName: `${staff.firstName} ${staff.lastName}`,
        month,
        year,
        netSalary,
        status: 'pending'
      }
    });

  } catch (err) {
    console.error("Generate staff salary error:", err);
    return res.status(500).json({ message: "Error generating staff salary." });
  }
};

const getStaffSalaries = async (req, res) => {
  try {
    const { month, year, status, page = 1, limit = 10 } = req.query;

    let query = {};
    if (month) query.month = month;
    if (year) query.year = parseInt(year);
    if (status && status !== 'all') query.status = status;

    const skip = (page - 1) * limit;

    const salaries = await StaffSalary.find(query)
      .populate('staffId', 'firstName lastName wardenId email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalSalaries = await StaffSalary.countDocuments(query);

    // Calculate totals for the current query
    const totals = await StaffSalary.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalPayroll: { $sum: '$basicSalary' },
          totalDeductions: { $sum: { $add: ['$deductions', '$tax', '$pf', '$loanDeduction'] } },
          totalPayout: { $sum: '$netSalary' }
        }
      }
    ]);

    return res.json({
      message: "Staff salaries fetched successfully",
      salaries: salaries.map(salary => ({
        _id: salary._id,
        staffName: `${salary.staffId.firstName} ${salary.staffId.lastName}`,
        role: 'Warden', // You can add role field to Warden model later
        month: salary.month,
        year: salary.year,
        basicSalary: salary.basicSalary,
        tax: salary.tax,
        pf: salary.pf,
        loanDeduction: salary.loanDeduction,
        netSalary: salary.netSalary,
        status: salary.status,
        paymentDate: salary.paymentDate
      })),
      totals: {
        totalPayroll: totals[0]?.totalPayroll || 0,
        totalDeductions: totals[0]?.totalDeductions || 0,
        totalPayout: totals[0]?.totalPayout || 0
      },
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalSalaries / limit),
        totalSalaries
      }
    });

  } catch (err) {
    console.error("Get staff salaries error:", err);
    return res.status(500).json({ message: "Error fetching staff salaries." });
  }
};

const updateSalaryStatus = async (req, res) => {
  const { salaryId } = req.params;
  const { status, paymentMethod } = req.body;

  try {
    const salary = await StaffSalary.findById(salaryId)
      .populate('staffId', 'firstName lastName wardenId');

    if (!salary) {
      return res.status(404).json({ message: "Salary record not found" });
    }

    salary.status = status;
    if (status === 'paid') {
      salary.paymentDate = new Date();
      salary.paymentMethod = paymentMethod;
    }

    await salary.save();

    // Create audit log
    await createAuditLog({
      adminId: req.admin?._id,
      adminName: req.admin?.adminId || 'System',
      actionType: `Salary ${status.charAt(0).toUpperCase() + status.slice(1)}`,
      description: `Marked salary as ${status} for ${salary.staffId.firstName} ${salary.staffId.lastName} - ₹${salary.netSalary}`,
      targetType: 'Salary',
      targetId: salaryId,
      targetName: `${salary.staffId.firstName} ${salary.staffId.lastName} - ${salary.month}/${salary.year}`
    });

    return res.json({
      message: `Salary marked as ${status} successfully`,
      salary: {
        staffName: `${salary.staffId.firstName} ${salary.staffId.lastName}`,
        status: salary.status,
        paymentDate: salary.paymentDate
      }
    });

  } catch (err) {
    console.error("Update salary status error:", err);
    return res.status(500).json({ message: "Error updating salary status." });
  }
};

const generateSalarySlip = async (req, res) => {
  const { salaryId } = req.params;

  try {
    const salary = await StaffSalary.findById(salaryId)
      .populate('staffId', 'firstName lastName wardenId email contactNumber');

    if (!salary) {
      return res.status(404).json({ message: "Salary record not found" });
    }

    // Generate detailed salary slip data
    const salarySlip = {
      staffDetails: {
        name: `${salary.staffId.firstName} ${salary.staffId.lastName}`,
        id: salary.staffId.wardenId,
        email: salary.staffId.email,
        contact: salary.staffId.contactNumber
      },
      salaryDetails: {
        month: salary.month,
        year: salary.year,
        basicSalary: salary.basicSalary,
        allowances: salary.allowances,
        grossSalary: salary.basicSalary + salary.allowances,
        deductions: {
          tax: salary.tax,
          pf: salary.pf,
          loanDeduction: salary.loanDeduction,
          otherDeductions: salary.deductions,
          totalDeductions: salary.tax + salary.pf + salary.loanDeduction + salary.deductions
        },
        netSalary: salary.netSalary,
        paymentDate: salary.paymentDate,
        status: salary.status
      },
      generatedAt: new Date(),
      generatedBy: req.admin?.adminId
    };

    return res.json({
      message: "Salary slip generated successfully",
      salarySlip
    });

  } catch (err) {
    console.error("Generate salary slip error:", err);
    return res.status(500).json({ message: "Error generating salary slip." });
  }
};

// ====================== REFUND MANAGEMENT ======================

const initiateRefund = async (req, res) => {
  const { studentId, amount, reason, paymentMethod } = req.body;

  try {
    // Find student
    const student = await Student.findOne({ studentId });
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    // Generate refund ID
    const refundCount = await Refund.countDocuments();
    const refundId = `REF-${Date.now()}-${(refundCount + 1).toString().padStart(4, '0')}`;

    const newRefund = new Refund({
      refundId,
      studentId: student._id,
      amount,
      reason,
      paymentMethod,
      processedBy: req.admin?._id
    });

    await newRefund.save();

    // Create audit log
    await createAuditLog({
      adminId: req.admin?._id,
      adminName: req.admin?.adminId || 'System',
      actionType: 'Refund Initiated',
      description: `Initiated refund ${refundId} for ${student.studentName} - ₹${amount}`,
      targetType: 'Refund',
      targetId: refundId,
      targetName: `${student.studentName} - ₹${amount}`
    });

    return res.json({
      message: "Refund initiated successfully",
      refund: {
        refundId,
        studentName: student.studentName,
        amount,
        status: 'pending'
      }
    });

  } catch (err) {
    console.error("Initiate refund error:", err);
    return res.status(500).json({ message: "Error initiating refund." });
  }
};

const getRefunds = async (req, res) => {
  try {
    const { status, page = 1, limit = 10, search } = req.query;

    let query = {};
    if (status && status !== 'all') {
      query.status = status;
    }

    const skip = (page - 1) * limit;

    const refunds = await Refund.find(query)
      .populate('studentId', 'studentName studentId')
      .populate('processedBy', 'adminId')
      .sort({ requestDate: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Filter by search if provided
    let filteredRefunds = refunds;
    if (search) {
      filteredRefunds = refunds.filter(refund => 
        refund.studentId?.studentName?.toLowerCase().includes(search.toLowerCase()) ||
        refund.refundId.toLowerCase().includes(search.toLowerCase())
      );
    }

    const totalRefunds = await Refund.countDocuments(query);

    return res.json({
      message: "Refunds fetched successfully",
      refunds: filteredRefunds.map(refund => ({
        _id: refund._id,
        refundId: refund.refundId,
        date: refund.requestDate,
        recipientName: refund.studentId?.studentName || 'Unknown',
        amount: refund.amount,
        reason: refund.reason,
        status: refund.status,
        processedBy: refund.processedBy?.adminId || 'N/A',
        processedDate: refund.processedDate,
        paymentMethod: refund.paymentMethod
      })),
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalRefunds / limit),
        totalRefunds
      }
    });

  } catch (err) {
    console.error("Get refunds error:", err);
    return res.status(500).json({ message: "Error fetching refunds." });
  }
};

const updateRefundStatus = async (req, res) => {
  const { refundId } = req.params;
  const { status, adminNotes, paymentMethod } = req.body;

  try {
    const refund = await Refund.findById(refundId)
      .populate('studentId', 'studentName studentId email');

    if (!refund) {
      return res.status(404).json({ message: "Refund not found" });
    }

    refund.status = status;
    if (adminNotes) {
      refund.adminNotes = adminNotes;
    }
    if (status === 'completed') {
      refund.processedDate = new Date();
      refund.paymentMethod = paymentMethod;
    }
    refund.processedBy = req.admin?._id;

    await refund.save();

    // Send email notification to student
    try {
      const statusText = status.toUpperCase();
      const statusEmoji = status === 'completed' ? '✅' : status === 'rejected' ? '❌' : '🔄';

      await transporter.sendMail({
        from: `"Hostel Admin" <${process.env.MAIL_USER}>`,
        to: refund.studentId.email,
        subject: `Refund Request ${statusText} - ${refund.refundId}`,
        text: `Hello ${refund.studentId.studentName},

${statusEmoji} Your refund request has been ${status}.

Refund Details:
• Refund ID: ${refund.refundId}
• Amount: ₹${refund.amount}
• Reason: ${refund.reason}
• Status: ${statusText}
${status === 'completed' ? `• Payment Method: ${paymentMethod}` : ''}
${adminNotes ? `• Admin Notes: ${adminNotes}` : ''}

Request Date: ${new Date(refund.requestDate).toLocaleDateString("en-IN")}
${status === 'completed' ? `Processed Date: ${new Date().toLocaleDateString("en-IN")}` : ''}

${status === 'completed' ? 
  'Your refund has been processed successfully.' : 
  status === 'rejected' ?
  'If you have any questions regarding this decision, please contact the hostel administration.' :
  'Your refund is being processed. You will be notified once completed.'}

– Hostel Admin`
      });
    } catch (emailErr) {
      console.error("Refund email error:", emailErr);
    }

    // Create audit log
    await createAuditLog({
      adminId: req.admin?._id,
      adminName: req.admin?.adminId || 'System',
      actionType: `Refund ${status.charAt(0).toUpperCase() + status.slice(1)}`,
      description: `${status} refund ${refund.refundId} for ${refund.studentId.studentName} - ₹${refund.amount}`,
      targetType: 'Refund',
      targetId: refund.refundId,
      targetName: `${refund.studentId.studentName} - ₹${refund.amount}`
    });

    return res.json({
      message: `Refund ${status} successfully`,
      refund: {
        refundId: refund.refundId,
        studentName: refund.studentId.studentName,
        status: refund.status,
        processedDate: refund.processedDate
      }
    });

  } catch (err) {
    console.error("Update refund status error:", err);
    return res.status(500).json({ message: "Error updating refund status." });
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
    const totalBeds = 75

    // Get the number of students who have checked in
   const occupiedBeds = await Student.countDocuments({ roomBedNumber: { $ne: null } });

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

// If you use ES modules and need __dirname:
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

    const publicSlug = nanoid(10); // short, non-guessable slug

    const newItem = new Inventory({
      itemName,
      barcodeId,
      category,
      location,
      status,
      description,
      purchaseDate,
      purchaseCost,
      receiptUrl,
      publicSlug
    });

    await newItem.save();

    const qrData = `${FRONTEND_BASE_URL}/p/${publicSlug}`;

    const qrCodesDir = path.join(process.cwd(), 'public', 'qrcodes');
    if (!fs.existsSync(qrCodesDir)) fs.mkdirSync(qrCodesDir, { recursive: true });

    const qrCodePath = path.join(qrCodesDir, `${newItem._id}.png`);
    await QRCode.toFile(qrCodePath, qrData);

    newItem.qrCodeUrl = `/public/qrcodes/${newItem._id}.png`;
    await newItem.save();

    return res.status(201).json({
      message: 'Inventory item added successfully',
      item: newItem,
      qrCodeUrl: newItem.qrCodeUrl,
      publicUrl: `${FRONTEND_BASE_URL}/p/${publicSlug}`
    });

  } catch (err) {
    console.error('Add Inventory Error:', err);
    return res.status(500).json({ message: 'Failed to add inventory item.' });
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

const getPendingLeaveRequests = async (req, res) => {
  try {
    const pendingLeaves = await Leave.find({ status: 'pending' })
      .populate('studentId', 'studentName studentId email contactNumber roomBedNumber')
      .select('leaveType startDate endDate reason status appliedAt')
      .sort({ appliedAt: -1 });

    return res.json({ 
      message: "Pending leave requests fetched successfully",
      leaves: pendingLeaves 
    });
  } catch (err) {
    console.error("Fetch pending leaves error:", err);
    return res.status(500).json({ message: "Server error while fetching pending leave requests." });
  }
};

// Get all leave requests (pending, approved, rejected)
const getAllLeaveRequests = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    
    // Handle filter mapping from frontend
    let query = {};
    if (status && status !== 'all') {
      query.status = status;
    }
    
    const skip = (page - 1) * limit;

    const leaves = await Leave.find(query)
      .populate('studentId', 'studentName studentId email contactNumber roomBedNumber')
      .select('leaveType startDate endDate reason status appliedAt processedAt adminComments')
      .sort({ appliedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalLeaves = await Leave.countDocuments(query);

    // Add summary counts for the filter tabs
    const statusCounts = await Leave.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const counts = {
      all: totalLeaves,
      pending: 0,
      approved: 0,
      rejected: 0
    };

    statusCounts.forEach(item => {
      counts[item._id] = item.count;
    });

    return res.json({ 
      message: "Leave requests fetched successfully",
      leaves,
      counts, // For the filter tab badges
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalLeaves / limit),
        totalLeaves,
        hasNextPage: page * limit < totalLeaves,
        hasPreviousPage: page > 1
      }
    });
  } catch (err) {
    console.error("Fetch all leaves error:", err);
    return res.status(500).json({ message: "Server error while fetching leave requests." });
  }
};

// Approve or reject a leave request
const updateLeaveStatus = async (req, res) => {
  const { leaveId } = req.params;
  const { status, adminComments } = req.body; // status should be 'approved' or 'rejected'

  try {
    // Validate status
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: "Invalid status. Must be 'approved' or 'rejected'." });
    }

    // Find the leave request
    const leave = await Leave.findById(leaveId).populate('studentId', 'studentName studentId email');
    
    if (!leave) {
      return res.status(404).json({ message: "Leave request not found." });
    }

    if (leave.status !== 'pending') {
      return res.status(400).json({ message: "Leave request has already been processed." });
    }

    // Update leave status
    leave.status = status;
    if (adminComments) {
      leave.adminComments = adminComments;
    }
    leave.processedAt = new Date();
    
    await leave.save();

    // Send email notification to student
    const student = leave.studentId;
    const statusText = status === 'approved' ? 'APPROVED' : 'REJECTED';
    const statusEmoji = status === 'approved' ? '✅' : '❌';

    const emailSubject = `Leave Request ${statusText} - ${leave.leaveType}`;
    const emailBody = `Hello ${student.studentName},

${statusEmoji} Your leave request has been ${statusText.toLowerCase()}.

Leave Details:
• Type: ${leave.leaveType}
• From: ${new Date(leave.startDate).toLocaleDateString("en-IN")}
• To: ${new Date(leave.endDate).toLocaleDateString("en-IN")}
• Reason: ${leave.reason}
• Status: ${statusText}
${adminComments ? `• Admin Comments: ${adminComments}` : ''}

Applied on: ${new Date(leave.appliedAt).toLocaleDateString("en-IN")}
Processed on: ${new Date().toLocaleDateString("en-IN")}

${status === 'approved' ? 
  'Please ensure you follow all hostel guidelines during your leave period.' : 
  'If you have any questions regarding this decision, please contact the hostel administration.'}

– Hostel Admin`;

    // Send email notification
    try {
      await transporter.sendMail({
        from: `"Hostel Admin" <${process.env.MAIL_USER}>`,
        to: student.email,
        subject: emailSubject,
        text: emailBody
      });
      console.log(`📤 Leave ${status} notification sent to ${student.email}`);
    } catch (emailErr) {
      console.error("Email sending error:", emailErr);
      // Don't fail the entire operation if email fails
    }

       await createAuditLog({
      adminId: req.admin?._id,
      adminName: req.admin?.adminId || 'System',
      actionType: status === 'approved' ? AuditActionTypes.LEAVE_APPROVED : AuditActionTypes.LEAVE_REJECTED,
      description: `${status === 'approved' ? 'Approved' : 'Rejected'} leave request for ${student.studentName} (${leave.leaveType})`,
      targetType: 'Leave',
      targetId: leaveId,
      targetName: `${student.studentName} - ${leave.leaveType}`,
      additionalData: {
        leaveType: leave.leaveType,
        startDate: leave.startDate,
        endDate: leave.endDate,
        adminComments
      }
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
        adminComments: leave.adminComments,
        processedAt: leave.processedAt,
        student: {
          studentName: student.studentName,
          studentId: student.studentId || student._id
        }
      }
    });

  } catch (err) {
    console.error("Update leave status error:", err);
    return res.status(500).json({ message: "Server error while updating leave status." });
  }
};

// Get leave statistics for dashboard
const getLeaveStatistics = async (req, res) => {
  try {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    // Get counts
    const totalPending = await Leave.countDocuments({ status: 'pending' });
    const totalApproved = await Leave.countDocuments({ status: 'approved' });
    const totalRejected = await Leave.countDocuments({ status: 'rejected' });
    const thisMonthLeaves = await Leave.countDocuments({
      appliedAt: { $gte: startOfMonth, $lte: endOfMonth }
    });

    // Get leave type breakdown
    const leaveTypeStats = await Leave.aggregate([
      {
        $group: {
          _id: '$leaveType',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get recent leave requests (last 5)
    const recentLeaves = await Leave.find()
      .populate('studentId', 'studentName studentId')
      .select('leaveType startDate endDate status appliedAt')
      .sort({ appliedAt: -1 })
      .limit(5);

    return res.json({
      message: "Leave statistics fetched successfully",
      statistics: {
        pending: totalPending,
        approved: totalApproved,
        rejected: totalRejected,
        thisMonth: thisMonthLeaves,
        total: totalPending + totalApproved + totalRejected
      },
      leaveTypeBreakdown: leaveTypeStats,
      recentLeaves
    });

  } catch (err) {
    console.error("Fetch leave statistics error:", err);
    return res.status(500).json({ message: "Server error while fetching leave statistics." });
  }
};

// Get leave requests for a specific student
const getStudentLeaveHistory = async (req, res) => {
  const { studentId } = req.params;

  try {
    const leaves = await Leave.find({ studentId })
      .populate('studentId', 'studentName studentId email')
      .select('leaveType startDate endDate reason status appliedAt processedAt adminComments')
      .sort({ appliedAt: -1 });

    if (leaves.length === 0) {
      return res.json({ 
        message: "No leave requests found for this student",
        leaves: [] 
      });
    }

    return res.json({ 
      message: "Student leave history fetched successfully",
      leaves 
    });

  } catch (err) {
    console.error("Fetch student leave history error:", err);
    return res.status(500).json({ message: "Server error while fetching student leave history." });
  }
};

// Send message/notification to student regarding leave
const sendLeaveMessage = async (req, res) => {
  const { leaveId } = req.params;
  const { message, subject } = req.body;

  try {
    const leave = await Leave.findById(leaveId).populate('studentId', 'studentName studentId email');
    
    if (!leave) {
      return res.status(404).json({ message: "Leave request not found." });
    }

    const student = leave.studentId;
    const emailSubject = subject || `Regarding Your Leave Request - ${leave.leaveType}`;
    
    const emailBody = `Hello ${student.studentName},

${message}

Leave Request Details:
• Type: ${leave.leaveType}
• From: ${new Date(leave.startDate).toLocaleDateString("en-IN")}
• To: ${new Date(leave.endDate).toLocaleDateString("en-IN")}
• Status: ${leave.status.toUpperCase()}

Applied on: ${new Date(leave.appliedAt).toLocaleDateString("en-IN")}

If you have any questions, please contact the hostel administration.

– Hostel Admin`;

    // Send email
    await transporter.sendMail({
      from: `"Hostel Admin" <${process.env.MAIL_USER}>`,
      to: student.email,
      subject: emailSubject,
      text: emailBody
    });

    return res.json({ 
      message: "Message sent successfully to student",
      sentTo: student.email
    });

  } catch (err) {
    console.error("Send leave message error:", err);
    return res.status(500).json({ message: "Server error while sending message." });
  }
};

// Bulk approve/reject leaves
const bulkUpdateLeaveStatus = async (req, res) => {
  const { leaveIds, status, adminComments } = req.body;

  try {
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: "Invalid status. Must be 'approved' or 'rejected'." });
    }

    if (!Array.isArray(leaveIds) || leaveIds.length === 0) {
      return res.status(400).json({ message: "Please provide an array of leave IDs." });
    }

    // Find all pending leaves from the provided IDs
    const leaves = await Leave.find({
      _id: { $in: leaveIds },
      status: 'pending'
    }).populate('studentId', 'studentName studentId email');

    if (leaves.length === 0) {
      return res.status(400).json({ message: "No pending leave requests found to update." });
    }

    // Update all leaves
    const updateResult = await Leave.updateMany(
      {
        _id: { $in: leaves.map(l => l._id) },
        status: 'pending'
      },
      {
        status,
        adminComments,
        processedAt: new Date()
      }
    );

    // Send emails to all affected students
    const emailPromises = leaves.map(async (leave) => {
      const student = leave.studentId;
      const statusText = status === 'approved' ? 'APPROVED' : 'REJECTED';
      const statusEmoji = status === 'approved' ? '✅' : '❌';

      const emailSubject = `Leave Request ${statusText} - ${leave.leaveType}`;
      const emailBody = `Hello ${student.studentName},

${statusEmoji} Your leave request has been ${statusText.toLowerCase()}.

Leave Details:
• Type: ${leave.leaveType}
• From: ${new Date(leave.startDate).toLocaleDateString("en-IN")}
• To: ${new Date(leave.endDate).toLocaleDateString("en-IN")}
• Reason: ${leave.reason}
• Status: ${statusText}
${adminComments ? `• Admin Comments: ${adminComments}` : ''}

Applied on: ${new Date(leave.appliedAt).toLocaleDateString("en-IN")}
Processed on: ${new Date().toLocaleDateString("en-IN")}

${status === 'approved' ? 
  'Please ensure you follow all hostel guidelines during your leave period.' : 
  'If you have any questions regarding this decision, please contact the hostel administration.'}

– Hostel Admin`;

      try {
        await transporter.sendMail({
          from: `"Hostel Admin" <${process.env.MAIL_USER}>`,
          to: student.email,
          subject: emailSubject,
          text: emailBody
        });
      } catch (emailErr) {
        console.error(`Email sending error for ${student.email}:`, emailErr);
      }
    });

    await Promise.all(emailPromises);

    return res.json({ 
      message: `${updateResult.modifiedCount} leave requests ${status} successfully`,
      updatedCount: updateResult.modifiedCount,
      emailsSent: leaves.length
    });

  } catch (err) {
    console.error("Bulk update leave status error:", err);
    return res.status(500).json({ message: "Server error while bulk updating leave status." });
  }
};


// Get all complaints/tickets with filtering and pagination
const getAllComplaints = async (req, res) => {
  try {
    const { status, type, page = 1, limit = 10, search } = req.query;
    
    // Build query object
    let query = {};
    if (status && status !== 'all') {
      query.status = status;
    }
    if (type && type !== 'all') {
      query.complaintType = type;
    }
    if (search) {
      query.$or = [
        { subject: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    const skip = (page - 1) * limit;

    // Get complaints with student details
    const complaints = await Complaint.find(query)
      .populate('studentId', 'studentName studentId email contactNumber roomBedNumber')
      .select('complaintType subject description status filedDate createdAt updatedAt')
      .sort({ filedDate: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalComplaints = await Complaint.countDocuments(query);

    // Get status counts for the interface
    const statusCounts = await Complaint.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const counts = {
      all: await Complaint.countDocuments(),
      'in progress': 0,
      'resolved': 0
    };

    statusCounts.forEach(item => {
      counts[item._id] = item.count;
    });

    return res.json({ 
      message: "Complaints fetched successfully",
      complaints: complaints.map(complaint => ({
        _id: complaint._id,
        ticketId: `#${String(complaint._id).slice(-4).toUpperCase()}`, // Generate ticket ID from MongoDB _id
        subject: complaint.subject,
        description: complaint.description,
        complaintType: complaint.complaintType,
        status: complaint.status,
        filedDate: complaint.filedDate,
        raisedBy: complaint.studentId ? {
          name: complaint.studentId.studentName,
          studentId: complaint.studentId.studentId,
          email: complaint.studentId.email
        } : null
      })),
      counts,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalComplaints / limit),
        totalComplaints,
        hasNextPage: page * limit < totalComplaints,
        hasPreviousPage: page > 1
      }
    });
  } catch (err) {
    console.error("Fetch complaints error:", err);
    return res.status(500).json({ message: "Server error while fetching complaints." });
  }
};

// Get open/pending complaints
const getOpenComplaints = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const openComplaints = await Complaint.find({ status: 'in progress' })
      .populate('studentId', 'studentName studentId email contactNumber')
      .select('complaintType subject description status filedDate')
      .sort({ filedDate: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalOpen = await Complaint.countDocuments({ status: 'in progress' });

    return res.json({ 
      message: "Open complaints fetched successfully",
      complaints: openComplaints.map(complaint => ({
        _id: complaint._id,
        ticketId: `#${String(complaint._id).slice(-4).toUpperCase()}`,
        subject: complaint.subject,
        description: complaint.description,
        complaintType: complaint.complaintType,
        status: complaint.status,
        filedDate: complaint.filedDate,
        raisedBy: complaint.studentId ? {
          name: complaint.studentId.studentName,
          studentId: complaint.studentId.studentId,
          email: complaint.studentId.email
        } : null
      })),
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalOpen / limit),
        totalComplaints: totalOpen,
        hasNextPage: page * limit < totalOpen,
        hasPreviousPage: page > 1
      }
    });
  } catch (err) {
    console.error("Fetch open complaints error:", err);
    return res.status(500).json({ message: "Server error while fetching open complaints." });
  }
};

// Get resolved complaints
const getResolvedComplaints = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const resolvedComplaints = await Complaint.find({ status: 'resolved' })
      .populate('studentId', 'studentName studentId email contactNumber')
      .select('complaintType subject description status filedDate updatedAt')
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalResolved = await Complaint.countDocuments({ status: 'resolved' });

    return res.json({ 
      message: "Resolved complaints fetched successfully",
      complaints: resolvedComplaints.map(complaint => ({
        _id: complaint._id,
        ticketId: `#${String(complaint._id).slice(-4).toUpperCase()}`,
        subject: complaint.subject,
        description: complaint.description,
        complaintType: complaint.complaintType,
        status: complaint.status,
        filedDate: complaint.filedDate,
        resolvedDate: complaint.updatedAt,
        raisedBy: complaint.studentId ? {
          name: complaint.studentId.studentName,
          studentId: complaint.studentId.studentId,
          email: complaint.studentId.email
        } : null
      })),
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalResolved / limit),
        totalComplaints: totalResolved,
        hasNextPage: page * limit < totalResolved,
        hasPreviousPage: page > 1
      }
    });
  } catch (err) {
    console.error("Fetch resolved complaints error:", err);
    return res.status(500).json({ message: "Server error while fetching resolved complaints." });
  }
};

// Update complaint status (Approve/Resolve or Reject)
const updateComplaintStatus = async (req, res) => {
  const { complaintId } = req.params;
  const { status, adminNotes } = req.body; // status should be 'resolved' or 'in progress'

  try {
    // Validate status
    if (!['resolved', 'in progress'].includes(status)) {
      return res.status(400).json({ message: "Invalid status. Must be 'resolved' or 'in progress'." });
    }

    // Find the complaint
    const complaint = await Complaint.findById(complaintId).populate('studentId', 'studentName studentId email');
    
    if (!complaint) {
      return res.status(404).json({ message: "Complaint not found." });
    }

    // Update complaint status
    complaint.status = status;
    if (adminNotes) {
      complaint.adminNotes = adminNotes; // You might want to add this field to your schema
    }
    
    await complaint.save();

    // Send email notification to student
    const student = complaint.studentId;
    const statusText = status === 'resolved' ? 'RESOLVED' : 'IN PROGRESS';
    const statusEmoji = status === 'resolved' ? '✅' : '🔄';

    const emailSubject = `Complaint ${statusText} - ${complaint.subject}`;
    const emailBody = `Hello ${student.studentName},

${statusEmoji} Your complaint has been marked as ${statusText.toLowerCase()}.

Complaint Details:
• Ticket ID: #${String(complaint._id).slice(-4).toUpperCase()}
• Subject: ${complaint.subject}
• Type: ${complaint.complaintType}
• Status: ${statusText}
• Filed Date: ${new Date(complaint.filedDate).toLocaleDateString("en-IN")}
${adminNotes ? `• Admin Notes: ${adminNotes}` : ''}

${status === 'resolved' ? 
  'Thank you for reporting this issue. We appreciate your feedback.' : 
  'We are working on resolving your complaint. You will be notified once it is resolved.'}

If you have any questions, please contact the hostel administration.

– Hostel Admin`;

    // Send email notification
    try {
      await transporter.sendMail({
        from: `"Hostel Admin" <${process.env.MAIL_USER}>`,
        to: student.email,
        subject: emailSubject,
        text: emailBody
      });
      console.log(`📤 Complaint ${status} notification sent to ${student.email}`);
    } catch (emailErr) {
      console.error("Email sending error:", emailErr);
      // Don't fail the entire operation if email fails
    }

        await createAuditLog({
      adminId: req.admin?._id,
      adminName: req.admin?.adminId || 'System',
      actionType: status === 'resolved' ? AuditActionTypes.COMPLAINT_RESOLVED : AuditActionTypes.COMPLAINT_UPDATED,
      description: `${status === 'resolved' ? 'Resolved' : 'Updated'} complaint: ${complaint.subject} (Student: ${complaint.studentId.studentName})`,
      targetType: 'Complaint',
      targetId: complaintId,
      targetName: `${complaint.subject} - ${complaint.studentId.studentName}`,
      additionalData: {
        complaintType: complaint.complaintType,
        subject: complaint.subject,
        adminNotes
      }
    });

    return res.json({ 
      message: `Complaint marked as ${status} successfully`,
      complaint: {
        _id: complaint._id,
        ticketId: `#${String(complaint._id).slice(-4).toUpperCase()}`,
        subject: complaint.subject,
        description: complaint.description,
        complaintType: complaint.complaintType,
        status: complaint.status,
        filedDate: complaint.filedDate,
        updatedAt: new Date(),
        student: {
          studentName: student.studentName,
          studentId: student.studentId
        }
      }
    });

  } catch (err) {
    console.error("Update complaint status error:", err);
    return res.status(500).json({ message: "Server error while updating complaint status." });
  }
};

// Get complaint statistics for dashboard
const getComplaintStatistics = async (req, res) => {
  try {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    // Get counts
    const totalOpen = await Complaint.countDocuments({ status: 'in progress' });
    const totalResolved = await Complaint.countDocuments({ status: 'resolved' });
    const thisMonthComplaints = await Complaint.countDocuments({
      filedDate: { $gte: startOfMonth, $lte: endOfMonth }
    });

    // Get complaint type breakdown
    const complaintTypeStats = await Complaint.aggregate([
      {
        $group: {
          _id: '$complaintType',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get recent complaints (last 5)
    const recentComplaints = await Complaint.find()
      .populate('studentId', 'studentName studentId')
      .select('complaintType subject status filedDate')
      .sort({ filedDate: -1 })
      .limit(5);

    return res.json({
      message: "Complaint statistics fetched successfully",
      statistics: {
        open: totalOpen,
        resolved: totalResolved,
        thisMonth: thisMonthComplaints,
        total: totalOpen + totalResolved
      },
      complaintTypeBreakdown: complaintTypeStats,
      recentComplaints: recentComplaints.map(complaint => ({
        _id: complaint._id,
        ticketId: `#${String(complaint._id).slice(-4).toUpperCase()}`,
        subject: complaint.subject,
        complaintType: complaint.complaintType,
        status: complaint.status,
        filedDate: complaint.filedDate,
        raisedBy: complaint.studentId ? complaint.studentId.studentName : 'Unknown'
      }))
    });

  } catch (err) {
    console.error("Fetch complaint statistics error:", err);
    return res.status(500).json({ message: "Server error while fetching complaint statistics." });
  }
};

// Get specific complaint details
const getComplaintDetails = async (req, res) => {
  const { complaintId } = req.params;

  try {
    const complaint = await Complaint.findById(complaintId)
      .populate('studentId', 'studentName studentId email contactNumber roomBedNumber');

    if (!complaint) {
      return res.status(404).json({ message: "Complaint not found." });
    }

    return res.json({
      message: "Complaint details fetched successfully",
      complaint: {
        _id: complaint._id,
        ticketId: `#${String(complaint._id).slice(-4).toUpperCase()}`,
        subject: complaint.subject,
        description: complaint.description,
        complaintType: complaint.complaintType,
        status: complaint.status,
        filedDate: complaint.filedDate,
        updatedAt: complaint.updatedAt,
        student: complaint.studentId ? {
          name: complaint.studentId.studentName,
          studentId: complaint.studentId.studentId,
          email: complaint.studentId.email,
          contactNumber: complaint.studentId.contactNumber,
          roomBedNumber: complaint.studentId.roomBedNumber
        } : null
      }
    });

  } catch (err) {
    console.error("Fetch complaint details error:", err);
    return res.status(500).json({ message: "Server error while fetching complaint details." });
  }
};

// Bulk update complaint status
const bulkUpdateComplaintStatus = async (req, res) => {
  const { complaintIds, status, adminNotes } = req.body;

  try {
    if (!['resolved', 'in progress'].includes(status)) {
      return res.status(400).json({ message: "Invalid status. Must be 'resolved' or 'in progress'." });
    }

    if (!Array.isArray(complaintIds) || complaintIds.length === 0) {
      return res.status(400).json({ message: "Please provide an array of complaint IDs." });
    }

    // Find all complaints from the provided IDs
    const complaints = await Complaint.find({
      _id: { $in: complaintIds }
    }).populate('studentId', 'studentName studentId email');

    if (complaints.length === 0) {
      return res.status(400).json({ message: "No complaints found to update." });
    }

    // Update all complaints
    const updateResult = await Complaint.updateMany(
      {
        _id: { $in: complaintIds }
      },
      {
        status,
        adminNotes
      }
    );

    // Send emails to all affected students
    const emailPromises = complaints.map(async (complaint) => {
      const student = complaint.studentId;
      const statusText = status === 'resolved' ? 'RESOLVED' : 'IN PROGRESS';
      const statusEmoji = status === 'resolved' ? '✅' : '🔄';

      const emailSubject = `Complaint ${statusText} - ${complaint.subject}`;
      const emailBody = `Hello ${student.studentName},

${statusEmoji} Your complaint has been marked as ${statusText.toLowerCase()}.

Complaint Details:
• Ticket ID: #${String(complaint._id).slice(-4).toUpperCase()}
• Subject: ${complaint.subject}
• Type: ${complaint.complaintType}
• Status: ${statusText}
${adminNotes ? `• Admin Notes: ${adminNotes}` : ''}

Filed Date: ${new Date(complaint.filedDate).toLocaleDateString("en-IN")}

${status === 'resolved' ? 
  'Thank you for reporting this issue. We appreciate your feedback.' : 
  'We are working on resolving your complaint. You will be notified once it is resolved.'}

– Hostel Admin`;

      try {
        await transporter.sendMail({
          from: `"Hostel Admin" <${process.env.MAIL_USER}>`,
          to: student.email,
          subject: emailSubject,
          text: emailBody
        });
      } catch (emailErr) {
        console.error(`Email sending error for ${student.email}:`, emailErr);
      }
    });

    await Promise.all(emailPromises);

    return res.json({ 
      message: `${updateResult.modifiedCount} complaints marked as ${status} successfully`,
      updatedCount: updateResult.modifiedCount,
      emailsSent: complaints.length
    });

  } catch (err) {
    console.error("Bulk update complaint status error:", err);
    return res.status(500).json({ message: "Server error while bulk updating complaint status." });
  }
};

const getAuditLogs = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      search, 
      actionType, 
      adminId, 
      targetType,
      startDate,
      endDate
    } = req.query;

    // Build query
    let query = {};
    
    // Search in description, adminName, or targetName
    if (search) {
      query.$or = [
        { description: { $regex: search, $options: 'i' } },
        { adminName: { $regex: search, $options: 'i' } },
        { targetName: { $regex: search, $options: 'i' } }
      ];
    }

    // Filter by action type
    if (actionType && actionType !== 'all') {
      query.actionType = actionType;
    }

    // Filter by admin
    if (adminId && adminId !== 'all') {
      query.adminId = adminId;
    }

    // Filter by target type
    if (targetType && targetType !== 'all') {
      query.targetType = targetType;
    }

    // Date range filter
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) {
        query.timestamp.$gte = new Date(startDate);
      }
      if (endDate) {
        query.timestamp.$lte = new Date(endDate + 'T23:59:59.999Z');
      }
    }

    const skip = (page - 1) * limit;

    // Get audit logs
    const auditLogs = await AuditLog.find(query)
      .populate('adminId', 'adminId email')
      .select('adminName actionType description targetType targetId targetName timestamp')
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalLogs = await AuditLog.countDocuments(query);

    // Get filter options for frontend
    const actionTypes = await AuditLog.distinct('actionType');
    const admins = await AuditLog.aggregate([
      {
        $group: {
          _id: '$adminId',
          adminName: { $first: '$adminName' },
          count: { $sum: 1 }
        }
      }
    ]);
    const targetTypes = await AuditLog.distinct('targetType');

    return res.json({
      message: "Audit logs fetched successfully",
      logs: auditLogs.map(log => ({
        _id: log._id,
        timestamp: log.timestamp,
        user: log.adminName,
        actionType: log.actionType,
        description: log.description,
        targetType: log.targetType,
        targetId: log.targetId,
        targetName: log.targetName
      })),
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalLogs / limit),
        totalLogs,
        hasNextPage: page * limit < totalLogs,
        hasPreviousPage: page > 1
      },
      filters: {
        actionTypes,
        admins: admins.map(a => ({ _id: a._id, name: a.adminName, count: a.count })),
        targetTypes
      }
    });

  } catch (err) {
    console.error("Fetch audit logs error:", err);
    return res.status(500).json({ message: "Server error while fetching audit logs." });
  }
};

// Get audit log statistics
const getAuditLogStatistics = async (req, res) => {
  try {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));
    const startOfWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    // Get counts
    const totalLogs = await AuditLog.countDocuments();
    const todayLogs = await AuditLog.countDocuments({
      timestamp: { $gte: startOfDay, $lte: endOfDay }
    });
    const weekLogs = await AuditLog.countDocuments({
      timestamp: { $gte: startOfWeek }
    });
    const monthLogs = await AuditLog.countDocuments({
      timestamp: { $gte: startOfMonth }
    });

    // Get action type breakdown
    const actionTypeStats = await AuditLog.aggregate([
      {
        $group: {
          _id: '$actionType',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // Get most active admins
    const activeAdmins = await AuditLog.aggregate([
      {
        $group: {
          _id: '$adminId',
          adminName: { $first: '$adminName' },
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    // Get recent activities (last 10)
    const recentActivities = await AuditLog.find()
      .select('adminName actionType description timestamp targetName')
      .sort({ timestamp: -1 })
      .limit(10);

    return res.json({
      message: "Audit log statistics fetched successfully",
      statistics: {
        total: totalLogs,
        today: todayLogs,
        thisWeek: weekLogs,
        thisMonth: monthLogs
      },
      actionTypeBreakdown: actionTypeStats,
      activeAdmins: activeAdmins.map(admin => ({
        adminName: admin.adminName,
        count: admin.count
      })),
      recentActivities: recentActivities.map(activity => ({
        _id: activity._id,
        user: activity.adminName,
        action: activity.actionType,
        description: activity.description,
        timestamp: activity.timestamp,
        target: activity.targetName
      }))
    });

  } catch (err) {
    console.error("Fetch audit log statistics error:", err);
    return res.status(500).json({ message: "Server error while fetching audit log statistics." });
  }
};

// Get specific audit log details
const getAuditLogDetails = async (req, res) => {
  const { logId } = req.params;

  try {
    const auditLog = await AuditLog.findById(logId)
      .populate('adminId', 'adminId email');

    if (!auditLog) {
      return res.status(404).json({ message: "Audit log not found." });
    }

    return res.json({
      message: "Audit log details fetched successfully",
      log: {
        _id: auditLog._id,
        timestamp: auditLog.timestamp,
        adminName: auditLog.adminName,
        adminEmail: auditLog.adminId ? auditLog.adminId.email : 'Unknown',
        actionType: auditLog.actionType,
        description: auditLog.description,
        targetType: auditLog.targetType,
        targetId: auditLog.targetId,
        targetName: auditLog.targetName,
        sessionInfo: auditLog.sessionInfo,
        additionalData: auditLog.additionalData,
        createdAt: auditLog.createdAt,
        updatedAt: auditLog.updatedAt
      }
    });

  } catch (err) {
    console.error("Fetch audit log details error:", err);
    return res.status(500).json({ message: "Server error while fetching audit log details." });
  }
};

// Export audit logs to CSV (optional feature)
const exportAuditLogs = async (req, res) => {
  try {
    const { startDate, endDate, actionType } = req.query;
    
    let query = {};
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate + 'T23:59:59.999Z');
    }
    if (actionType && actionType !== 'all') {
      query.actionType = actionType;
    }

    const logs = await AuditLog.find(query)
      .select('timestamp adminName actionType description targetType targetName')
      .sort({ timestamp: -1 })
      .limit(10000); // Limit for performance

    // Convert to CSV format
    const csvHeaders = 'Timestamp,User,Action Type,Description,Target Type,Target Name\n';
    const csvData = logs.map(log => 
      `"${log.timestamp}","${log.adminName}","${log.actionType}","${log.description}","${log.targetType || ''}","${log.targetName || ''}"`
    ).join('\n');

    const csv = csvHeaders + csvData;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${new Date().toISOString().split('T')[0]}.csv"`);
    return res.send(csv);

  } catch (err) {
    console.error("Export audit logs error:", err);
    return res.status(500).json({ message: "Server error while exporting audit logs." });
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
    getPendingLeaveRequests,
    getAllLeaveRequests,
    updateLeaveStatus,
    getLeaveStatistics,
    getStudentLeaveHistory,
    sendLeaveMessage,
    bulkUpdateLeaveStatus,
    getAllComplaints,
    getOpenComplaints,
    getResolvedComplaints,
    updateComplaintStatus,
    getComplaintStatistics,
    getComplaintDetails,
    bulkUpdateComplaintStatus,
    getAuditLogs,
    getAuditLogStatistics,
    getAuditLogDetails,
    exportAuditLogs,
    getTotalRevenue,
    getPendingPayments,
    getFinancialSummary,
     generateStudentInvoice,
    getStudentInvoices,
    updateStudentInvoiceStatus,
    createManagementInvoice,
    getManagementInvoices,
    updateManagementInvoiceStatus,
    generateStaffSalary,
    getStaffSalaries,
    updateSalaryStatus,
    generateSalarySlip,
    initiateRefund,
    getRefunds,
    updateRefundStatus
};