const mongoose = require('mongoose');
const Requisition = require('./models/requisition.model.js');

mongoose.connect('mongodb://localhost:27017/kgf_hm_db').then(async () => {
  try {
    const res = await Requisition.updateMany(
      { 'data.roomType': { $exists: false } }, 
      { $set: { 'data.roomType': '5' } }
    );
    console.log('Updated:', res);
  } catch (err) {
    console.error(err);
  }
  process.exit();
});
