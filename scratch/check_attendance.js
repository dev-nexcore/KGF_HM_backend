import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Student } from '../models/student.model.js';
import Attendance from '../models/attendance.model.js';

dotenv.config();

async function checkAttendance() {
  try {
    await mongoose.connect(process.env.DB_URL, {
        dbName: 'KGF_HM'
    });
    console.log("Connected to DB KGF_HM");

    const totalStudents = await Student.countDocuments();
    console.log("Total Students:", totalStudents);

    const totalAttendance = await Attendance.countDocuments();
    console.log("Total Attendance Records:", totalAttendance);

    const latestLogs = await Attendance.find().sort({ timestamp: -1 }).limit(5).populate('studentId');
    console.log("Latest Logs:", JSON.stringify(latestLogs, null, 2));

    const studentsWithLogs = await Student.find({ "attendanceLog.0": { $exists: true } }).limit(5);
    console.log("Students with app-based logs:", studentsWithLogs.map(s => ({ 
      name: s.firstName, 
      id: s.studentId, 
      logCount: s.attendanceLog.length 
    })));

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkAttendance();
