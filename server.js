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
const app =express()
app.use(express.json())
connectDB()
app.use(cors())

app.get('/', (req, res) => {
  res.send('🚀 Server is running and MongoDB is connected!');
});


app.use('/api/adminauth', adminRoutes);
app.use('/api/parentauth',parentRoutes)
app.use("/api/wardenauth", wardenRoutes);
app.use('/api/studentauth', studentRoutes);


import path from "path";
import { fileURLToPath } from "url";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve uploads folder statically
app.use("/uploads", express.static(path.join(__dirname, "uploads")));



const PORT = process.env.PORT || 5001
app.listen(PORT, ()=>{
    console.log(`Server Listening on ${PORT}`)
})