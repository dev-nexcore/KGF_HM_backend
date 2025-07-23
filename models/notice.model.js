const mongoose = require('mongoose');

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

module.exports = mongoose.model('Notice', noticeSchema);