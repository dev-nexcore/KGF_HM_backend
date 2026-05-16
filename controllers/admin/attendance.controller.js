import Attendance from "../../models/attendance.model.js";
import { Student } from "../../models/student.model.js";
import { Staff } from "../../models/staff.model.js";


// Get attendance logs with filters
export const getAttendanceLogs = async (req, res) => {
  try {
    const { startDate, endDate, type, search } = req.query;
    let query = {};

    if (startDate && endDate) {
      query.timestamp = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    // If type is specified (student/staff)
    // This depends on how we distinguish them in the database.
    // Assuming students have studentId and staff might have a different identifier or we check the ref.

    const logs = await Attendance.find(query)
      .populate('studentId', 'firstName lastName studentId roomBedNumber')
      .sort({ timestamp: -1 });

    res.status(200).json({
      success: true,
      logs
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching attendance logs",
      error: error.message
    });
  }
};

// Get attendance statistics
export const getAttendanceStats = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const totalStudents = await Student.countDocuments();
    // Assuming we have a way to count present students today
    const presentToday = await Attendance.distinct('studentId', {
      timestamp: { $gte: today }
    });

    res.status(200).json({
      success: true,
      stats: {
        totalStudents,
        presentToday: presentToday.length,
        absentToday: totalStudents - presentToday.length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching attendance statistics",
      error: error.message
    });
  }
};

// Mark manual attendance (Optional feature if biometric fails)
export const markManualAttendance = async (req, res) => {
  try {
    const { studentId, direction, timestamp, reason } = req.body;
    
    const newEntry = new Attendance({
      studentId,
      direction,
      timestamp: timestamp || new Date(),
      deviceName: "Manual Entry",
      serialNumber: "ADMIN-MANUAL",
      verificationType: "Admin Override",
      employeeCode: "N/A", // Or fetch from student
      originalLog: { reason, markedBy: "Admin" }
    });

    await newEntry.save();

    res.status(201).json({
      success: true,
      message: "Attendance marked manually",
      entry: newEntry
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error marking manual attendance",
      error: error.message
    });
  }
};
