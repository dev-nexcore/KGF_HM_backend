import mongoose from 'mongoose';
import 'dotenv/config';

mongoose.connect(process.env.DB_URL, {
  dbName: 'KGF_HM',
})
  .then(async () => {
    const beds = await mongoose.connection.collection('inventories').find({
      itemName: { $regex: /Bed|\bB\d+/i }
    }).toArray();
    
    console.log(`Matched beds with \\b: ${beds.length}`);
    const stbs = beds.filter(b => b.itemName.includes('STB') || b.itemName.includes('MOB'));
    console.log(`Matched STB/MOB: ${stbs.length}`);

    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
