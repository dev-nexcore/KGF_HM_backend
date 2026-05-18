import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Student } from '../models/student.model.js';

dotenv.config();

async function checkVinayak() {
  try {
    await mongoose.connect(process.env.DB_URL, { dbName: 'KGF_HM' });
    const student = await Student.findOne({ studentId: 'STUW-001' });
    console.log("Vinayak Logs:", JSON.stringify(student.attendanceLog, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkVinayak();
