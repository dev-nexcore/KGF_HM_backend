// controllers/staff.controller.js

import { Staff } from "../models/staff.model.js";
// import transporter from "../config/mail.js";
import sendEmail from '../utils/sendEmail.js';

// Register Staff
export const registerStaff =
  async (req, res) => {

    const {
      firstName,
      lastName,
      email,
      staffId,
      contactNumber,
      designation,
      shiftStart,
      shiftEnd,
      salary,
    } = req.body;

    try {

      // Check Existing
      const existingStaff =
        await Staff.findOne({
          email,
        });

      if (existingStaff) {
        return res
          .status(409)
          .json({
            message:
              "Staff already exists with same email.",
          });
      }

      // Generate Password
      const cleanName =
        firstName
          .replace(
            /\s+/g,
            ""
          )
          .toLowerCase();

      const staffPassword =
        `${cleanName}${lastName}`;

      // Create Staff
      const newStaff =
        new Staff({
          firstName,
          lastName,
          email,
          staffId,
          contactNumber,
          designation,
          shiftStart,
          shiftEnd,
          salary,
          password:
            staffPassword,
        });

      await newStaff.save();

      // Send Mail
      await sendEmail({
        from: `"Hostel Admin" <${process.env.MAIL_USER}>`,

        to: email,

        subject:
          "Your Staff Panel Credentials",

        text: `
Hello ${firstName} ${lastName},

Your staff account has been created.

• Staff Name: ${firstName} ${lastName}
• Staff ID: ${staffId}
• Designation: ${designation}
• Shift: ${shiftStart} - ${shiftEnd}
• Password: ${staffPassword}

Please login and change your password.

- Hostel Admin
`,
      });

      return res.json({
        success: true,

        message:
          "Staff registered successfully.",

        staff: {
          firstName,
          lastName,
          email,
          staffId,
          designation,
        },
      });

    } catch (error) {

      console.error(error);

      return res
        .status(500)
        .json({
          success: false,

          message:
            "Error registering staff.",
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