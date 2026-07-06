import mongoose from 'mongoose';
import 'dotenv/config';

mongoose.connect(process.env.DB_URL, {
  dbName: 'KGF_HM',
})
  .then(async () => {
    const beds = await mongoose.connection.collection('inventories').find({
      itemName: { $regex: /Bed|B\d+/i }
    }).toArray();
    
    const categories = new Set();
    beds.forEach(b => {
        if (!b.itemName.includes('STB') && !b.itemName.includes('MOB')) {
             categories.add(b.category);
        }
    });
    
    console.log("Categories of true beds:", Array.from(categories));

    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
