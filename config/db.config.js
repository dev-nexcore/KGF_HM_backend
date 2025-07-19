import mongoose from "mongoose";
import dotenv from 'dotenv';
dotenv.config();

const DB_URL = process.env.DB_URL; // Use the updated DB URI from .env

const connectDB = async () => {
  try {
    // Connect to MongoDB using the URI from .env
    await mongoose.connect(DB_URL, {
      useNewUrlParser: true,  // Use new URL parser
      useUnifiedTopology: true, // Use unified topology to handle MongoDB cluster connections
      dbName: 'KGF_HM', // Use the AMD database
    });

    console.log('✅ MongoDB connected successfully'); // Successful connection message
  } catch (error) {
    console.error('❌ MongoDB connection error:', error); // Error message if connection fails
    process.exit(1); // Exit the process if connection fails
  }
};

export default connectDB;
