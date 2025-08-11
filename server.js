import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

import connectDB from "./config/db.config.js";
import adminRoutes from "./routes/admin.routes.js";
import parentRoutes from "./routes/parent.routes.js";
import wardenRoutes from "./routes/warden.routes.js";
import studentRoutes from "./routes/student.routes.js";

dotenv.config();
const app = express();

// ----- Basic middleware -----
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ----- DB connection -----
connectDB();

// ----- CORS (NO CREDENTIALS; using Authorization header) -----
const allowedOrigins = [
  // PROD apps
  "https://kgf-hm-admin.nexcorealliance.com",
  "https://kgf-hm-parent.nexcorealliance.com",
  "https://kgf-hm-student.nexcorealliance.com",
  "https://kgf-hm-warden.nexcorealliance.com",
  // DEV
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

const corsOptions = {
  origin(origin, cb) {
    // allow server-to-server / curl (no Origin) and exact allowlist
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error("Not allowed by CORS"));
  },
  credentials: false, // <-- IMPORTANT: we're NOT using cookies cross-site
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-admin-id"],
};

app.use(cors(corsOptions));
// Explicitly handle preflight
app.options("*", cors(corsOptions));

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

// ----- 404 handler (no path) -----
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// ----- Start server -----
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log("🔒 CORS: no credentials; Authorization header allowed");
});
