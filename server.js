import express from 'express'
import connectDB from './config/db.config.js'
import dotenv from "dotenv"
import cors from 'cors'
import { connect } from 'mongoose'
import adminRoutes from "./routes/admin.routes.js"
import parentRoutes from "./routes/parent.routes.js"
import wardenRoutes from './routes/warden.routes.js';import studentRoutes from "./routes/student.routes.js"


dotenv.config()
const app =express()
app.use(express.json())
connectDB()
app.use(cors())
app.use('/api/adminauth', adminRoutes);
app.use('/api/parentauth',parentRoutes)
app.use("/api/wardenauth", wardenRoutes);
app.use('/api/studentauth', studentRoutes);


const PORT = process.env.PORT || 5001
app.listen(PORT, ()=>{
    console.log(`Server Listening on ${PORT}`)
})