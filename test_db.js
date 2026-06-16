import mongoose from 'mongoose';
import 'dotenv/config';
import { syncAttendanceLogs } from './utils/esslService.js';
import { default as Attendance } from './models/attendance.model.js';
import { Student } from './models/student.model.js';

async function test() {
  await mongoose.connect(process.env.DB_URL);
  
  const syncStart = '2026-06-15';
  const syncResult = await syncAttendanceLogs(syncStart, syncStart);
  
  if (syncResult.success && syncResult.logs) {
    for (const log of syncResult.logs) {
      try {
        const existingLog = await Attendance.findOne({
          employeeCode: log.employeeCode,
          timestamp: log.timestamp
        });

        if (!existingLog) {
          const student = await Student.findOne({ studentId: log.employeeCode });
          const newAttendance = new Attendance({
            studentId: student ? student._id : null,
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
            console.log("Already exists:", log.employeeCode);
        }
      } catch (err) {
        console.error("Save error for", log.employeeCode, err.message);
      }
    }
  }
  process.exit(0);
}

test();
