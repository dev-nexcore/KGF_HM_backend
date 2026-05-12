import connectDB from './config/db.config.js';
import { Inventory } from './models/inventory.model.js';
import dotenv from 'dotenv';
dotenv.config();

const check = async () => {
    await connectDB();
    const res = await Inventory.aggregate([
        { $match: { publicSlug: { $ne: null } } },
        { $project: { slugLen: { $strLenCP: '$publicSlug' } } },
        { $group: { _id: '$slugLen', count: { $sum: 1 } } }
    ]);
    console.log('Slug lengths:', JSON.stringify(res, null, 2));
    process.exit();
};

check();
