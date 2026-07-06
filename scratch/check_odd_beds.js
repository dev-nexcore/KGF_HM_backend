import mongoose from 'mongoose';
import 'dotenv/config';

mongoose.connect(process.env.DB_URL, {
  dbName: 'KGF_HM',
})
  .then(async () => {
    const oddBeds = await mongoose.connection.collection('inventories').find({
      itemName: { $in: ['109-MOB1', '110-STB1'] }
    }).toArray();
    
    console.log(JSON.stringify(oddBeds, null, 2));

    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
