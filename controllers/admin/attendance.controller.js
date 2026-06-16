import Attendance from "../../models/attendance.model.js";
import { Student } from "../../models/student.model.js";
import { Staff } from "../../models/staff.model.js";
import { syncAttendanceLogs } from "../../utils/esslService.js";

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

    // --- eSSL Biometric Sync ---
    try {
      const today = new Date();
      const past30Days = new Date(today);
      past30Days.setDate(today.getDate() - 30);
      
      const syncStart = past30Days.toISOString().split('T')[0];
      const syncEnd = today.toISOString().split('T')[0];
      
      const syncResult = await syncAttendanceLogs(syncStart, syncEnd);
      if (syncResult.success && syncResult.logs && syncResult.logs.length > 0) {
        console.log(`Biometric logs fetched: ${syncResult.logs.length}`);
        for (const log of syncResult.logs) {
          // Check for existing log to prevent duplicates
          const existingLog = await Attendance.findOne({
            employeeCode: log.employeeCode,
            timestamp: log.timestamp
          });

          if (!existingLog) {
            // Find student or staff to get the ObjectId
            const student = await Student.findOne({ studentId: log.employeeCode });
            const staff = await Staff.findOne({ staffId: log.employeeCode });
            
            const newAttendance = new Attendance({
              studentId: student ? student._id : null,
              staffId: staff ? staff._id : null,
              employeeCode: log.employeeCode,
              direction: log.direction,
              timestamp: log.timestamp,
              deviceName: log.deviceName,
              serialNumber: log.serialNumber,
              verificationType: log.verificationType,
              originalLog: { syncedFrom: "eSSL Biometric", ...log }
            });
            await newAttendance.save();
            console.log("Saved new attendance log for:", log.employeeCode);
          } else {
            console.log("Skipped saving: Log already exists for", log.employeeCode);
          }
        }
      }
    } catch (syncError) {
      console.error("Error syncing attendance from biometric:", syncError);
    }
    // --- End eSSL Biometric Sync ---

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
      .sort({ timestamp: -1 });

    // Filter results if search is provided
    let filteredLogs = logs;
    if (search) {
      const s = search.toLowerCase();
      filteredLogs = logs.filter(log => {
        const student = log.studentId;
        const staff = log.staffId;
        const name = student ? `${student.firstName} ${student.lastName}` : (staff ? `${staff.firstName} ${staff.lastName}` : "");
        const id = student?.studentId || staff?.staffId || "";
        const room = student?.roomBedNumber?.roomNo || staff?.designation || "";
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
          totalStaff: staffIds.length,
          presentToday: presentStaff.length,
          absentToday: staffIds.length - presentStaff.length
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
