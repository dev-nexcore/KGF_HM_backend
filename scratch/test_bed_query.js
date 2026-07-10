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
    console.log(`Total beds found: ${beds.length}`);
    if (beds.length > 0) {
      console.log('Sample bed barcodeIds:', beds.slice(0, 10).map(b => b.barcodeId));
    }
    
    // Also let's check how many CR beds exist
    const crBeds = await mongoose.connection.collection('inventories').find({ barcodeId: { $regex: /^CR/i } }).toArray();
    console.log(`Total CR beds found: ${crBeds.length}`);
    if (crBeds.length > 0) {
        console.log('Sample CR bed barcodeIds:', crBeds.slice(0, 5).map(b => b.barcodeId));
    }

    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
