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



// <------------    Login Page For Warden  -------------->

 const login = async (req, res) => {
  const { wardenId, password } = req.body;

  try {
    const warden = await Warden.findOne({ wardenId });
    if (!warden) return res.status(401).json({ message: "Invalid Warden ID" });

    const isMatch = await warden.comparePassword(password);
    if (!isMatch) return res.status(401).json({ message: "Invalid password" });

    //  Generate JWT Token
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



//  <--------  Warden Punch In and Punch Out Page. ----------->


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




// <------- Warden Dashboard Summary ---------->

const getWardenDashboardStats = async (req, res) => {
  try {
    // Total Students
    const totalStudents = await Student.countDocuments();

    // Total Beds
    const totalBeds = await Inventory.countDocuments({ itemName: 'Bed' });

    // In Use Beds
    const inUseBeds = await Inventory.countDocuments({ itemName: 'Bed', status: 'In Use' });

    // Available Beds
    const availableBeds = await Inventory.countDocuments({ itemName: 'Bed', status: 'Available' });

    // Damaged Beds
    const damagedBeds = await Inventory.countDocuments({ itemName: 'Bed', status: 'Damaged' });

    // Upcoming Inspections (future + pending) — no limit
    const now = new Date();

    const upcomingInspections = await Inspection.find({
      datetime: { $gte: now },
      status: "pending"
    }).sort({ datetime: 1 }); // sorted but no limit

    const upcomingInspectionCount = await Inspection.countDocuments({
      datetime: { $gte: now },
      status: "pending"
    });

    res.status(200).json({
      totalStudents,
      totalBeds,
      inUseBeds,
      availableBeds,
      damagedBeds,
      upcomingInspectionCount,
      upcomingInspections
    });

  } catch (error) {
    console.error("Error in getWardenDashboardStats:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};



// <---------- bed allotment page -------->


const getBedStats = async (req, res) => {
  try {
    const stats = await Inventory.aggregate([
      {
        $match: { itemName: 'Bed' }  // Only count items with itemName === 'Bed'
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Convert result array to an object
    const result = {
      totalBeds: 0,
      available: 0,
      inUse: 0,
      inMaintenance: 0,
      damaged: 0
    };

    stats.forEach(stat => {
      result.totalBeds += stat.count;
      switch (stat._id) {
        case 'Available':
          result.available = stat.count;
          break;
        case 'In Use':
          result.inUse = stat.count;
          break;
        case 'In maintenance':
          result.inMaintenance = stat.count;
          break;
        case 'Damaged':
          result.damaged = stat.count;
          break;
      }
    });

    res.status(200).json(result);
  } catch (error) {
    console.error('Error getting bed stats:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};


const getBedStatusOverview = async (req, res) => {
  try {
    const { floor, roomNo, status } = req.query;

    // Build filter object dynamically
    const filters = {
      category: 'Furniture',
      itemName: /bed/i
    };

    if (floor) filters.floor = floor;
    if (roomNo) filters.roomNo = roomNo;
    if (status) filters.status = status;

    const beds = await Inventory.find(filters, 'barcodeId floor roomNo status');

    res.status(200).json(beds);
  } catch (error) {
    console.error('Error fetching bed status:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};



// <-----------  Student Management Page ---------->


const getStudentListForWarden = async (req, res) => {
  try {
    const { studentId, roomNo, status } = req.query;
    let studentFilter = {};

    // Filter by partial studentId
    if (studentId) {
      studentFilter.studentId = { $regex: studentId, $options: "i" };
    }

    // Filter by partial roomNo (from Inventory)
    if (roomNo) {
      const matchedBeds = await Inventory.find({
        roomNo: { $regex: roomNo, $options: "i" },
      }).select("_id");

      const bedIds = matchedBeds.map((bed) => bed._id);
      if (bedIds.length === 0) {
        return res.status(200).json({ success: true, students: [] });
      }

      studentFilter.roomBedNumber = { $in: bedIds };
    }

    // Fetch students with attendance log and bed info
    const allStudents = await Student.find(studentFilter)
      .populate({ path: "roomBedNumber", select: "barcodeId roomNo" })
      .select("studentId firstName lastName contactNumber roomBedNumber attendanceLog");

    const today = new Date();

    // Get students currently on leave
    const activeLeaveRecords = await Leave.find({
      status: "approved",
      startDate: { $lte: today },
      endDate: { $gte: today },
    });

    const leaveStudentIds = activeLeaveRecords.map((leave) =>
      leave.studentId.toString()
    );

    // Filter students based on status query
    const filteredStudents = allStudents.filter((student) => {
      const studentIdStr = student._id.toString();
      const latestLog = student.attendanceLog?.[student.attendanceLog.length - 1];
      const isCheckedOut =
        latestLog?.checkOutDate && new Date(latestLog.checkOutDate) <= today;
      const isOnLeave = leaveStudentIds.includes(studentIdStr);

      if (status === "Active") {
        return !isOnLeave && !isCheckedOut;
      } else if (status === "On Leave") {
        return isOnLeave;
      } else if (status === "Checked Out") {
        return isCheckedOut && !isOnLeave; // Exclude if also on leave
      } else {
        return true; // No filter
      }
    });

    // Format the final response
    const formattedStudents = filteredStudents.map((student) => {
      const studentIdStr = student._id.toString();
      const latestLog = student.attendanceLog?.[student.attendanceLog.length - 1];
      const isCheckedOut =
        latestLog?.checkOutDate && new Date(latestLog.checkOutDate) <= today;
      const isOnLeave = leaveStudentIds.includes(studentIdStr);

      let currentStatus = "Active";
      if (isOnLeave) {
        currentStatus = "On Leave"; // Highest priority
      } else if (isCheckedOut) {
        currentStatus = "Checked Out";
      }

      return {
        studentId: student.studentId,
        studentName: `${student.firstName} ${student.lastName}`,
        contactNumber: student.contactNumber,
        barcodeId: student.roomBedNumber?.barcodeId || null,
        roomNo: student.roomBedNumber?.roomNo || null,
        status: currentStatus,
      };
    });

    res.status(200).json({
      success: true,
      students: formattedStudents,
    });
  } catch (error) {
    console.error("Error fetching student list:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch student list",
      error: error.message,
    });
  }
};


const updateStudentRoom = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { barcodeId } = req.body;

    // 1. Find the student
    const student = await Student.findOne({ studentId }).populate('roomBedNumber');
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found',
      });
    }

    // 2. Find the new bed by barcodeId
    const newBed = await Inventory.findOne({ barcodeId });
    if (!newBed) {
      return res.status(404).json({
        success: false,
        message: 'No bed found with the given barcode ID',
      });
    }

    // 3. Prevent assigning bed if already in use
    if (newBed.status === 'In Use') {
      return res.status(400).json({
        success: false,
        message: 'This bed is already assigned to another student',
      });
    }

    // 4. Free up old bed if exists
    if (student.roomBedNumber) {
      const oldBed = await Inventory.findById(student.roomBedNumber._id);
      if (oldBed) {
        oldBed.status = 'Available';
        await oldBed.save();
      }
    }

    // 5. Assign new bed to student
    student.roomBedNumber = newBed._id;
    await student.save();

    // 6. Mark new bed as "In Use"
    newBed.status = 'In Use';
    await newBed.save();

    // 7. Send updated student data
    const updatedStudent = await Student.findById(student._id).populate('roomBedNumber');

    res.status(200).json({
      success: true,
      message: 'Student bed assignment updated successfully',
      student: updatedStudent,
    });

  } catch (error) {
    console.error('Error updating student room:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while assigning bed',
      error: error.message,
    });
  }
};


const getAllAvailableBed = async (req, res) => {
  try {
    const beds = await Inventory.find({ status: 'Available', itemName:'Bed' }).select('barcodeId roomNo');
    res.status(200).json({ success: true, beds });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch beds', error: error.message });
  }
};



const getTotalStudents = async (req, res) => {
  try {
    const totalStudents = await Student.countDocuments();
    const today = new Date();

    // Fetch on leave students
    const onLeaveRecords = await Leave.find({
      status: "approved",
      startDate: { $lte: today },
      endDate: { $gte: today },
    });
    const onLeaveStudentIds = new Set(onLeaveRecords.map(record => record.studentId.toString()));

    // Fetch all students with attendance log
    const allStudents = await Student.find().select("attendanceLog");
    
    let checkedOutCount = 0;
    
    for (let student of allStudents) {
      const studentIdStr = student._id.toString();
      const latestLog = student.attendanceLog?.[student.attendanceLog.length - 1];

      const isCheckedOut = latestLog?.checkOutDate && new Date(latestLog.checkOutDate) <= today;
      const isOnLeave = onLeaveStudentIds.has(studentIdStr);

      // Count as Checked Out only if not On Leave
      if (isCheckedOut && !isOnLeave) {
        checkedOutCount++;
      }
    }

    const onLeave = onLeaveStudentIds.size;
    const active = totalStudents - onLeave - checkedOutCount;

    res.status(200).json({
      success: true,
      totalStudents,
      activeStudents: active,
      onLeaveStudents: onLeave,
      checkedOutStudents: checkedOutCount,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to get student counts",
      error: error.message,
    });
  }
};


// <--------  inspection management Page ----------->




const getRecentInspections = async (req, res) => {
  try {
    const inspections = await Inspection.find({})
      .sort({ datetime: -1 })
      .select('_id title target status datetime') // ✅ Include _id
      .lean();

    const formatted = inspections.map(ins => {
      const dateObj = new Date(ins.datetime);
      return {
        _id: ins._id, // ✅ Include _id in formatted output
        date: dateObj.toISOString().split('T')[0],
        time: dateObj.toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        title: ins.title || '',
        target: ins.target || '',
        status: ins.status
          ? ins.status.charAt(0).toUpperCase() + ins.status.slice(1)
          : 'Unknown',
      };
    });

    res.status(200).json({
      success: true,
      inspections: formatted,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch inspections',
      error: error.message,
    });
  }
};



const getFilteredInspections = async (req, res) => {
  try {
    const { date, time, status, target } = req.query;

    const match = {};

    //  Case-insensitive exact match for status and target
    if (status) {
      match.status = new RegExp(`^${status}$`, 'i');
    }

    if (target) {
      match.target = new RegExp(`^${target}$`, 'i');
    }

    //  Filter by exact date range (00:00 to 23:59 of that day)
    if (date) {
      const start = new Date(date);
      const end = new Date(date);
      end.setDate(end.getDate() + 1);
      match.datetime = { $gte: start, $lt: end };
    }

    //  Start aggregation pipeline
    const pipeline = [];

    // Initial match stage if filters exist
    if (Object.keys(match).length > 0) {
      pipeline.push({ $match: match });
    }

    //  Add timeStr field from datetime
    pipeline.push({
      $addFields: {
        timeStr: {
          $dateToString: {
            format: "%H:%M",
            date: "$datetime",
            timezone: "Asia/Kolkata",
          },
        },
      },
    });

    //  Match inspections by time string (e.g. "09", "10:30")
    if (time) {
      pipeline.push({
        $match: {
          timeStr: { $regex: `^${time}` }, // partial match
        },
      });
    }

    //  Final formatting: sort and return only required fields
    pipeline.push(
      { $sort: { datetime: -1 } },
      {
        $project: {
          _id: 1,
          title: 1,
          target: 1,
          status: 1,
          date: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$datetime",
              timezone: "Asia/Kolkata",
            },
          },
          time: "$timeStr",
        },
      }
    );

    // Execute aggregation
    const inspections = await Inspection.aggregate(pipeline);

    res.status(200).json({
      success: true,
      inspections,
    });
  } catch (error) {
    console.error("Error in getFilteredInspections:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch inspections",
      error: error.message,
    });
  }
};


const getInspectionById = async (req, res) => {
  try {
    const inspection = await Inspection.findById(req.params.id).populate('createdBy', 'name email');

    if (!inspection) {
      return res.status(404).json({ success: false, message: 'Inspection not found' });
    }

    res.status(200).json({ success: true, inspection });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch inspection', error: error.message });
  }
};


const completeInspection = async (req, res) => {
  try {
    const { id } = req.params;
    console.log("Received ID:", id);

    // Check if ID is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      console.log("Invalid ObjectId");
      return res.status(400).json({ success: false, message: "Invalid inspection ID" });
    }

    const inspection = await Inspection.findById(id);
    if (!inspection) {
      console.log("Inspection not found in DB");
      return res.status(404).json({ success: false, message: "Inspection not found" });
    }

    inspection.status = "completed";
    await inspection.save();

    console.log("Inspection marked completed:", inspection._id);
    res.status(200).json({ success: true, message: "Inspection marked as completed", inspection });
  } catch (error) {
    console.error("Error in completeInspection:", error);
    res.status(500).json({ success: false, message: "Failed to update inspection status", error: error.message });
  }
};


const getInspectionStats = async (req, res) => {
  try {
    const total = await Inspection.countDocuments();
    const pending = await Inspection.countDocuments({ status: 'pending' });
    const completed = await Inspection.countDocuments({ status: 'completed' });

    res.status(200).json({
      success: true,
      stats: {
        total,
        pending,
        completed,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch inspection statistics',
      error: error.message,
    });
  }
};


const deleteInspection = async (req, res) => {  
  const { id } = req.params;
  try {         
    const inspection = await Inspection.findByIdAndDelete(id);
    if (!inspection) {
      return res.status(404).json({ success: false, message: 'Inspection not found' });
    }   
    res.status(200).json({ success: true, message: 'Inspection deleted successfully' });
  } catch (error) {
    console.error('Error deleting inspection:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};



// <--------- Leave Request Management Page ----------->


const getAllLeaveRequests = async (req, res) => {
  try {
    const leaves = await Leave.find()
      .populate('studentId', 'firstName lastName studentId')  // fixed line
      .sort({ appliedAt: -1 });

    res.json(leaves);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};


const updateLeaveStatus = async (req, res) => {
  const { leaveId } = req.params;
  const { status } = req.body;

  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status value' });
  }

  try {
    const leave = await Leave.findByIdAndUpdate(
      leaveId,
      { status },
      { new: true }
    ).populate('studentId');

    if (!leave) {
      return res.status(404).json({ message: 'Leave request not found' });
    }

    const student = leave.studentId;
    const fullName = `${student.firstName} ${student.lastName}`;

    const emailContent = `
      Dear ${fullName},

      Your leave request from ${new Date(leave.startDate).toDateString()} to ${new Date(leave.endDate).toDateString()} has been ${status}.

      Regards,
      Hostel Management
    `;

    await sendEmail({
      to: student.email,
      subject: 'Leave Request Status',
      text: emailContent,
    });

    res.json({ message: `Leave ${status}`, leave });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};


const getLeaveRequestStats = async (req, res) => {
  try {
    const total = await Leave.countDocuments();
    const pending = await Leave.countDocuments({ status: 'pending' });
    const approved = await Leave.countDocuments({ status: 'approved' });
    const rejected = await Leave.countDocuments({ status: 'rejected' });

    res.json({
      totalRequests: total,
      pendingRequests: pending,
      approvedRequests: approved,
      rejectedRequests: rejected,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};


const filterLeaveRequests = async (req, res) => {
  try {
    const { studentName, studentId, status, startDate, endDate } = req.query;

    const matchStage = {};

    // Status filter
    if (status) matchStage.status = status;

    // Date filter
    if (startDate || endDate) {
      matchStage.startDate = {};
      if (startDate) matchStage.startDate.$gte = new Date(startDate);
      if (endDate) matchStage.startDate.$lte = new Date(endDate);
    }

    // Student filters
    const studentFilter = {};
    if (studentName || studentId) {
      const searchTerm = studentName || studentId;

      studentFilter.$or = [
        { studentId: { $regex: searchTerm, $options: 'i' } },
        { firstName: { $regex: searchTerm, $options: 'i' } },
        { lastName: { $regex: searchTerm, $options: 'i' } },
        {
          $expr: {
            $regexMatch: {
              input: { $concat: ['$firstName', ' ', '$lastName'] },
              regex: searchTerm,
              options: 'i'
            }
          }
        }
      ];
    }

    // Get matching students
    let studentIds = [];
    if (studentName || studentId) {
      const students = await Student.find(studentFilter).select('_id');
      studentIds = students.map((s) => s._id);

      if (studentIds.length > 0) {
        matchStage.studentId = { $in: studentIds };
      } else {
        // No matching students found
        return res.status(200).json([]);
      }
    }

    // Fetch filtered leaves
    const leaves = await Leave.find(matchStage)
      .populate('studentId', 'firstName lastName studentId')
      .sort({ appliedAt: -1 });

    res.status(200).json(leaves);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};


const deleteLeaveRequest = async (req, res) => {
  const { leaveId } = req.params;   
  try {
    const leave = await Leave.findByIdAndDelete(leaveId); 
    if (!leave) {
      return res.status(404).json({ message: 'Leave request not found' });
    }
    res.status(200).json({ message: 'Leave request deleted successfully' });
  } catch (error) {
    console.error('Error deleting leave request:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};



//  <---------- Warden Profile Page ------------>

const getWardenProfile = async (req, res) => {
  try {
    const warden = await Warden.findById(req.params.id).select(
      "firstName lastName email contactNumber wardenId profilePhoto"
    );

    if (!warden) {
      return res.status(404).json({ message: "Warden not found" });
    }

    res.status(200).json(warden);
  } catch (error) {
    console.error("Error fetching profile:", error);
    res.status(500).json({ message: "Server error" });
  }
};


const updateWardenProfile = async (req, res) => {
  try {
    const { firstName, lastName, email, contactNumber } = req.body;

    const warden = await Warden.findById(req.params.id);
    if (!warden) return res.status(404).json({ message: "Warden not found" });

    // Update basic fields
    warden.firstName = firstName || warden.firstName;
    warden.lastName = lastName || warden.lastName;
    warden.email = email || warden.email;
    warden.contactNumber = contactNumber || warden.contactNumber;

    // Handle profile photo update
    if (req.file) {
      // Delete old photo if it exists
      if (warden.profilePhoto) {
        const oldPath = path.join(__dirname, "../uploads/wardens/", warden.profilePhoto);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }

      // Save new photo
      warden.profilePhoto = req.file.filename;
    }

    await warden.save();

    res.status(200).json({ message: "Profile updated", warden });
  } catch (error) {
    console.error("Update error:", error);
    res.status(500).json({ message: "Update failed", error });
  }
};


const getAllWarden = async (req, res) => {
  try {
    const wardens = await Warden.find({}, 'wardenId firstName lastName email contactNumber profilePhoto attendanceLog');

    res.status(200).json({
      success: true,
      wardens: wardens.map(warden => ({
        id: warden._id,
        wardenId: warden.wardenId,
        firstName: warden.firstName,
        lastName: warden.lastName,
        email: warden.email,
        contactNumber: warden.contactNumber,
        profilePhoto: warden.profilePhoto ? `${process.env.BASE_URL}/uploads/${warden.profilePhoto}` : null,
        attendanceLog: warden.attendanceLog.map(log => ({
          date: log.date,
          punchIn: log.punchIn,
          punchOut: log.punchOut,
          totalHours: log.totalHours,
        }))
      })),
    });
  } catch (error) {
    console.error("Error fetching wardens:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch wardens",
      error: error.message,
    });
  }
};



// <--------- Emergency Contact Page ----------->


const getEmergencyContacts = async (req, res) => {
  try {
    const { studentName, studentId } = req.query;

    let filter = {};

    if (studentName || studentId) {
      const searchTerm = studentName?.trim() || studentId?.trim();

      if (studentName) {
        // Split the name into parts to match first and last names separately
        const nameParts = searchTerm.split(" ");
        const nameConditions = [];

        if (nameParts.length === 1) {
          // If only one name part, search in both first and last name
          nameConditions.push(
            { firstName: { $regex: nameParts[0], $options: 'i' } },
            { lastName: { $regex: nameParts[0], $options: 'i' } }
          );
        } else {
          // If two or more parts, match both first and last name
          nameConditions.push({
            $and: [
              { firstName: { $regex: nameParts[0], $options: 'i' } },
              { lastName: { $regex: nameParts[1], $options: 'i' } },
            ]
          });
        }

        filter = {
          $or: [
            ...nameConditions,
            { studentId: { $regex: searchTerm, $options: 'i' } }
          ]
        };
      } else {
        // Only studentId search
        filter = {
          studentId: { $regex: searchTerm, $options: 'i' }
        };
      }
    }

    const students = await Student.find(filter, {
      studentId: 1,
      firstName: 1,
      lastName: 1,
      emergencyContactName: 1,
      relation: 1,
      emergencyContactNumber: 1,
      _id: 0,
    });

    const contacts = students.map((student) => ({
      studentId: student.studentId,
      studentName: `${student.firstName} ${student.lastName}`,
      emergencyContactName: student.emergencyContactName,
      relation: student.relation,
      emergencyContactNumber: student.emergencyContactNumber,
    }));

    res.status(200).json({
      success: true,
      contacts,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch emergency contacts",
      error: error.message,
    });
  }
};



const updateEmergencyContact = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { emergencyContactName, relation, emergencyContactNumber } = req.body;

    // Validate required fields
    if (!emergencyContactName || !relation || !emergencyContactNumber) {
      return res.status(400).json({
        success: false,
        message: "All fields (emergencyContactName, relation, emergencyContactNumber) are required.",
      });
    }

    // Find and update student
    const updatedStudent = await Student.findOneAndUpdate(
      { studentId }, // filter
      { emergencyContactName, relation, emergencyContactNumber }, // update
      { new: true, fields: { studentId: 1, studentName: 1, emergencyContactName: 1, relation: 1, emergencyContactNumber: 1 } } // return updated fields only
    );

    if (!updatedStudent) {
      return res.status(404).json({
        success: false,
        message: `Student with ID ${studentId} not found.`,
      });
    }

    res.status(200).json({
      success: true,
      message: "Emergency contact updated successfully.",
      contact: updatedStudent,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update emergency contact.",
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
  deleteLeaveRequest,
  getAllAvailableBed,
  deleteInspection
}
