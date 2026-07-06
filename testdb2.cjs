const mongoose = require('mongoose');

mongoose.connect("mongodb://kgf_admin:nexcorealliance@72.62.241.150:27024/kgf?authSource=admin").then(async () => {
  const InventorySchema = new mongoose.Schema({}, { strict: false });
  const Inventory = mongoose.model('Inventory', InventorySchema, 'inventories');
  
  const sampleBed = await Inventory.findOne({ $or: [{ category: { $in: ['Furniture', 'BEDS'] } }, { itemName: { $regex: /Bed|B\d+/i } }] }).lean();
  console.log('Sample bed fields:', Object.keys(sampleBed));
  console.log('Sample bed:', sampleBed);
  
  const allBeds = await Inventory.find({ $or: [{ category: { $in: ['Furniture', 'BEDS'] } }, { itemName: { $regex: /Bed|B\d+/i } }] }).lean();
  
  const locations = [...new Set(allBeds.map(b => b.location))];
  const roomNos = [...new Set(allBeds.map(b => b.roomNo))];
  const locationCategories = [...new Set(allBeds.map(b => b.locationCategory))];
  
  console.log('Locations:', locations);
  console.log('Room Nos:', roomNos);
  console.log('Location Categories:', locationCategories);
  
  process.exit(0);
});
