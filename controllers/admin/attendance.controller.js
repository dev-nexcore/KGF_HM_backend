import Attendance from "../../models/attendance.model.js";
import { Student } from "../../models/student.model.js";
import { Staff } from "../../models/staff.model.js";


// Get attendance logs with filters
export const getAttendanceLogs = async (req, res) => {
  try {
    const { startDate, endDate, date, type, search } = req.query;
    let query = {};

    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      query.timestamp = { $gte: start, $lte: end };
    } else if (startDate && endDate) {
      query.timestamp = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const logs = await Attendance.find(query)
      .populate({
        path: 'studentId',
        select: 'firstName lastName studentId roomBedNumber',
        populate: {
          path: 'roomBedNumber',
          select: 'roomNo barcodeId'
        }
      })
      .sort({ timestamp: -1 });

    // Filter results if search is provided
    let filteredLogs = logs;
    if (search) {
      const s = search.toLowerCase();
      filteredLogs = logs.filter(log => {
        const student = log.studentId;
        const name = student ? `${student.firstName} ${student.lastName}` : "";
        const id = student?.studentId || "";
        const room = student?.roomBedNumber?.roomNo || "";
        return name.toLowerCase().includes(s) || id.toLowerCase().includes(s) || room.toLowerCase().includes(s);
      });
    }

    res.status(200).json({
      success: true,
      logs: filteredLogs
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
    const { date } = req.query;
    const targetDate = date ? new Date(date) : new Date();
    
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const totalStudents = await Student.countDocuments();
    // Assuming we have a way to count present students today
    const presentToday = await Attendance.distinct('studentId', {
      timestamp: { $gte: startOfDay, $lte: endOfDay }
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
