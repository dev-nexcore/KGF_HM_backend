import mongoose from 'mongoose';
import 'dotenv/config';

mongoose.connect(process.env.DB_URL, {
  dbName: 'KGF_HM',
})
  .then(async () => {
    const allBeds = await mongoose.connection.collection('inventories').find({
      $or: [
        { category: { $in: ['Furniture', 'BEDS', 'Bed'] } },
        { itemName: { $regex: /Bed|B\d+/i } }
      ]
    }).toArray();
    
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
    const validBeds = await mongoose.connection.collection('inventories').find(bedCriteria).toArray();
    
    const validBedIds = new Set(validBeds.map(b => b._id.toString()));
    const excludedBeds = allBeds.filter(b => !validBedIds.has(b._id.toString()));
    
    console.log(`Excluded beds: ${excludedBeds.length}`);
    excludedBeds.forEach(b => {
        console.log(`- ${b.itemName} | Barcode: ${b.barcodeId} | Floor: ${b.floor} | Location: ${b.location} | Room: ${b.roomNo} | Category: ${b.locationCategory}`);
    });
    
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
