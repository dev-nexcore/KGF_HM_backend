import { Server } from "socket.io";
import Attendance from "./models/attendance.model.js";
import { Student } from "./models/student.model.js";
import { Staff } from "./models/staff.model.js";
import { Warden } from "./models/warden.model.js";

let io;
let agentStatus = 'Offline';
let lastHeartbeat = null;
let agentSocketId = null;
let devicesStatus = [];

const AGENT_AUTH_TOKEN = 'Zlw4SAYOtp3USM2HKmJsCZrJ6Ul8z2FCfLyiCFPZCso';

export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: "*", // Or specific origins
      methods: ["GET", "POST"]
    }
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.headers['x-agent-token'];
    if (token === AGENT_AUTH_TOKEN) {
      return next();
    }
    return next(new Error('Authentication error: Invalid Token'));
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Local Agent connected: ${socket.id}`);
    agentStatus = 'Online';
    lastHeartbeat = new Date();
    agentSocketId = socket.id;

    socket.on('HEARTBEAT', (payload) => {
      agentStatus = 'Online';
      lastHeartbeat = new Date();
      if (payload && payload.devices) {
        devicesStatus = payload.devices;
      }
    });

    socket.on('SYNC_LOGS', async (logs, callback) => {
      try {
        let insertedCount = 0;
        for (const log of logs) {
          const timestampDate = new Date(log.timestamp);
          const existingLog = await Attendance.findOne({
            employeeCode: log.employeeCode,
            timestamp: timestampDate
          });

          if (!existingLog) {
            const student = await Student.findOne({ studentId: log.employeeCode });
            const staff = await Staff.findOne({ staffId: log.employeeCode });
            const warden = await Warden.findOne({ wardenId: log.employeeCode });

            const newAttendance = new Attendance({
              studentId: student ? student._id : null,
              staffId: staff ? staff._id : null,
              wardenId: warden ? warden._id : null,
              employeeCode: log.employeeCode,
              direction: log.direction,
              timestamp: timestampDate,
              deviceName: log.deviceName || "Biometric Device",
              serialNumber: log.serialNumber || "N/A",
              verificationType: log.verificationType || "Biometric",
              originalLog: { syncedFrom: "Agent", ...log }
            });
            await newAttendance.save();
            insertedCount++;
          }
        }
        console.log(`✅ Synced ${insertedCount} new logs from Local Agent.`);
        if (callback) callback({ success: true, inserted: insertedCount });
      } catch (error) {
        console.error("Error processing agent logs:", error);
        if (callback) callback({ success: false, error: error.message });
      }
    });

    socket.on('disconnect', () => {
      console.log(`❌ Local Agent disconnected: ${socket.id}`);
      agentStatus = 'Offline';
      agentSocketId = null;
    });
  });

  // Check for stale heartbeat every 30 seconds
  setInterval(() => {
    if (lastHeartbeat && (new Date() - lastHeartbeat) > 60000) { // 60 seconds without heartbeat
      agentStatus = 'Offline';
    }
  }, 30000);
};

export const getAgentStatus = () => {
  return {
    status: agentStatus,
    lastHeartbeat: lastHeartbeat,
    devices: devicesStatus
  };
};

export const emitAddEmployee = (employeeData) => {
  if (io && agentStatus === 'Online') {
    io.emit('ADD_EMPLOYEE', employeeData);
    return true;
  }
  return false;
};
