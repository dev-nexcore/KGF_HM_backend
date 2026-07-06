import mongoose from 'mongoose';
import 'dotenv/config';

mongoose.connect(process.env.DB_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  dbName: 'KGF_HM',
})
  .then(async () => {
    const totalItems = await mongoose.connection.collection('inventories').countDocuments({});
    console.log(`Total inventory items in KGF_HM: ${totalItems}`);
    
    // Find sample beds if any
    const allBeds = await mongoose.connection.collection('inventories').find({ 
      $or: [
        { itemName: { $regex: /bed/i } },
        { category: { $regex: /bed/i } }
      ]
    }).toArray();
    
    console.log(`Beds found by regex: ${allBeds.length}`);
    if (allBeds.length > 0) {
      console.log('Sample bed:');
      console.log(JSON.stringify(allBeds[0], null, 2));
    }
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
