import mongoose from 'mongoose';
import 'dotenv/config';

mongoose.connect(process.env.DB_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  dbName: 'KGF_HM',
})
  .then(async () => {
    const bedsWithoutLocationCategory = await mongoose.connection.collection('inventories').countDocuments({
      category: 'BEDS',
      locationCategory: { $exists: false }
    });
    
    const bedsWithLocationCategory = await mongoose.connection.collection('inventories').countDocuments({
      category: 'BEDS',
      locationCategory: 'Residential Room'
    });
    
    console.log(`Beds without locationCategory: ${bedsWithoutLocationCategory}`);
    console.log(`Beds with locationCategory='Residential Room': ${bedsWithLocationCategory}`);
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
