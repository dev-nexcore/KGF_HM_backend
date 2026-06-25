import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Student } from './models/student.model.js';

dotenv.config();

async function checkStudent() {
  try {
    await mongoose.connect(process.env.DB_URL, { dbName: 'KGF_HM' });
    const student = await Student.findOne({ studentId: "STU-001" });
    if (student) {
      console.log("Found student:", student.studentId, student.email);
    } else {
      console.log("Student not found.");
    }
  } catch (err) {
    console.error(err);
  } finally {
    mongoose.disconnect();
  }
}

checkStudent();
