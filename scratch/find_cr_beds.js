import mongoose from 'mongoose';
import 'dotenv/config';

mongoose.connect(process.env.DB_URL, {
  dbName: 'KGF_HM',
})
  .then(async () => {
    // Find ALL beds
    const allBeds = await mongoose.connection.collection('inventories').find({
      $or: [
        { category: { $in: ['Furniture', 'BEDS', 'Bed'] } },
        { itemName: { $regex: /Bed|B\d+/i } }
      ]
    }).toArray();
    
    console.log(`Total beds before any filters: ${allBeds.length}`);
    
    const crBeds = allBeds.filter(b => {
        // match CR in barcode, location, roomNo, or itemName
        const barcode = b.barcodeId || '';
        const loc = b.location || '';
        const room = b.roomNo || '';
        const name = b.itemName || '';
        
        return barcode.match(/CR/i) || loc.match(/conference/i) || room.match(/conference/i) || name.match(/conference/i);
    });
    
    console.log(`Suspicious CR/Conference beds: ${crBeds.length}`);
    crBeds.forEach(b => console.log(JSON.stringify(b, null, 2)));

    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
