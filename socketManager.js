import { Server } from "socket.io";
import Attendance from "./models/attendance.model.js";
import { Student } from "./models/student.model.js";
import { Staff } from "./models/staff.model.js";
import { Warden } from "./models/warden.model.js";

let io;
let adminNamespace;
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

  adminNamespace = io.of('/admin');
  adminNamespace.on('connection', (socket) => {
    console.log(`📡 Admin connected: ${socket.id}`);
    socket.on('disconnect', () => {
      console.log(`🔌 Admin disconnected: ${socket.id}`);
    });
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
        if (!logs || logs.length === 0) {
          if (callback) callback({ success: true, inserted: 0 });
          return;
        }

        // Extract unique employee codes
        const employeeCodes = [...new Set(logs.map(l => l.employeeCode))];
        
        // Parallel fetch for associated records
        const [students, staffs, wardens] = await Promise.all([
          Student.find({ studentId: { $in: employeeCodes } }, '_id studentId').lean(),
          Staff.find({ staffId: { $in: employeeCodes } }, '_id staffId').lean(),
          Warden.find({ wardenId: { $in: employeeCodes } }, '_id wardenId').lean()
        ]);

        const studentMap = new Map(students.map(s => [s.studentId, s._id]));
        const staffMap = new Map(staffs.map(s => [s.staffId, s._id]));
        const wardenMap = new Map(wardens.map(w => [w.wardenId, w._id]));

        // Build bulk write operations
        const bulkOps = logs.map(log => {
          const timestampDate = new Date(log.timestamp);
          const studentId = studentMap.get(log.employeeCode) || null;
          const staffId = staffMap.get(log.employeeCode) || null;
          const wardenId = wardenMap.get(log.employeeCode) || null;

          return {
            updateOne: {
              filter: { 
                employeeCode: log.employeeCode, 
                timestamp: timestampDate 
              },
              update: {
                $setOnInsert: {
                  studentId: studentId,
                  staffId: staffId,
                  wardenId: wardenId,
                  employeeCode: log.employeeCode,
                  direction: log.direction,
                  timestamp: timestampDate,
                  deviceName: log.deviceName || "Biometric Device",
                  serialNumber: log.serialNumber || "N/A",
                  verificationType: log.verificationType || "Biometric",
                  originalLog: { syncedFrom: "Agent", ...log }
                }
              },
              upsert: true
            }
          };
        });

        const result = await Attendance.bulkWrite(bulkOps);
        const insertedCount = result.upsertedCount;
        
        console.log(`✅ Synced ${insertedCount} new logs from Local Agent.`);
        
        // Broadcast to admin dashboard
        if (insertedCount > 0) {
          adminNamespace.emit('NEW_ATTENDANCE', { count: insertedCount });
        }
        
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

export const emitNewAttendance = (count = 1) => {
  if (adminNamespace) {
    adminNamespace.emit('NEW_ATTENDANCE', { count });
    return true;
  }
  return false;
};
