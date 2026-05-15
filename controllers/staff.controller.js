// controllers/staff.controller.js

import { Staff } from "../models/staff.model.js";
import { Requisition } from "../models/requisition.model.js";
import { Warden } from "../models/warden.model.js";
import sendEmail from '../utils/sendEmail.js';

// Register Staff
export const registerStaff =
  async (req, res) => {

    const {
      firstName,
      lastName,
      email,
      contactNumber,
      designation,
      shiftStart,
      shiftEnd,
      salary,
    } = req.body;

    try {
      // Check Existing Staff
      const existingStaff = await Staff.findOne({ email });
      if (existingStaff) {
        return res.status(409).json({ success: false, message: "Staff already exists with this email." });
      }

      // Check Existing Requisition
      const existingReq = await Requisition.findOne({ "data.email": email, status: "pending" });
      if (existingReq) {
        return res.status(409).json({ success: false, message: "A registration request for this email is already pending approval." });
      }

      // Get Warden info
      const warden = await Warden.findById(req.user.id);
      if (!warden) {
        return res.status(404).json({ success: false, message: "Warden not found" });
      }

      const newRequisition = new Requisition({
        requisitionType: "staff",
        requestedBy: req.user.id,
        requestedByName: `${warden.firstName} ${warden.lastName}`,
        data: {
          firstName,
          lastName,
          email,
          contactNumber,
          designation,
          shiftStart,
          shiftEnd,
          salary
        }
      });

      await newRequisition.save();

      return res.json({
        success: true,
        message: "Staff registration request submitted for Admin approval.",
      });

    } catch (error) {
      console.error("Error submitting staff requisition:", error);
      return res.status(500).json({
        success: false,
        message: "Error submitting staff registration request.",
      });
    }
  };

// Get All Staff
export const getAllStaff =
  async (req, res) => {

    try {

      const staffs =
        await Staff.find().sort({
          createdAt: -1,
        });

      return res.json({
        success: true,
        staffs,
      });

    } catch (error) {

      console.error(error);

      return res
        .status(500)
        .json({
          success: false,
          message:
            "Error fetching staffs",
        });
    }
  };

// Update Staff
export const updateStaff =
  async (req, res) => {

    try {

      const updatedStaff =
        await Staff.findByIdAndUpdate(
          req.params.id,
          req.body,
          {
            new: true,
          }
        );

      return res.json({
        success: true,
        updatedStaff,
      });

    } catch (error) {

      console.error(error);

      return res
        .status(500)
        .json({
          success: false,
          message:
            "Error updating staff",
        });
    }
  };

// Delete Staff
export const deleteStaff =
  async (req, res) => {

    try {

      await Staff.findByIdAndDelete(
        req.params.id
      );

      return res.json({
        success: true,
        message:
          "Staff deleted successfully",
      });

    } catch (error) {

      console.error(error);

      return res
        .status(500)
        .json({
          success: false,
          message:
            "Error deleting staff",
        });
    }
  };