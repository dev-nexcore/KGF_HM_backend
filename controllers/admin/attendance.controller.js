import Attendance from "../../models/attendance.model.js";
import { Student } from "../../models/student.model.js";
import { Staff } from "../../models/staff.model.js";
import { Warden } from "../../models/warden.model.js";
import { getAgentStatus } from "../../socketManager.js";

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

    // Logs are now synced via Biometric Agent WebSocket (SYNC_LOGS event)

    const logs = await Attendance.find(query)
      .populate({
        path: 'studentId',
        select: 'firstName lastName studentId roomBedNumber isWorking',
        populate: {
          path: 'roomBedNumber',
          select: 'roomNo barcodeId'
        }
      })
      .populate({
        path: 'staffId',
        select: 'firstName lastName staffId designation'
      })
      .populate({
        path: 'wardenId',
        select: 'firstName lastName wardenId designation'
      })
      .sort({ timestamp: -1 });

    // Filter results if search is provided
    let filteredLogs = logs;
    if (search) {
      const s = search.toLowerCase();
      filteredLogs = logs.filter(log => {
        const student = log.studentId;
        const staff = log.staffId;
        const warden = log.wardenId;
        const name = student ? `${student.firstName} ${student.lastName}` : (staff ? `${staff.firstName} ${staff.lastName}` : (warden ? `${warden.firstName} ${warden.lastName}` : ""));
        const id = student?.studentId || staff?.staffId || warden?.wardenId || "";
        const room = student?.roomBedNumber?.roomNo || staff?.designation || warden?.designation || "";
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

    const students = await Student.find({}, '_id isWorking');
    const normalStudentIds = students.filter(s => !s.isWorking).map(s => s._id);
    const workerIds = students.filter(s => s.isWorking).map(s => s._id);
    
    const staffMembers = await Staff.find({}, '_id');
    const staffIds = staffMembers.map(s => s._id);

    const presentStudents = await Attendance.distinct('studentId', {
      timestamp: { $gte: startOfDay, $lte: endOfDay },
      studentId: { $in: normalStudentIds }
    });

    const presentWorkers = await Attendance.distinct('studentId', {
      timestamp: { $gte: startOfDay, $lte: endOfDay },
      studentId: { $in: workerIds }
    });

    const presentStaff = await Attendance.distinct('staffId', {
      timestamp: { $gte: startOfDay, $lte: endOfDay },
      staffId: { $in: staffIds }
    });

    const wardens = await Warden.find({}, '_id');
    const wardenIds = wardens.map(w => w._id);
    const presentWardens = await Attendance.distinct('wardenId', {
      timestamp: { $gte: startOfDay, $lte: endOfDay },
      wardenId: { $in: wardenIds }
    });

    res.status(200).json({
      success: true,
      stats: {
        studentStats: {
          totalStudents: normalStudentIds.length,
          presentToday: presentStudents.length,
          absentToday: normalStudentIds.length - presentStudents.length
        },
        workerStats: {
          totalWorkers: workerIds.length,
          presentToday: presentWorkers.length,
          absentToday: workerIds.length - presentWorkers.length
        },
        staffStats: {
          totalStaff: staffIds.length + wardenIds.length,
          presentToday: presentStaff.length + presentWardens.length,
          absentToday: (staffIds.length + wardenIds.length) - (presentStaff.length + presentWardens.length)
        }
      }
    });
  } catch (error) {
    console.error("STATS ERROR:", error);
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

// Check Biometric Device Status
export const getBiometricDeviceStatus = async (req, res) => {
  try {
    // If we're using the Local Agent with WebSocket, return the agent's status
    const agentStatus = getAgentStatus();
    res.status(200).json(agentStatus);
  } catch (error) {
    res.status(500).json({
      success: false,
      status: 'Offline',
      message: "Error checking biometric status",
      error: error.message
    });
  }
};
