import mongoose from 'mongoose';
import 'dotenv/config';

mongoose.connect(process.env.DB_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  dbName: 'KGF_HM',
})
  .then(async () => {
    const result = await mongoose.connection.collection('inventories').updateMany(
      { locationCategory: { $exists: false } },
      { $set: { locationCategory: 'Residential Room' } }
    );
    
    console.log(`Successfully updated ${result.modifiedCount} inventory items to have locationCategory: 'Residential Room'`);
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
