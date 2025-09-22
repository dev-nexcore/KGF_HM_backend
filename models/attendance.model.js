import mongoose from 'mongoose';

const attendanceSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true,
    index: true
  },
  direction: {
    type: String,
    enum: ['IN', 'OUT'],
    required: true
  },
  timestamp: {
    type: Date,
    required: true,
    index: true
  },
  deviceName: {
    type: String,
    required: true
  },
  serialNumber: {
    type: String,
    required: true
  },
  verificationType: {
    type: String,
    required: true
  },
  employeeCode: {
    type: String,
    required: true,
    index: true
  },
  originalLog: {
    type: Object,
    required: true
  }
}, {
  timestamps: true
});

// Create compound index for efficient querying
attendanceSchema.index({ studentId: 1, timestamp: -1 });

export default mongoose.model('Attendance', attendanceSchema);