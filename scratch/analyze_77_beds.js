import mongoose from 'mongoose';
import 'dotenv/config';

mongoose.connect(process.env.DB_URL, {
  dbName: 'KGF_HM',
})
  .then(async () => {
    const bedCriteria = {
      $or: [
        { category: { $in: ['Furniture', 'BEDS', 'Bed'] } },
        { itemName: { $regex: /Bed|B\d+/i } }
      ],
      barcodeId: { $not: /^CR/i },
      location: { $not: /gym|conference|store|common/i },
      roomNo: { $not: /gym|conference|store|common/i },
      locationCategory: 'Residential Room',
      floor: { $nin: ['3', '03', '3rd', 'Floor 3', 'Third'] }
    };

    const beds = await mongoose.connection.collection('inventories').find(bedCriteria).toArray();
    console.log(`Total beds matched: ${beds.length}`);
    
    // Check if any of these 77 beds are actually CR beds
    const crBedsIn77 = beds.filter(b => {
        const barcode = b.barcodeId || '';
        const loc = b.location || '';
        const room = b.roomNo || '';
        const name = b.itemName || '';
        
        return barcode.match(/CR/i) || loc.match(/conference/i) || room.match(/conference/i) || name.match(/conference/i);
    });
    
    console.log(`CR beds hiding in the 77 matched beds: ${crBedsIn77.length}`);
    if (crBedsIn77.length > 0) {
        crBedsIn77.forEach(b => console.log(JSON.stringify(b, null, 2)));
    } else {
        // Find what are the other beds that the user thinks shouldn't be there
        // Or maybe my regex filter doesn't work in MongoDB?
    }

    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
