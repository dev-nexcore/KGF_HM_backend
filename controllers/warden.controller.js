import "dotenv/config";
import { emitAddEmployee } from '../socketManager.js';
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
    
    // 📧 Send OTP via Email
    try {
      await sendEmail({
        to: warden.email,
        subject: 'KGF Boys Hostel - Warden Login OTP',
        useKGFLayout: true,
        html: `
              <p style="margin: 0 0 10px; font-size: 11px; font-weight: 700; color: #0066cc; text-transform: uppercase; letter-spacing: 1px;">Hostel Warden Access</p>
              <h2 style="margin: 0 0 20px; font-size: 24px; color: #0f172a; font-weight: 700;">Welcome, ${warden.firstName}</h2>
              
              <p style="margin: 0 0 25px; font-size: 15px; color: #475569; line-height: 1.6;">
                A request to log in to the <strong>KGF Boys Hostel</strong> warden portal was received. Use the credentials below to proceed with your login.
              </p>

              <!-- Credentials Box -->
              <div style="border: 1px solid #e2e8f0; border-left: 4px solid #00a651; border-radius: 6px; padding: 25px; margin-bottom: 25px; background-color: #f8fafc;">
                <p style="margin: 0 0 20px; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 1px;">Login Credentials</p>
                
                <table width="100%" border="0" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="padding: 0 0 15px; border-bottom: 1px solid #e2e8f0; font-size: 14px; color: #64748b; width: 40%;">Email</td>
                    <td style="padding: 0 0 15px; border-bottom: 1px solid #e2e8f0; font-size: 14px; font-weight: 600; text-align: right; width: 60%; word-break: break-all;"><a href="mailto:${warden.email}" style="color: #0066cc; text-decoration: none;">${warden.email}</a></td>
                  </tr>
                  <tr>
                    <td style="padding: 15px 0 0; font-size: 14px; color: #64748b; width: 40%;">Temporary OTP</td>
                    <td style="padding: 15px 0 0; font-size: 22px; font-weight: 700; color: #0066cc; text-align: right; letter-spacing: 2px; width: 60%;">${otp}</td>
                  </tr>
                </table>
              </div>

              <!-- Action Required Box -->
              <div style="background-color: #e6f6ec; border: 1px solid #b3e3c5; border-radius: 6px; padding: 16px; margin-bottom: 20px;">
                <p style="margin: 0; font-size: 13px; color: #007a3c; line-height: 1.5;">
                  <strong>Action required:</strong> This is a temporary OTP required for login. It is valid for exactly <strong>5 minutes</strong>. Please enter it in the warden portal to continue.
                </p>
              </div>

              <!-- Security Reminder Box -->
              <div style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 16px;">
                <p style="margin: 0; font-size: 13px; color: #92400e; line-height: 1.5;">
                  <strong>Security reminder:</strong> Keep your credentials confidential. If you did not expect this login attempt, please secure your account immediately.
                </p>
              </div>
        `
      });
    } catch (mailError) {
      console.error("Email sending error:", mailError);
    }
    
    // Create masked email (e.g. jo***@gmail.com)
    const [name, domain] = warden.email.split('@');
    const maskedEmail = name.length > 2 
      ? name.substring(0, 2) + '*'.repeat(name.length - 2) + '@' + domain
      : name + '@' + domain;

    return res.json({ 
      message: 'OTP sent successfully', 
      contactNumber: warden.contactNumber ? warden.contactNumber.replace(/(\d{2})(\d+)(\d{4})/, '$1****$3') : null,
      email: maskedEmail
    });
  } catch (err) {
    console.error("Error sending OTP:", err);
    return res.status(500).json({ message: "Error sending OTP" });
  }
};

const login = async (req, res) => {
  const { wardenId, otp } = req.body;
  if (!wardenId || !otp) return res.status(400).json({ message: "Warden ID and OTP are required" });
  try {
    const warden = await Warden.findOne({ wardenId });
    if (!warden) return res.status(401).json({ message: "Invalid Warden ID" });

    // Check OTP
    const otpRecord = await Otp.findOne({
      email: warden.email,
      code: otp,
      purpose: 'warden_login'
    });

    if (!otpRecord) {
      return res.status(401).json({ message: "Invalid OTP" });
    }

    if (new Date() > otpRecord.expires) {
      await Otp.deleteOne({ _id: otpRecord._id });
      return res.status(401).json({ message: "OTP has expired. Please request a new OTP." });
    }

    // OTP is valid
    await Otp.deleteOne({ _id: otpRecord._id });

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

    const pendingRequisitions = await Requisition.find({
      requisitionType: { $in: ['student', 'worker'] },
      status: { $in: ['pending', 'rejected'] }
    });

    const pendingStudents = pendingRequisitions.map(req => {
      const data = req.data || {};
      return {
        _id: req._id,
        id: req._id,
        studentId: "Pending",
        name: `${data.firstName || 'Unknown'} ${data.lastName || ''}`.trim(),
        firstName: data.firstName || "Unknown",
        lastName: data.lastName || "",
        contact: data.contactNumber || "N/A",
        contactNumber: data.contactNumber || "N/A",
        email: data.email || "N/A",
        room: data.roomBedNumber && data.roomBedNumber !== "Not Assigned" ? data.roomBedNumber : "Pending",
        roomBedNumber: data.roomBedNumber && data.roomBedNumber !== "Not Assigned" ? data.roomBedNumber : null,
        roomDetails: { roomNo: data.roomBedNumber || "Pending" },
        roomType: data.roomType || "",
        emergencyContactNumber: data.emergencyContactNumber || "",
        emergencyContactName: data.emergencyContactName || "",
        admissionDate: data.admissionDate || "",
        feeStatus: data.feeStatus || "Unpaid",
        monthlyFee: data.monthlyFee || "-",
        dues: 0,
        documents: req.documents || {},
        hasCollegeId: data.hasCollegeId || false,
        isWorking: req.requisitionType === 'worker',
        isAddedToBiometric: false,
        relation: data.relation || "",
        isPendingApproval: req.status === 'pending',
        isRejected: req.status === 'rejected',
        rejectReason: req.rejectionReason || "No reason provided",
        requisitionId: req._id
      };
    });

    const allStudents = [...transformedStudents, ...pendingStudents];
    res.status(200).json({ success: true, students: allStudents });
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
    const { status, target, date } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (target) filter.target = target;
    
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      filter.datetime = { $gte: startOfDay, $lte: endOfDay };
    }

    const inspections = await Inspection.find(filter).sort({ datetime: -1 });
    res.status(200).json({ success: true, inspections });
  } catch (error) {
    console.error("Error in getFilteredInspections:", error);
    res.status(500).json({ success: false, message: 'Error filtering inspections' });
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
    const total = await Inspection.countDocuments();
    const pending = await Inspection.countDocuments({ status: 'pending' });
    const completed = await Inspection.countDocuments({ status: 'completed' });
    
    res.status(200).json({ 
      success: true, 
      stats: { total, pending, completed } 
    });
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
    // Show leaves that are pending (awaiting parent) or parent_approved (awaiting warden)
    const leaves = await Leave.find({ status: { $in: ['pending', 'parent_approved'] } })
      .populate('studentId', 'firstName lastName studentId email contactNumber roomBedNumber')
      .select('leaveType otherLeaveType startDate endDate reason status appliedAt parentComment parentApprovalDate')
      .sort({ appliedAt: -1 });
    res.json(leaves);
  } catch (err) {
    res.status(500).json({ message: 'Error' });
  }
};

const updateLeaveStatus = async (req, res) => {
  try {
    const { leaveId } = req.params;
    const { status, wardenComments } = req.body;
    
    const leave = await Leave.findById(leaveId).populate('studentId');
    
    if (!leave) {
      return res.status(404).json({ message: 'Leave not found' });
    }
    
    // Only allow updating leaves that are pending or parent_approved
    if (!['pending', 'parent_approved'].includes(leave.status)) {
      return res.status(400).json({ message: 'Leave request has already been processed' });
    }
    
    // Translate frontend 'approved'/'rejected' to 'warden_approved'/'warden_rejected'
    const newStatus = status === 'approved' ? 'warden_approved' : (status === 'rejected' ? 'warden_rejected' : status);
    leave.status = newStatus;

    if (wardenComments) {
      leave.wardenComments = wardenComments;
    }
    
    leave.processedAt = new Date();
    await leave.save();
    
    if (leave.studentId && leave.studentId.email) {
      const formattedStartDate = new Date(leave.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Kolkata' });
      const formattedEndDate = new Date(leave.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Kolkata' });
      
      await sendEmail({ 
        to: leave.studentId.email, 
        subject: 'KGF Boys Hostel - Leave Status Update', 
        useKGFLayout: true,
        html: `
          <p style="margin: 0 0 10px; font-size: 11px; font-weight: 700; color: #0066cc; text-transform: uppercase; letter-spacing: 1px;">Leave Application Status</p>
          <h2 style="margin: 0 0 20px; font-size: 24px; color: #0f172a; font-weight: 700;">Update from Warden</h2>
          
          <p style="margin: 0 0 25px; font-size: 15px; color: #475569; line-height: 1.6;">
            Dear <strong>${leave.studentId.firstName}</strong>,<br/>
            Your leave application for <strong>${leave.leaveType === 'Others' && leave.otherLeaveType ? `Others (${leave.otherLeaveType})` : leave.leaveType}</strong> has been reviewed by the warden (<strong style="color: ${status === 'approved' ? '#16a34a' : '#dc2626'}">${status.toUpperCase()}</strong>) and is now pending final approval by the Hostel Admin.
          </p>

          <div style="border: 1px solid #e2e8f0; border-left: 4px solid ${status === 'approved' ? '#16a34a' : '#dc2626'}; border-radius: 6px; padding: 25px; margin-bottom: 25px; background-color: #f8fafc;">
            <p style="margin: 0 0 20px; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 1px;">Application Details</p>
            
            <table width="100%" border="0" cellspacing="0" cellpadding="0">
              <tr>
                <td style="padding: 0 0 15px; border-bottom: 1px solid #e2e8f0; font-size: 14px; color: #64748b; width: 40%;">Leave Type</td>
                <td style="padding: 0 0 15px; border-bottom: 1px solid #e2e8f0; font-size: 14px; font-weight: 600; text-align: right; width: 60%;">${leave.leaveType === 'Others' && leave.otherLeaveType ? `Others (${leave.otherLeaveType})` : leave.leaveType}</td>
              </tr>
              <tr>
                <td style="padding: 15px 0 15px; border-bottom: 1px solid #e2e8f0; font-size: 14px; color: #64748b; width: 40%;">Start Date</td>
                <td style="padding: 15px 0 15px; border-bottom: 1px solid #e2e8f0; font-size: 14px; font-weight: 600; text-align: right; width: 60%;">${formattedStartDate}</td>
              </tr>
              <tr>
                <td style="padding: 15px 0 15px; border-bottom: 1px solid #e2e8f0; font-size: 14px; color: #64748b; width: 40%;">End Date</td>
                <td style="padding: 15px 0 15px; border-bottom: 1px solid #e2e8f0; font-size: 14px; font-weight: 600; text-align: right; width: 60%;">${formattedEndDate}</td>
              </tr>
              <tr>
                <td style="padding: 15px 0 15px; border-bottom: 1px solid #e2e8f0; font-size: 14px; color: #64748b; width: 40%;">Warden Status</td>
                <td style="padding: 15px 0 15px; border-bottom: 1px solid #e2e8f0; font-size: 14px; font-weight: 600; text-align: right; width: 60%; color: ${status === 'approved' ? '#16a34a' : '#dc2626'}; text-transform: capitalize;">${status} (Pending Admin)</td>
              </tr>
              ${wardenComments ? `
              <tr>
                <td style="padding: 15px 0 0; font-size: 14px; color: #64748b; width: 40%; vertical-align: top;">Warden Comments</td>
                <td style="padding: 15px 0 0; font-size: 14px; font-weight: 600; text-align: right; width: 60%;">${wardenComments}</td>
              </tr>
              ` : ''}
            </table>
          </div>
          <p style="margin: 0; font-size: 15px; color: #475569;">You can view the full details in your student portal.</p>
        `
      });
    }
    res.json({ message: `Leave ${status}`, leave });
  } catch (err) {
    console.error('Update leave status error:', err);
    res.status(500).json({ message: 'Error' });
  }
};

const getLeaveRequestStats = async (req, res) => {
  try {
    const totalRequests = await Leave.countDocuments();
    const pendingRequests = await Leave.countDocuments({ status: { $in: ['pending', 'parent_approved'] } }); // Show both as pending for warden
    const approvedRequests = await Leave.countDocuments({ status: { $in: ['approved', 'warden_approved'] } });
    const rejectedRequests = await Leave.countDocuments({ status: { $in: ['rejected', 'warden_rejected'] } });
    
    res.json({ 
      totalRequests, 
      pendingRequests, 
      approvedRequests, 
      rejectedRequests 
    });
  } catch (error) {
    console.error("Error in getLeaveRequestStats:", error);
    res.status(500).json({ message: 'Error' });
  }
};

const filterLeaveRequests = async (req, res) => {
  try {
    const { status, studentName, studentId, startDate, endDate } = req.query;
    let query = {};

    if (status && status !== 'all') {
      query.status = status;
    }

    // Improved date filtering: Find leaves active on the selected date
    if (startDate || endDate) {
      if (startDate && endDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        
        // Match if the leave period overlaps with the filter range
        query.$and = [
          { startDate: { $lte: end } },
          { endDate: { $gte: start } }
        ];
      } else if (startDate) {
        query.startDate = { $gte: new Date(startDate) };
      } else if (endDate) {
        query.endDate = { $lte: new Date(endDate) };
      }
    }

    // Improved student search (Name or ID)
    if (studentName || studentId) {
      const searchStr = (studentName || studentId).trim();
      const searchTerms = searchStr.split(/\s+/);
      
      const students = await Student.find({
        $or: [
          { firstName: { $regex: searchStr, $options: 'i' } },
          { lastName: { $regex: searchStr, $options: 'i' } },
          { studentId: { $regex: searchStr, $options: 'i' } },
          // Match combined first and last name if possible
          { $and: searchTerms.length > 1 ? [
            { firstName: { $regex: searchTerms[0], $options: 'i' } },
            { lastName: { $regex: searchTerms[searchTerms.length - 1], $options: 'i' } }
          ] : [{ _id: null }] }
        ]
      }).select('_id');

      const studentIds = students.map(s => s._id);
      query.studentId = { $in: studentIds };
    }

    const leaves = await Leave.find(query)
      .populate('studentId')
      .sort({ appliedAt: -1 });

    res.json(leaves);
  } catch (err) {
    console.error("Error in filterLeaveRequests:", err);
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
    const updateData = { ...req.body };
    if (req.files?.['aadharCard']) {
      updateData.aadharCard = req.files['aadharCard'][0].path.replace(/\\/g, '/');
    }
    if (req.files?.['panCard']) {
      updateData.panCard = req.files['panCard'][0].path.replace(/\\/g, '/');
    }

    const warden = await Warden.findByIdAndUpdate(req.params.id, updateData, { new: true });
    
    // Emit to biometric agent to update name in device if online
    emitAddEmployee(warden);

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
    const { studentName, studentId } = req.query;
    let query = {};

    if (studentName || studentId) {
      const searchStr = studentName || studentId;
      query.$or = [
        { firstName: { $regex: searchStr, $options: 'i' } },
        { lastName: { $regex: searchStr, $options: 'i' } },
        { studentId: { $regex: searchStr, $options: 'i' } }
      ];
    }

    const students = await Student.find(query, 'studentId firstName lastName emergencyContactName relation emergencyContactNumber');
    
    // Add studentName to each object
    const contacts = students.map(s => ({
      ...s._doc,
      studentName: `${s.firstName} ${s.lastName}`
    }));

    res.status(200).json({ success: true, contacts });
  } catch (error) {
    console.error("Error in getEmergencyContacts:", error);
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
    let student = await Student.findOne({ studentId });
    
    // If not found in Student, it might be a pending requisition where studentId is the Requisition _id
    if (!student && studentId.match(/^[0-9a-fA-F]{24}$/)) {
      student = await Requisition.findById(studentId);
    }
    
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
    const students = await Student.find({ 
      studentId: { $nin: parents.map(p => p.studentId) },
      isWorking: { $ne: true }
    });
    res.status(200).json({ success: true, students });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error" });
  }
};

const updateStudentWarden = async (req, res) => {
  try {
    const { studentId } = req.params;
    let newDocuments = {};
    if (req.files) {
      Object.keys(req.files).forEach(k => {
        newDocuments[k] = { filename: req.files[k][0].filename, path: req.files[k][0].path, uploadedAt: new Date() };
      });
    }

    if (studentId.match(/^[0-9a-fA-F]{24}$/)) {
      // It's a pending/rejected Requisition
      const reqq = await Requisition.findById(studentId);
      if (reqq) {
        reqq.data = { ...reqq.data, ...req.body };
        if (Object.keys(newDocuments).length > 0) {
          reqq.documents = { ...reqq.documents, ...newDocuments };
        }
        reqq.status = 'pending'; // Reset to pending if it was rejected
        await reqq.save();
        return res.status(200).json({ success: true, student: reqq });
      }
    }

    // Otherwise, it's an approved Student
    const student = await Student.findOne({ studentId });
    if (student) {
      Object.assign(student, req.body);
      if (Object.keys(newDocuments).length > 0) {
        student.documents = { ...student.documents, ...newDocuments };
      }
      await student.save();
      return res.status(200).json({ success: true, student });
    }

    res.status(404).json({ success: false, message: "Student not found" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error" });
  }
};

const getBedOccupancyStatus = async (req, res) => {
  try {
    const totalBeds = await Inventory.countDocuments({ 
      $or: [{ category: { $in: ['Furniture', 'BEDS'] } }, { itemName: { $regex: /Bed|B\d+/i } }] 
    });

    const occupiedBeds = await Student.countDocuments({ roomBedNumber: { $ne: null } });

    const availableBeds = Math.max(0, totalBeds - occupiedBeds);

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

const getAvailableBedsInventory = async (req, res) => {
  try {
    const beds = await Inventory.find({
      status: 'Available',
      $or: [
        { category: { $in: ['Furniture', 'BEDS'] } },
        { itemName: { $regex: /Bed|B\d+/i } }
      ]
    });
    res.status(200).json({ success: true, availableBeds: beds });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error" });
  }
};

const getAvailableRoomsInventory = async (req, res) => {
  try {
    const allBedItems = await Inventory.find({
      $or: [
        { category: { $in: ['Furniture', 'BEDS'] } },
        { itemName: { $regex: /Bed|B\d+/i } }
      ]
    });

    const roomStats = {};
    allBedItems.forEach(bed => {
      const roomKey = bed.roomNo;
      if (roomKey) {
        if (!roomStats[roomKey]) {
          roomStats[roomKey] = {
            _id: roomKey,
            roomNo: roomKey,
            floor: bed.floor,
            totalBeds: 0,
            availableBeds: 0
          };
        }
        roomStats[roomKey].totalBeds += 1;
        if (bed.status === 'Available') {
          roomStats[roomKey].availableBeds += 1;
        }
      }
    });

    // Only return rooms that have available beds
    const availableRooms = Object.values(roomStats).filter(r => r.availableBeds > 0);

    res.status(200).json({ success: true, availableRooms });
  } catch (error) {
    console.error("Error in getAvailableRoomsInventory:", error);
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
    const parent = await Parent.findById(req.params.id);
    if (!parent) return res.status(404).json({ success: false, message: "Parent not found." });

    const { firstName, lastName, email, relation, contactNumber } = req.body;
    parent.firstName = firstName || parent.firstName;
    parent.lastName = lastName || parent.lastName;
    parent.email = email || parent.email;
    parent.relation = relation || parent.relation;
    parent.contactNumber = contactNumber || parent.contactNumber;

    if (req.files) {
      if (!parent.documents) parent.documents = {};
      if (req.files.aadharCard && req.files.aadharCard.length > 0) {
        parent.documents.aadharCard = {
          filename: req.files.aadharCard[0].originalname,
          path: req.files.aadharCard[0].path,
          uploadedAt: new Date(),
        };
      }
      if (req.files.panCard && req.files.panCard.length > 0) {
        parent.documents.panCard = {
          filename: req.files.panCard[0].originalname,
          path: req.files.panCard[0].path,
          uploadedAt: new Date(),
        };
      }
      parent.markModified('documents');
    }

    const updated = await parent.save();
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
    const transformedParents = parents.map(p => ({
      ...p.toObject(),
      isPendingApproval: false,
      isRejected: false
    }));

    const pendingRequisitions = await Requisition.find({
      requisitionType: 'parent',
      status: { $in: ['pending', 'rejected'] }
    });

    const pendingParents = pendingRequisitions.map(reqDoc => {
      const req = reqDoc.toObject ? reqDoc.toObject() : reqDoc;
      const data = req.data || {};
      return {
        _id: req._id,
        id: req._id,
        firstName: data.firstName || "Unknown",
        lastName: data.lastName || "",
        contactNumber: data.contactNumber || "N/A",
        email: data.email || "N/A",
        relation: data.relation || "",
        studentId: data.studentId || "Unknown",
        documents: req.documents || data.documents || {},
        isPendingApproval: req.status === 'pending',
        isRejected: req.status === 'rejected',
        rejectReason: req.adminNotes || "No reason provided",
        requisitionId: req._id
      };
    });

    const allParents = [...transformedParents, ...pendingParents];
    res.status(200).json({ success: true, parents: allParents });
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
  getBedOccupancyStatus,
  getAvailableRoomsInventory,
  getInventoryItemById,
  getStudentInvoicesForWarden,
  updateParentWarden,
  deleteParentWarden,
  submitNoticeRequisition,
  submitInventoryReplacement
};
export const registerStaffWarden = async (req, res) => {
  const { firstName, lastName, email, contactNumber, designation, shiftStart, shiftEnd, salary } = req.body;
  const aadharCard = req.files?.['aadharCard'] ? req.files['aadharCard'][0].path.replace(/\\/g, '/') : null;
  const panCard = req.files?.['panCard'] ? req.files['panCard'][0].path.replace(/\\/g, '/') : null;

  try {
    const existingStaff = await Staff.findOne({ email });
    if (existingStaff) {
      return res.status(409).json({ success: false, message: "Staff already exists with this email." });
    }

    const count = await Staff.countDocuments();
    const paddedNumber = String(count + 1).padStart(3, '0');
    const staffId = `STF${paddedNumber}`;
    const password = `${firstName.toLowerCase().replace(/\s+/g, '')}${staffId}`;

    const newStaff = new Staff({
      firstName,
      lastName,
      email,
      contactNumber,
      designation,
      shiftStart,
      shiftEnd,
      salary,
      staffId,
      password,
      aadharCard,
      panCard,
      status: 'Pending'
    });

    await newStaff.save();

    // Biometric device integration can be deferred until admin approval.
    // If you want it added immediately, uncomment below.
    // emitAddEmployee({
    //   staffId,
    //   firstName,
    //   lastName
    // });

    return res.json({
      success: true,
      message: "Staff registered successfully. Sent to admin for approval."
    });
  } catch (error) {
    console.error("Error registering staff by warden:", error);
    return res.status(500).json({ success: false, message: "Error registering staff." });
  }
};
