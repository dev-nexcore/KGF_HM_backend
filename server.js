import express from 'express'
import connectDB from './config/db.config.js'
import dotenv from "dotenv"
import cors from 'cors'
import { connect } from 'mongoose'

dotenv.config()
const app =express()
app.use(express.json())
connectDB()
app.use(cors())



const PORT = process.env.PORT || 5001
app.listen(PORT, ()=>{
    console.log(`Server Listening on ${PORT}`)
})