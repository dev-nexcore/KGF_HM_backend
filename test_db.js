import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

mongoose.connect(process.env.DB_URL).then(async () => {
  const db = mongoose.connection.db;
  const invoices = await db.collection('studentinvoices').find({}).sort({ createdAt: -1 }).limit(10).toArray();
  console.log(JSON.stringify(invoices, null, 2));
  process.exit(0);
});
