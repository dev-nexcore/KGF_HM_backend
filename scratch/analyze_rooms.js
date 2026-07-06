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
    
    // Group by floor
    const byFloor = {};
    beds.forEach(b => {
        const f = b.floor || 'Unknown';
        if (!byFloor[f]) byFloor[f] = 0;
        byFloor[f]++;
    });
    console.log("Beds by floor:", byFloor);
    
    // Group by room
    const byRoom = {};
    beds.forEach(b => {
        const r = b.roomNo || 'Unknown';
        if (!byRoom[r]) byRoom[r] = [];
        byRoom[r].push(b.itemName);
    });
    
    console.log("Beds by room:");
    for (const r in byRoom) {
        console.log(`Room ${r}: ${byRoom[r].length} beds (${byRoom[r].join(', ')})`);
    }

    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
