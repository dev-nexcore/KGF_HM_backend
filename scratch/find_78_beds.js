import mongoose from 'mongoose';
import 'dotenv/config';

mongoose.connect(process.env.DB_URL, {
  dbName: 'KGF_HM',
})
  .then(async () => {
    // Find everything that might be a bed
    const allInventory = await mongoose.connection.collection('inventories').find().toArray();
    
    const possibleBeds = allInventory.filter(i => {
       const cat = (i.category || '').toLowerCase();
       const name = (i.itemName || '').toLowerCase();
       return cat.includes('bed') || name.includes('bed') || name.match(/b\d+/);
    });
    
    console.log(`Possible beds total: ${possibleBeds.length}`);
    
    const residential = possibleBeds.filter(b => b.floor !== '3' && b.floor !== '03' && b.floor !== '3rd' && b.floor !== 'Floor 3' && b.floor !== 'Third');
    
    console.log(`Residential possible beds: ${residential.length}`);
    
    // Group them by barcode prefix
    const crCount = residential.filter(b => (b.barcodeId || '').match(/^CR/i)).length;
    console.log(`Residential CR beds: ${crCount}`);
    
    // Check if any beds have barcode null or missing
    const missingBarcode = residential.filter(b => !b.barcodeId).length;
    console.log(`Residential beds missing barcode: ${missingBarcode}`);

    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
