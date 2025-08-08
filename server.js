import express from 'express'
import connectDB from './config/db.config.js'
import dotenv from "dotenv"
import cors from 'cors'
import { connect } from 'mongoose'
import adminRoutes from "./routes/admin.routes.js"
import parentRoutes from "./routes/parent.routes.js"
import wardenRoutes from './routes/warden.routes.js';
import studentRoutes from "./routes/student.routes.js"

dotenv.config()
const app = express()

// Connect to database first
connectDB()


const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://kgf-hm-admin.nexcorealliance.com',
      'https://kgf-hm-parent.nexcorealliance.com',
      'https://kgf-hm-student.nexcorealliance.com',
      'https://kgf-hm-warden.nexcorealliance.com'
    ];

    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = `The CORS policy for this site does not allow access from ${origin}`;
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Content-Length', 'X-Foo', 'X-Bar'],
  maxAge: 86400 // 24 hours
};

// Apply CORS before other middleware
app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions));



// Body parsing middleware
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Health check route
app.get('/', (req, res) => {
  res.json({ 
    message: '🚀 Server is running and MongoDB is connected!',
    timestamp: new Date().toISOString(),
    cors: 'enabled'
  });
});

// API routes
app.use('/api/adminauth', adminRoutes);
app.use('/api/parentauth', parentRoutes)
app.use("/api/wardenauth", wardenRoutes);
app.use('/api/studentauth', studentRoutes);

// Static file serving
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve uploads folder statically
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 5001
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`)
    console.log(`📍 Health check: http://localhost:${PORT}`)
    console.log(`🔒 CORS enabled for specified origins`)
})