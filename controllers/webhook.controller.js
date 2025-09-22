import crypto from 'crypto';
import Student from '../models/student.model.js';
import Attendance from '../models/attendance.model.js';
import { sendNotification } from '../utils/sendNotification.js';

const decryptData = (encryptedData) => {
  try {
    const ENCRYPTION_KEY = process.env.ESSL_ENCRYPTION_KEY;
    if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 32) {
      throw new Error('Invalid encryption key');
    }

    const textParts = encryptedData.split(':');
    const iv = Buffer.from(textParts.shift() || '', 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return JSON.parse(decrypted.toString());
  } catch (error) {
    console.error('Decryption failed:', error);
    return null;
  }
};

export const handleAttendanceWebhook = async (req, res) => {
  try {
    // Handle both encrypted and unencrypted formats
    let attendanceData = req.body.data ? 
      decryptData(req.body.data) : 
      req.body;

    if (!attendanceData) {
      return res.status(400).json({
        success: false,
        message: 'Invalid attendance data format'
      });
    }

    // Find student by employee code
    const student = await Student.findOne({ 
      rollNumber: attendanceData.EmployeeCode 
    });

    if (!student) {
      console.warn(`Student not found for EmployeeCode: ${attendanceData.EmployeeCode}`);
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Create attendance record
    const attendance = new Attendance({
      studentId: student._id,
      direction: attendanceData.Direction,
      timestamp: new Date(attendanceData.LogDate),
      deviceName: attendanceData.DeviceName,
      serialNumber: attendanceData.SerialNumber,
      verificationType: attendanceData.VerificationType,
      employeeCode: attendanceData.EmployeeCode,
      originalLog: attendanceData
    });

    await attendance.save();

    // Send notification to parent
    if (student.parentId) {
      const message = `Your ward ${student.name} has ${attendanceData.Direction === 'IN' ? 'entered' : 'left'} the hostel at ${new Date(attendanceData.LogDate).toLocaleTimeString()}`;
      await sendNotification(student.parentId, 'ATTENDANCE_UPDATE', message, {
        studentId: student._id,
        attendanceId: attendance._id
      });
    }

    // Return success as required by ESSL system
    res.json({ success: true });

  } catch (error) {
    console.error('Webhook handling failed:', error);
    res.status(500).json({ success: false });
  }
};