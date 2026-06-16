import mongoose from 'mongoose';
import 'dotenv/config';
import { syncAttendanceLogs } from './utils/esslService.js';
import { default as Attendance } from './models/attendance.model.js';
import { Student } from './models/student.model.js';

async function test() {
  try {
    await mongoose.connect(process.env.DB_URL);
    const date = '2026-06-15';
    
    // ... rest of API logic
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    const query = { timestamp: { $gte: start, $lte: end } };
    const logs = await Attendance.find(query).populate('studentId', 'firstName lastName studentId isWorking roomBedNumber');

    const students = await Student.find({ isWorking: false });
    const staff = await Student.find({ isWorking: true });

    const presentStudents = new Set(logs.filter(log => log.studentId && log.studentId.isWorking === false).map(log => log.studentId._id.toString()));
    const presentStaff = new Set(logs.filter(log => log.studentId && log.studentId.isWorking === true).map(log => log.studentId._id.toString()));

    const stats = {
      studentStats: {
        totalStudents: students.length,
        presentToday: presentStudents.size,
        absentToday: students.length - presentStudents.size
      },
      staffStats: {
        totalStaff: staff.length,
        presentToday: presentStaff.size,
        absentToday: staff.length - presentStaff.size
      }
    };

    console.log("SUCCESS. Stats:", stats);
    console.log("Logs count:", logs.length);
    process.exit(0);
  } catch (error) {
    console.error("API ERROR:", error);
    process.exit(1);
  }
}

test();
