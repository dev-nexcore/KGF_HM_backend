require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.DB_URL).then(async () => {
  console.log('Connected to DB');
  const InventorySchema = new mongoose.Schema({}, { strict: false });
  const Inventory = mongoose.model('Inventory', InventorySchema, 'inventories');
  
  const allBeds = await Inventory.find({ itemName: { $regex: /bed/i } }).lean();
  console.log('Found', allBeds.length, 'beds');
  if(allBeds.length > 0) {
    console.log('Sample bed:', allBeds[0]);
    const roomNos = [...new Set(allBeds.map(b => b.roomNo))];
    console.log('Room Nos containing beds:', roomNos);
  }
  process.exit(0);
});
