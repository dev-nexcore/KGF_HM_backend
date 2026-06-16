import mongoose from 'mongoose';
import 'dotenv/config';
import Attendance from './models/attendance.model.js';
import { Warden } from './models/warden.model.js';

mongoose.connect(process.env.DB_URL || 'mongodb://127.0.0.1:27017/KGF_HM', {
  dbName: 'KGF_HM'
}).then(async () => {
    console.log("Connected to DB, patching warden attendance logs...");
    
    // Find all wardens
    const wardens = await Warden.find();
    console.log(`Found ${wardens.length} wardens.`);
    
    let patchedCount = 0;
    
    for (const warden of wardens) {
      if (!warden.wardenId) continue;
      
      const result = await Attendance.updateMany(
        { employeeCode: warden.wardenId, wardenId: null },
        { $set: { wardenId: warden._id } }
      );
      
      if (result.modifiedCount > 0) {
        console.log(`Patched ${result.modifiedCount} logs for Warden ${warden.firstName} (${warden.wardenId})`);
        patchedCount += result.modifiedCount;
      }
    }
    
    console.log(`Finished patching. Total logs patched: ${patchedCount}`);
    mongoose.disconnect();
  })
  .catch(err => {
    console.error("DB connection error:", err);
  });
