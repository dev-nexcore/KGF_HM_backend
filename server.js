import express from "express";
import dotenv from "dotenv";
import cors from "cors";

import connectDB from "./config/db.config.js";
import adminRoutes from "./routes/admin.routes.js";
import parentRoutes from "./routes/parent.routes.js";
import wardenRoutes from "./routes/warden.routes.js";
import studentRoutes from "./routes/student.routes.js";
import webhookRoutes from "./routes/webhook.routes.js";

import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();

// ----- Basic middleware -----
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use('/public', express.static(path.join(process.cwd(), 'public')));

// ----- Serve static folders for QR codes and receipts -----
app.use('/qrcodes', express.static(path.join(process.cwd(), 'public/qrcodes')));
app.use('/public/qrcodes', express.static(path.join(process.cwd(), 'public/qrcodes')));
app.use('/receipts', express.static(path.join(process.cwd(), 'public/receipts')));
app.use('/public/receipts', express.static(path.join(process.cwd(), 'public/receipts')));

// ----- DB connection -----
connectDB();

// ----- CORS -----
  const corsOptions = {
    origin: [
      "https://kgf-hm-admin.nexcorealliance.com",
      "https://kgf-hm-parent.nexcorealliance.com",
      "https://kgf-hm-student.nexcorealliance.com",
      "https://kgf-hm-warden.nexcorealliance.com",
    ],
    credentials: true,
  };
  app.use(cors(corsOptions));


// ----- Health check -----
app.get("/", (req, res) => {
  res.json({
    message: "🚀 Server is running and MongoDB is connected!",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  });
});

// ----- API routes -----
app.use("/api/adminauth", adminRoutes);
app.use("/api/parentauth", parentRoutes);
app.use("/api/wardenauth", wardenRoutes);
app.use("/api/studentauth", studentRoutes);
app.use("/api/webhook", webhookRoutes);

// ----- Static files (uploads) -----
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ----- Error handler (must be before 404) -----
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(500).json({
    error: "Internal Server Error",
    message:
      process.env.NODE_ENV === "development" ? err.message : "Something went wrong",
  });
});

app.use('/qrcodes', express.static(path.join(process.cwd(), 'public/qrcodes')));

// ----- 404 handler (EASIEST FIX: no path here) -----
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// ----- Start server -----
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(
    `🔒 CORS: ${process.env.NODE_ENV === "production" ? "Specific origins" : "All origins allowed"}`
  );
});
