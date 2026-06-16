import mongoose from 'mongoose';
import 'dotenv/config';
import { getAttendanceLogs, getAttendanceStats } from './controllers/admin/attendance.controller.js';

async function test() {
  try {
    await mongoose.connect(process.env.DB_URL);
    
    // Fake Express req/res
    const req = { query: { date: '2026-06-15' } };
    
    const res1 = {
      status: (code) => ({
        json: (data) => console.log(`LOGS API [${code}]:`, Object.keys(data))
      })
    };
    
    const res2 = {
      status: (code) => ({
        json: (data) => console.log(`STATS API [${code}]:`, Object.keys(data))
      })
    };

    console.log("Calling getAttendanceLogs...");
    await getAttendanceLogs(req, res1);
    
    console.log("Calling getAttendanceStats...");
    await getAttendanceStats(req, res2);

    process.exit(0);
  } catch (error) {
    console.error("Test script failed:", error);
    process.exit(1);
  }
}

test();
