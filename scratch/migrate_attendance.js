import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Student } from '../models/student.model.js';
import Attendance from '../models/attendance.model.js';

dotenv.config();

async function migrateAttendance() {
  try {
    await mongoose.connect(process.env.DB_URL, { dbName: 'KGF_HM' });
    console.log("Connected to DB KGF_HM");

    const students = await Student.find({ "attendanceLog.0": { $exists: true } });
    console.log(`Found ${students.length} students with logs`);

    let syncedCount = 0;

    for (const student of students) {
      for (const log of student.attendanceLog) {
        // Check if check-in already synced
        const checkInExists = await Attendance.findOne({
          studentId: student._id,
          direction: 'IN',
          timestamp: log.checkInDate
        });

        if (!checkInExists) {
          await Attendance.create({
            studentId: student._id,
            direction: 'IN',
            timestamp: log.checkInDate,
            deviceName: "Student App (Migrated)",
            serialNumber: "APP-CHECKIN",
            verificationType: "Selfie + Location",
            employeeCode: student.studentId,
            originalLog: {
              selfie: log.checkInSelfie,
              location: log.checkInLocation
            }
          });
          syncedCount++;
        }

        // Check if check-out already synced (if exists)
        if (log.checkOutDate) {
          const checkOutExists = await Attendance.findOne({
            studentId: student._id,
            direction: 'OUT',
            timestamp: log.checkOutDate
          });

          if (!checkOutExists) {
            await Attendance.create({
              studentId: student._id,
              direction: 'OUT',
              timestamp: log.checkOutDate,
              deviceName: "Student App (Migrated)",
              serialNumber: "APP-CHECKOUT",
              verificationType: "Selfie + Location",
              employeeCode: student.studentId,
              originalLog: {
                selfie: log.checkOutSelfie,
                location: log.checkOutLocation
              }
            });
            syncedCount++;
          }
        }
      }
    }

    console.log(`Migration completed. Synced ${syncedCount} records.`);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

migrateAttendance();
