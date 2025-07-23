import mongoose from 'mongoose';

const noticeSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  subject: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['NEW', 'READ'],
    default: 'NEW'
  }
});

export default mongoose.model('Notice', noticeSchema);