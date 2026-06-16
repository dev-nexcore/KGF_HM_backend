import mongoose from 'mongoose';
import 'dotenv/config';
import { getAttendanceLogs } from './controllers/admin/attendance.controller.js';

async function test() {
  try {
    await mongoose.connect(process.env.DB_URL);
    
    // Fake Express req/res
    const req = { query: { date: '2026-06-15' } };
    
    const res = {
      status: (code) => ({
        json: (data) => {
           console.log(`API [${code}]: Success=${data.success}`);
           console.log(`Logs returned: ${data.logs ? data.logs.length : 0}`);
           if (data.logs && data.logs.length > 0) {
              console.log("Sample log:", JSON.stringify(data.logs[0], null, 2));
           } else if (data.message) {
              console.log("Error message:", data.message);
              console.log("Error details:", data.error);
           }
        }
      })
    };
    
    console.log("Calling getAttendanceLogs...");
    await getAttendanceLogs(req, res);
    
    process.exit(0);
  } catch (error) {
    console.error("Test script failed:", error);
    process.exit(1);
  }
}

test();
