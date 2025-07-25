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


// Login Page For Warden
// This function handles the login process for wardens.

// POST /api/wardenauth/login

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





// warden profile Page

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



// Get Emergency Contacts Page.

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



// Student Management Page
// Get student list for warden




const getStudentListForWarden = async (req, res) => {
  try {
    const { studentId, roomNo } = req.query;

    let studentFilter = {};

    // Filter by studentId (partial match)
    if (studentId) {
      studentFilter.studentId = { $regex: studentId, $options: 'i' };
    }

    let bedIds = [];

    // Filter by roomNo (partial match from Inventory)
    if (roomNo) {
      const matchedBeds = await Inventory.find({
        roomNo: { $regex: roomNo, $options: 'i' },
      }).select('_id');

      bedIds = matchedBeds.map(bed => bed._id);

      if (bedIds.length === 0) {
        return res.status(200).json({ success: true, students: [] }); // No results if no beds match
      }

      studentFilter.roomBedNumber = { $in: bedIds };
    }

    const students = await Student.find(studentFilter)
      .populate({
        path: 'roomBedNumber',
        select: 'barcodeId roomNo',
      })
      .select('studentId studentName contactNumber roomBedNumber');

    const formattedStudents = students.map(student => ({
      studentId: student.studentId,
      studentName: student.studentName,
      contactNumber: student.contactNumber,
      barcodeId: student.roomBedNumber?.barcodeId || null,
      roomNo: student.roomBedNumber?.roomNo || null,
    }));

    res.status(200).json({
      success: true,
      students: formattedStudents,
    });
  } catch (error) {
    console.error('Error fetching student list:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch student list',
      error: error.message,
    });
  }
};




// Update student room/bed number

// const updateStudentRoom = async (req, res) => {
//   try {
//     const { studentId } = req.params;
//     const { roomBedNumber } = req.body;

//     const student = await Student.findOneAndUpdate(
//       { studentId },
//       { roomBedNumber },
//       { new: true } // returns the updated document
//     );

//     if (!student) {
//       return res.status(404).json({
//         success: false,
//         message: "Student not found",
//       });
//     }

//     res.status(200).json({
//       success: true,
//       message: "Room/Bed number updated successfully",
//       student,
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: "Failed to update student room",
//       error: error.message,
//     });
//   }
// };




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



// Warden Punch In and Punch Out Page.

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




// Leave Request Management Page


import sendEmail from '../utils/sendEmail.js'; // assumes you have email utility

// Get All Leave Requests
const getAllLeaveRequests = async (req, res) => {
  try {
    const leaves = await Leave.find()
      .populate('studentId', 'studentName studentId')
      .sort({ appliedAt: -1 });
    res.json(leaves);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};


// Update Leave Status
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

    const student = leave.studentId;
    const emailContent = `
      Dear ${student.studentName},
      
      Your leave request from ${leave.startDate.toDateString()} to ${leave.endDate.toDateString()} has been ${status}.
      
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
    res.status(500).json({ message: 'Server error', error: err });
  }
};



// Get Leave Request Stats

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



// Filter Leave Requests

const filterLeaveRequests = async (req, res) => {
  try {
    const { studentName, studentId, status, startDate, endDate } = req.query;

    const filter = {};

    // Use aggregation for advanced filtering and joins
    const matchStage = {};

    if (status) matchStage.status = status;
    if (startDate || endDate) {
      matchStage.startDate = {};
      if (startDate) matchStage.startDate.$gte = new Date(startDate);
      if (endDate) matchStage.startDate.$lte = new Date(endDate);
    }

    // Build student filters
    const studentFilter = {};
    if (studentName) {
      studentFilter.studentName = new RegExp('^' + studentName + '$', 'i'); // exact name match (case-insensitive)
    }
    if (studentId) {
      studentFilter.studentId = studentId; // exact ID match
    }

    // Find matching student IDs
    let studentIds = [];
    if (studentName || studentId) {
      const students = await Student.find(studentFilter).select('_id');
      studentIds = students.map(s => s._id);
      matchStage.studentId = { $in: studentIds };
    }

    const leaves = await Leave.find(matchStage)
      .populate('studentId', 'studentName studentId')
      .sort({ appliedAt: -1 });

    res.status(200).json(leaves);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};


// bed allotment

// Get Bed Statistics


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







// GET /api/inventory/bed-status?floor=1&roomNo=101&status=Available
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



// inspection management




const getRecentInspections = async (req, res) => {
  try {
    const inspections = await Inspection.find({})
      .sort({ datetime: -1 })
      .select('title target status datetime')
      .lean();

    const formatted = inspections.map(ins => {
      const dateObj = new Date(ins.datetime);
      return {
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


// Filter inspections based on date, time, status, and target


const getFilteredInspections = async (req, res) => {
  try {
    const { date, time, status, target } = req.query;

    const match = {};

    if (status) {
      match.status = new RegExp(`^${status}$`, 'i'); // case-insensitive match
    }

    if (target) {
      match.target = new RegExp(`^${target}$`, 'i'); // case-insensitive match
    }

    // Handle date filter
    if (date) {
      const start = new Date(date);
      const end = new Date(date);
      end.setDate(end.getDate() + 1);
      match.datetime = { $gte: start, $lt: end };
    }

    // If time is provided, use aggregation
    const pipeline = [];

    // Match base filters
    if (Object.keys(match).length > 0) {
      pipeline.push({ $match: match });
    }

    // Add hour and minute fields
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

    // Match time if given
    if (time) {
      pipeline.push({
        $match: {
          timeStr: { $regex: `^${time}` }, // e.g., "09" or "09:00"
        },
      });
    }

    // Sort and project final result
    pipeline.push(
      { $sort: { datetime: -1 } },
      {
        $project: {
          _id: 0,
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

    const inspections = await Inspection.aggregate(pipeline);

    res.status(200).json({
      success: true,
      inspections,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch inspections',
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

    const inspection = await Inspection.findById(id);
    if (!inspection) {
      return res.status(404).json({ success: false, message: "Inspection not found" });
    }

    inspection.status = 'completed';
    await inspection.save();

    res.status(200).json({ success: true, message: "Inspection marked as completed", inspection });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to update inspection status" });
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
};
