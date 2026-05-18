import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Student } from '../models/student.model.js';

dotenv.config();

async function checkStudents() {
  try {
    await mongoose.connect(process.env.DB_URL);
    console.log("Connected to DB");

    const totalStudents = await Student.countDocuments();
    console.log("Total Students:", totalStudents);

    const students = await Student.find().limit(5);
    console.log("Students:", students.map(s => ({ name: s.firstName, id: s.studentId, email: s.email })));

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkStudents();
