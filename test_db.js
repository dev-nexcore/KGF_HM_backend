import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const beds = await mongoose.connection.db.collection('inventories').find({ barcodeId: '102-B1' }).toArray();
  console.log(beds);
  process.exit(0);
});
