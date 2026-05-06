// models/staff.model.js

import mongoose from "mongoose";
import bcrypt from "bcrypt";

const staffSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
    },

    lastName: {
      type: String,
      required: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
    },

    password: {
      type: String,
      required: true,
    },

    staffId: {
      type: String,
      required: true,
      unique: true,
    },

    contactNumber: {
      type: String,
      required: true,
    },

    designation: {
      type: String,
      required: true,
    },

    shiftStart: {
      type: String,
      required: true,
    },

    shiftEnd: {
      type: String,
      required: true,
    },

    profilePhoto: {
      type: String,
      default: null,
    },

    attendanceLog: [
      {
        date: {
          type: Date,
        },

        punchIn: {
          type: Date,
        },

        punchOut: {
          type: Date,
        },

        totalHours: {
          type: Number,
        },
      },
    ],

    resetPasswordToken: {
      type: String,
      default: null,
    },

    resetPasswordExpires: {
      type: Date,
      default: null,
    },

    otpCode: String,

    otpExpires: Date,
  },
  {
    timestamps: true,
  }
);

// Password Hash
staffSchema.pre(
  "save",
  async function (next) {

    if (
      !this.isModified(
        "password"
      )
    ) {
      return next();
    }

    this.password =
      await bcrypt.hash(
        this.password,
        10
      );

    next();
  }
);

// Compare Password
staffSchema.methods.comparePassword =
  async function (
    enteredPassword
  ) {

    return await bcrypt.compare(
      enteredPassword,
      this.password
    );
  };

export const Staff =
  mongoose.model(
    "Staff",
    staffSchema
  );