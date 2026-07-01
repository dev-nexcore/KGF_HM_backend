// routes/staff.routes.js

import express from "express";

import {
  registerStaff,
  getAllStaff,
  updateStaff,
  deleteStaff,
} from "../controllers/staff.controller.js";

import { verifyWardenToken } from "../middleware/auth.middleware.js";
import { uploadStaffDocuments } from "../middleware/upload.js";

const router = express.Router();

// Register
router.post(
  "/register-staff",
  uploadStaffDocuments,
  registerStaff
);

// Get All
router.get(
  "/all",
  getAllStaff
);

// Update
router.put(
  "/update/:id",
  uploadStaffDocuments,
  updateStaff
);

// Delete
router.delete(
  "/delete/:id",
  deleteStaff
);

export default router;