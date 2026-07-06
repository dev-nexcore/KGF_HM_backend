import mongoose from 'mongoose';
import 'dotenv/config';

mongoose.connect(process.env.DB_URL)
  .then(async () => {
    const bedsCount = await mongoose.connection.collection('inventories').countDocuments({ category: { $in: ['Furniture', 'BEDS', 'Bed'] } });
    const invoicesCount = await mongoose.connection.collection('studentinvoices').countDocuments({});
    console.log(`Beds count: ${bedsCount}`);
    console.log(`Invoices count: ${invoicesCount}`);
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
