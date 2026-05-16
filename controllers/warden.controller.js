import "dotenv/config";
import nodemailer from "nodemailer";
import bcrypt from "bcrypt";
import { Warden } from "../models/warden.model.js";
import { Otp } from "../models/otp.model.js";
import fs from "fs";
import path from "path";
import { Student } from "../models/student.model.js";
import { Leave } from "../models/leave.model.js";
import jwt from "jsonwebtoken";
import { Inventory } from '../models/inventory.model.js';
import { Inspection } from '../models/inspection.model.js';
import sendEmail from '../utils/sendEmail.js';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import mongoose from "mongoose";
import { sendWhatsAppMessage } from "../utils/sendWhatsApp.js";
import { sendBulkNotifications, sendNotification } from '../utils/sendNotification.js';
import { Fee } from '../models/fee.model.js';
import { Parent } from '../models/parent.model.js';
import { Staff } from '../models/staff.model.js';
import { Requisition } from '../models/requisition.model.js';
import { Complaint } from '../models/complaint.model.js';
import { StudentInvoice } from '../models/studentInvoice.model.js';
import { AuditLog } from '../models/auditLog.model.js';

// Nodemailer transporter
const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: +process.env.MAIL_PORT,
  secure: process.env.MAIL_SECURE === "true",
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS?.trim().replace(/\s+/g, ""),
  },
});

// <------------    Login Page For Warden  -------------->
const sendLoginOTP = async (req, res) => {
  const { wardenId } = req.body;
  if (!wardenId) return res.status(400).json({ message: "Warden ID is required" });
  try {
    const warden = await Warden.findOne({ wardenId });
    if (!warden) return res.status(404).json({ message: "Warden account not found" });
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 5 * 60 * 1000);
    await Otp.findOneAndUpdate(
      { email: warden.email },
      { code: otp, expires: otpExpiry, verified: false, purpose: 'warden_login' },
      { upsert: true }
    );
    if (warden.contactNumber) {
      await sendWhatsAppMessage(warden.contactNumber, `Hello ${warden.firstName},\n\nYour OTP for warden panel login is: *${otp}*\n\nValid for 5 minutes.\n\n– Hostel Management System`);
    }
    await transporter.sendMail({
      from: `"Hostel Admin" <${process.env.MAIL_USER}>`,
      to: warden.email,
      subject: 'Warden Login OTP',
      text: `Hello ${warden.firstName} ${warden.lastName},\n\nYour OTP for warden panel login is: ${otp}\n\nThis OTP is valid for 5 minutes only.\n\n– Hostel Admin`
    });
    return res.json({ message: 'OTP sent successfully', contactNumber: warden.contactNumber.replace(/(\d{2})(\d+)(\d{4})/, '$1****$3') });
  } catch (err) {
    console.error("Error sending OTP:", err);
    return res.status(500).json({ message: "Error sending OTP" });
  }
};

const login = async (req, res) => {
  const { wardenId } = req.body;
  if (!wardenId) return res.status(400).json({ message: "Warden ID is required" });
  try {
    const warden = await Warden.findOne({ wardenId });
    if (!warden) return res.status(401).json({ message: "Invalid Warden ID" });
    const token = jwt.sign({ id: warden._id, wardenId: warden.wardenId, role: "warden" }, process.env.JWT_SECRET, { expiresIn: "1d" });
    return res.status(200).json({
      message: "Login successful",
      token,
      warden: { id: warden._id, wardenId: warden.wardenId, name: `${warden.firstName} ${warden.lastName}`, email: warden.email, phone: warden.contactNumber, profilePhoto: warden.profilePhoto || null }
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ message: "Server error during login" });
  }
};

const forgotPassword = async (req, res) => {
  const { email } = req.body;
  try {
    const warden = await Warden.findOne({ email });
    if (!warden) return res.status(400).json({ message: "Email not found" });
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const expires = new Date(Date.now() + 10 * 60 * 1000);
    await Otp.findOneAndUpdate({ email }, { code: otp, expires, verified: false }, { upsert: true });
    await transporter.sendMail({
      from: `"Hostel Admin" <${process.env.MAIL_USER}>`,
      to: email,
      subject: "Warden Password Reset OTP",
      text: `Dear ${warden.firstName} ${warden.lastName},\n\nYour OTP for password reset is ${otp}.\n\n– Hostel Admin`,
    });
    return res.json({ message: "OTP sent" });
  } catch (err) {
    return res.status(500).json({ message: "Error sending OTP." });
  }
};

const verifyOtp = async (req, res) => {
  const { email, otp } = req.body;
  const record = await Otp.findOne({ email, code: otp });
  if (!record || record.expires < Date.now()) return res.status(400).json({ message: "Invalid or expired OTP" });
  record.verified = true;
  await record.save();
  return res.json({ message: "OTP verified" });
};

const resetPassword = async (req, res) => {
  const { email, otp, newPassword } = req.body;
  const record = await Otp.findOne({ email, code: otp, verified: true });
  if (!record) return res.status(400).json({ message: "OTP not verified" });
  try {
    const warden = await Warden.findOne({ email });
    if (!warden) return res.status(404).json({ message: "Warden not found" });
    warden.password = newPassword;
    await warden.save();
    await Otp.deleteOne({ email });
    return res.json({ message: "Password reset successful" });
  } catch (err) {
    return res.status(500).json({ message: "Error resetting password." });
  }
};

//  <--------  Attendance Page ----------->
const punchIn = async (req, res) => {
  try {
    const warden = await Warden.findById(req.user.id);
    if (!warden) return res.status(404).json({ message: 'Warden not found' });
    const today = new Date().toDateString();
    if (warden.attendanceLog.find(e => new Date(e.date).toDateString() === today)) {
      return res.status(400).json({ message: 'Already punched in today' });
    }
    warden.attendanceLog.push({ date: new Date(), punchIn: new Date(), punchOut: null, totalHours: null });
    await warden.save();
    res.status(200).json({ message: 'Punch in recorded' });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

const punchOut = async (req, res) => {
  try {
    const warden = await Warden.findById(req.user.id);
    if (!warden) return res.status(404).json({ message: 'Warden not found' });
    const today = new Date().toDateString();
    const log = warden.attendanceLog.find(e => new Date(e.date).toDateString() === today);
    if (!log) return res.status(400).json({ message: 'Punch in not found' });
    if (log.punchOut) return res.status(400).json({ message: 'Already punched out' });
    log.punchOut = new Date();
    log.totalHours = Math.round(((log.punchOut - log.punchIn) / (1000 * 60 * 60)) * 100) / 100;
    await warden.save();
    res.status(200).json({ message: 'Punch out recorded', totalHours: log.totalHours });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

const checkPunchStatus = async (req, res) => {
  try {
    const warden = await Warden.findById(req.user.id);
    const today = new Date().toDateString();
    const log = warden?.attendanceLog.find(e => new Date(e.date).toDateString() === today);
    return res.status(200).json({ punchedIn: !!log, punchedOut: !!log?.punchOut, log: log ? { punchIn: log.punchIn, punchOut: log.punchOut, totalHours: log.totalHours } : null });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

const getAttendanceLog = async (req, res) => {
  try {
    const warden = await Warden.findById(req.user.id);
    res.status(200).json({ attendanceLog: warden.attendanceLog.sort((a, b) => new Date(b.date) - new Date(a.date)) });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// <---------- Dashboard Stats ---------->
const getWardenDashboardStats = async (req, res) => {
  try {
    const totalStudents = await Student.countDocuments();
    const bedFilter = { $or: [{ category: { $in: ['Furniture', 'BEDS'] } }, { itemName: { $regex: /Bed|B\d+/i } }] };
    const [totalBeds, inUseBeds, availableBeds, damagedBeds] = await Promise.all([
      Inventory.countDocuments(bedFilter),
      Inventory.countDocuments({ ...bedFilter, status: 'In Use' }),
      Inventory.countDocuments({ ...bedFilter, status: 'Available' }),
      Inventory.countDocuments({ ...bedFilter, status: 'Damaged' })
    ]);
    
    const now = new Date();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const [upcomingInspections, pendingLeavesCount, inProgressComplaintsCount, pendingRequisitionsCount] = await Promise.all([
      Inspection.find({ datetime: { $gte: now }, status: "pending" }).sort({ datetime: 1 }),
      Leave.countDocuments({ status: "pending" }),
      Complaint.countDocuments({ status: "in progress" }),
      Requisition.countDocuments({ requestedBy: req.user?.id, status: "pending" })
    ]);

    // Fetch Today's Check-ins and Check-outs
    const studentsWithTodayAttendance = await Student.find({
      "attendanceLog.checkInDate": { $gte: todayStart, $lte: todayEnd }
    });

    let checkIns = 0;
    let checkOuts = 0;

    studentsWithTodayAttendance.forEach(student => {
      student.attendanceLog.forEach(log => {
        if (log.checkInDate >= todayStart && log.checkInDate <= todayEnd) {
          checkIns++;
          if (log.checkOutDate && log.checkOutDate >= todayStart && log.checkOutDate <= todayEnd) {
            checkOuts++;
          }
        }
      });
    });

    // Fetch Recent Activities (last 10)
    const recentActivities = await AuditLog.find()
      .sort({ timestamp: -1 })
      .limit(10)
      .lean();

    // Map AuditLog to expected format for frontend if needed
    const mappedActivities = recentActivities.map(log => ({
      description: log.description,
      user: log.adminName || "System",
      target: log.targetName || log.targetType,
      timestamp: log.timestamp,
      action: log.actionType
    }));

    res.status(200).json({
      totalStudents, totalBeds, inUseBeds, availableBeds, damagedBeds,
      upcomingInspectionCount: upcomingInspections.length, 
      upcomingInspections,
      pendingLeavesCount, 
      inProgressComplaintsCount, 
      pendingRequisitionsCount,
      checkInOutData: {
        checkIns,
        checkOuts
      },
      recentActivities: mappedActivities
    });
  } catch (error) {
    console.error("Dashboard Stats Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// <---------- Inventory & Beds ---------->
const getBedStats = async (req, res) => {
  try {
    const stats = await Inventory.aggregate([
      { $match: { $or: [{ category: { $in: ['Furniture', 'BEDS'] } }, { itemName: { $regex: /Bed|B\d+/i } }] } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    const result = { totalBeds: 0, available: 0, inUse: 0, inMaintenance: 0, damaged: 0 };
    stats.forEach(s => {
      result.totalBeds += s.count;
      if (s._id === 'Available') result.available = s.count;
      else if (s._id === 'In Use') result.inUse = s.count;
      else if (s._id === 'Damaged') result.damaged = s.count;
    });
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

const getBedStatusOverview = async (req, res) => {
  try {
    const { floor, roomNo, status } = req.query;
    const filters = { $or: [{ category: { $in: ['Furniture', 'BEDS'] } }, { itemName: { $regex: /Bed|B\d+/i } }] };
    if (floor) filters.floor = floor;
    if (roomNo) filters.roomNo = roomNo;
    if (status) filters.status = status;
    const beds = await Inventory.find(filters, 'barcodeId floor roomNo status');
    res.status(200).json(beds);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// <----------- Student Management ----------->
const getStudentListForWarden = async (req, res) => {
  try {
    const students = await Student.find().populate('roomBedNumber', 'itemName barcodeId floor roomNo');
    
    // Fetch all beds to calculate room capacities (room types)
    const allBedItems = await Inventory.find({
      $or: [
        { category: { $in: ['Furniture', 'BEDS'] } },
        { itemName: { $regex: /Bed|B\d+/i } }
      ]
    });
    const capacityMap = {};
    allBedItems.forEach(bed => {
      if (bed.roomNo) {
        capacityMap[bed.roomNo] = (capacityMap[bed.roomNo] || 0) + 1;
      }
    });

    // Fetch all pending invoices to calculate dues
    const pendingInvoices = await StudentInvoice.find({ status: 'pending' });
    const duesMap = {};
    pendingInvoices.forEach(inv => {
      const sId = inv.studentId.toString();
      duesMap[sId] = (duesMap[sId] || 0) + inv.amount;
    });

    const transformedStudents = students.map((student) => {
      // Infer roomType if not explicitly set but a room is assigned
      const inferredRoomType = student.roomType || (student.roomBedNumber?.roomNo ? String(capacityMap[student.roomBedNumber.roomNo]) : "");

      return {
        ...student.toObject(),
        id: student.studentId, // Ensure frontend compatibility
        dues: duesMap[student._id.toString()] || 0,
        roomType: inferredRoomType,
      };
    });

    res.status(200).json({ success: true, students: transformedStudents });
  } catch (error) {
    console.error("Error fetching students for warden:", error);
    res.status(500).json({ success: false, message: "Error fetching students." });
  }
};

const updateStudentRoom = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { barcodeId } = req.body;
    const student = await Student.findOne({ studentId });
    const newBed = await Inventory.findOne({ barcodeId });
    if (!student || !newBed || newBed.status === 'In Use') return res.status(400).json({ success: false, message: 'Invalid assignment' });
    if (student.roomBedNumber) await Inventory.findByIdAndUpdate(student.roomBedNumber, { status: 'Available' });
    student.roomBedNumber = newBed._id;
    await student.save();
    newBed.status = 'In Use';
    await newBed.save();
    res.status(200).json({ success: true, message: 'Updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error' });
  }
};

const getAllAvailableBed = async (req, res) => {
  try {
    const beds = await Inventory.find({ status: 'Available', $or: [{ category: { $in: ['Furniture', 'BEDS'] } }, { itemName: { $regex: /Bed|B\d+/i } }] }).select('barcodeId roomNo');
    res.status(200).json({ success: true, beds });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error' });
  }
};

const getTotalStudents = async (req, res) => {
  try {
    const total = await Student.countDocuments();
    res.status(200).json({ success: true, totalStudents: total });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error' });
  }
};

// <---------- Inspection Management ---------->
const getRecentInspections = async (req, res) => {
  try {
    const inspections = await Inspection.find().sort({ datetime: -1 }).limit(10);
    res.status(200).json({ success: true, inspections });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error' });
  }
};

const getFilteredInspections = async (req, res) => {
  try {
    const { status, target } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (target) filter.target = target;
    const inspections = await Inspection.find(filter).sort({ datetime: -1 });
    res.status(200).json({ success: true, inspections });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error' });
  }
};

const getInspectionById = async (req, res) => {
  try {
    const inspection = await Inspection.findById(req.params.id);
    res.status(200).json({ success: true, inspection });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error' });
  }
};

const completeInspection = async (req, res) => {
  try {
    await Inspection.findByIdAndUpdate(req.params.id, { status: 'completed' });
    res.status(200).json({ success: true, message: 'Completed' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error' });
  }
};

const getInspectionStats = async (req, res) => {
  try {
    const stats = await Inspection.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
    res.status(200).json({ success: true, stats });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error' });
  }
};

const deleteInspection = async (req, res) => {
  try {
    await Inspection.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: 'Deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error' });
  }
};

// <--------- Leave Request Management ----------->
const getAllLeaveRequests = async (req, res) => {
  try {
    const leaves = await Leave.find().populate('studentId', 'firstName lastName studentId').sort({ appliedAt: -1 });
    res.json(leaves);
  } catch (err) {
    res.status(500).json({ message: 'Error' });
  }
};

const updateLeaveStatus = async (req, res) => {
  try {
    const { leaveId } = req.params;
    const { status } = req.body;
    const leave = await Leave.findByIdAndUpdate(leaveId, { status }, { new: true }).populate('studentId');
    if (leave) {
      await sendEmail({ to: leave.studentId.email, subject: 'Leave Status', text: `Your leave is ${status}` });
    }
    res.json({ message: `Leave ${status}`, leave });
  } catch (err) {
    res.status(500).json({ message: 'Error' });
  }
};

const getLeaveRequestStats = async (req, res) => {
  try {
    const stats = await Leave.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
    res.json({ stats });
  } catch (error) {
    res.status(500).json({ message: 'Error' });
  }
};

const filterLeaveRequests = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = status ? { status } : {};
    const leaves = await Leave.find(filter).populate('studentId').sort({ appliedAt: -1 });
    res.json(leaves);
  } catch (err) {
    res.status(500).json({ message: 'Error' });
  }
};

const deleteLeaveRequest = async (req, res) => {
  try {
    await Leave.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error' });
  }
};

// <--------- Warden Profile ----------->
const getWardenProfile = async (req, res) => {
  try {
    const warden = await Warden.findById(req.params.id);
    res.status(200).json(warden);
  } catch (error) {
    res.status(500).json({ message: "Error" });
  }
};

const updateWardenProfile = async (req, res) => {
  try {
    const updated = await Warden.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.status(200).json({ message: "Updated", warden: updated });
  } catch (error) {
    res.status(500).json({ message: "Error" });
  }
};

const getAllWarden = async (req, res) => {
  try {
    const wardens = await Warden.find();
    res.status(200).json({ success: true, wardens });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error" });
  }
};

const updateWarden = async (req, res) => {
  try {
    const warden = await Warden.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.status(200).json({ success: true, warden });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error" });
  }
};

const deleteWarden = async (req, res) => {
  try {
    await Warden.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: "Deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error" });
  }
};

// <--------- Emergency Contacts ----------->
const getEmergencyContacts = async (req, res) => {
  try {
    const students = await Student.find({}, 'studentId firstName lastName emergencyContactName relation emergencyContactNumber');
    res.status(200).json({ success: true, contacts: students });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error" });
  }
};

const updateEmergencyContact = async (req, res) => {
  try {
    const updated = await Student.findOneAndUpdate({ studentId: req.params.studentId }, req.body, { new: true });
    res.status(200).json({ success: true, contact: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error" });
  }
};

// <--------- Documents ----------->
const getStudentDocument = async (req, res) => {
  try {
    const { studentId, docType } = req.params;
    const student = await Student.findOne({ studentId });
    if (!student?.documents?.[docType]?.path) return res.status(404).json({ message: "Not found" });
    res.sendFile(path.resolve(student.documents[docType].path));
  } catch (error) {
    res.status(500).json({ message: "Error" });
  }
};

// <--------- Requisitions (Registration) ----------->
const registerIntern = async (req, res) => {
  try {
    const warden = await Warden.findById(req.user.id);
    const documents = {};
    if (req.files) Object.keys(req.files).forEach(k => documents[k] = { filename: req.files[k][0].filename, path: req.files[k][0].path, uploadedAt: new Date() });
    const reqq = new Requisition({ requisitionType: "worker", requestedBy: req.user.id, requestedByName: `${warden.firstName} ${warden.lastName}`, data: { ...req.body, isWorking: true }, documents });
    await reqq.save();
    res.status(201).json({ success: true, message: "Submitted" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error" });
  }
};

const registerStudent = async (req, res) => {
  try {
    const warden = await Warden.findById(req.user.id);
    const documents = {};
    if (req.files) Object.keys(req.files).forEach(k => documents[k] = { filename: req.files[k][0].filename, path: req.files[k][0].path, uploadedAt: new Date() });
    const reqq = new Requisition({ requisitionType: "student", requestedBy: req.user.id, requestedByName: `${warden.firstName} ${warden.lastName}`, data: { ...req.body, isWorking: false }, documents });
    await reqq.save();
    res.status(201).json({ success: true, message: "Submitted" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error" });
  }
};

const registerParent = async (req, res) => {
  try {
    const warden = await Warden.findById(req.user.id);
    const documents = {};
    if (req.files) Object.keys(req.files).forEach(k => documents[k] = { filename: req.files[k][0].filename, path: req.files[k][0].path, uploadedAt: new Date() });
    const reqq = new Requisition({ requisitionType: "parent", requestedBy: req.user.id, requestedByName: `${warden.firstName} ${warden.lastName}`, data: { ...req.body }, documents });
    await reqq.save();
    res.status(201).json({ success: true, message: "Submitted" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error" });
  }
};

const getWardenRequisitions = async (req, res) => {
  try {
    const requisitions = await Requisition.find({ requestedBy: req.user.id }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, requisitions });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error" });
  }
};

const getAllInterns = async (req, res) => {
  try {
    const interns = await Student.find({ isWorking: true }).populate('roomBedNumber', 'itemName barcodeId floor roomNo');
    
    // Fetch all beds to calculate room capacities (room types)
    const allBedItems = await Inventory.find({
      $or: [
        { category: { $in: ['Furniture', 'BEDS'] } },
        { itemName: { $regex: /Bed|B\d+/i } }
      ]
    });
    const capacityMap = {};
    allBedItems.forEach(bed => {
      if (bed.roomNo) {
        capacityMap[bed.roomNo] = (capacityMap[bed.roomNo] || 0) + 1;
      }
    });

    // Fetch all pending invoices to calculate dues
    const pendingInvoices = await StudentInvoice.find({ status: 'pending' });
    const duesMap = {};
    pendingInvoices.forEach(inv => {
      const sId = inv.studentId.toString();
      duesMap[sId] = (duesMap[sId] || 0) + inv.amount;
    });

    const transformedInterns = interns.map((student) => {
      // Infer roomType if not explicitly set
      const inferredRoomType = student.roomType || (student.roomBedNumber?.roomNo ? String(capacityMap[student.roomBedNumber.roomNo]) : "");

      return {
        ...student.toObject(),
        id: student.studentId,
        dues: duesMap[student._id.toString()] || 0,
        roomType: inferredRoomType,
      };
    });

    res.status(200).json({ success: true, workers: transformedInterns });
  } catch (error) {
    console.error("Error fetching workers for warden:", error);
    res.status(500).json({ success: false, message: "Error fetching workers." });
  }
};

const getStudentsWithoutParents = async (req, res) => {
  try {
    const parents = await Parent.find().select('studentId');
    const students = await Student.find({ studentId: { $nin: parents.map(p => p.studentId) } });
    res.status(200).json({ success: true, students });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error" });
  }
};

const updateStudentWarden = async (req, res) => {
  try {
    const updated = await Student.findOneAndUpdate({ studentId: req.params.studentId }, req.body, { new: true });
    res.status(200).json({ success: true, student: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error" });
  }
};

const getAvailableBedsInventory = async (req, res) => {
  try {
    const beds = await Inventory.find({ status: 'Available' });
    res.status(200).json({ success: true, availableBeds: beds });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error" });
  }
};

const getAvailableRoomsInventory = async (req, res) => {
  try {
    const beds = await Inventory.find({ status: 'Available' });
    const rooms = [...new Set(beds.map(b => b.roomNo))];
    res.status(200).json({ success: true, availableRooms: rooms.map(r => ({ roomNo: r })) });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error" });
  }
};

const getInventoryItemById = async (req, res) => {
  try {
    const item = await Inventory.findById(req.params.id);
    res.status(200).json({ success: true, inventory: item });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error" });
  }
};

const getStudentInvoicesForWarden = async (req, res) => {
  try {
    const invoices = await StudentInvoice.find({ studentId: req.query.studentId });
    res.status(200).json({ success: true, invoices });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error" });
  }
};

const updateParentWarden = async (req, res) => {
  try {
    const updated = await Parent.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.status(200).json({ success: true, parent: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error" });
  }
};

const deleteParentWarden = async (req, res) => {
  try {
    await Parent.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: "Deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error" });
  }
};

const getAllParents = async (req, res) => {
  try {
    const parents = await Parent.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, parents });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error" });
  }
};

// <--------- New Requisitions (Notice & Inventory) ----------->
const submitNoticeRequisition = async (req, res) => {
  try {
    const warden = await Warden.findById(req.user.id);
    const newReq = new Requisition({
      requisitionType: "notice",
      requestedBy: req.user.id,
      requestedByName: `${warden.firstName} ${warden.lastName}`,
      data: { ...req.body }
    });
    await newReq.save();
    res.status(201).json({ success: true, message: "Notice request submitted" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error" });
  }
};

const submitInventoryReplacement = async (req, res) => {
  try {
    const { data: stringifiedData } = req.body;
    const photo = req.files?.photo?.[0];
    const data = JSON.parse(stringifiedData);
    const warden = await Warden.findById(req.user.id || req.user._id);
    if (!warden) return res.status(404).json({ success: false, message: "Warden not found" });

    const newReq = new Requisition({
      requisitionType: "inventory_replacement",
      requestedBy: warden._id,
      requestedByName: `${warden.firstName} ${warden.lastName}`,
      data: { itemId: data.itemId, itemName: data.itemName, barcodeId: data.barcodeId, reason: data.reason }
    });

    if (photo) {
      newReq.documents = { photo: { filename: photo.filename, path: photo.path, uploadedAt: new Date() } };
    }

    await newReq.save();
    res.status(201).json({ success: true, message: "Replacement request submitted" });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ success: false, message: "Internal server error", error: error.message });
  }
};

export {
  sendLoginOTP,
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
  getAllLeaveRequests,
  updateLeaveStatus as updateLeaveStatusWarden,
  getLeaveRequestStats,
  filterLeaveRequests,
  getBedStats,
  getBedStatusOverview,
  getRecentInspections,
  getFilteredInspections,
  getInspectionById,
  completeInspection,
  getInspectionStats,
  getWardenDashboardStats,
  updateEmergencyContact,
  getAllWarden,
  updateWarden,
  deleteWarden,
  deleteLeaveRequest,
  getAllAvailableBed,
  deleteInspection,
  checkPunchStatus,
  getStudentDocument,
  registerIntern,
  registerStudent,
  registerParent,
  getAllInterns,
  getAllParents,
  getWardenRequisitions,
  getStudentsWithoutParents,
  updateStudentWarden,
  getAvailableBedsInventory,
  getAvailableRoomsInventory,
  getInventoryItemById,
  getStudentInvoicesForWarden,
  updateParentWarden,
  deleteParentWarden,
  submitNoticeRequisition,
  submitInventoryReplacement
};
