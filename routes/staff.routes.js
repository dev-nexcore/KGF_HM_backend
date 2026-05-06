// routes/staff.routes.js

import express from "express";

import {
  registerStaff,
  getAllStaff,
  updateStaff,
  deleteStaff,
} from "../controllers/staff.controller.js";

const router = express.Router();

// Register
router.post(
  "/register-staff",
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
  updateStaff
);

// Delete
router.delete(
  "/delete/:id",
  deleteStaff
);

export default router;