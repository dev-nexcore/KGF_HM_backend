import { Admin } from "../../models/admin.model.js";

// @desc    Get admin profile
// @route   GET /api/adminauth/profile
// @access  Private (Admin)
export const getAdminProfile = async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin._id).select("-password -refreshToken");
    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }
    res.json(admin);
  } catch (error) {
    console.error("Get admin profile error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Update admin profile
// @route   PUT /api/adminauth/profile
// @access  Private (Admin)
export const updateAdminProfile = async (req, res) => {
  try {
    const { firstName, lastName, email, contactNumber, role, removeProfileImage } = req.body;
    
    const admin = await Admin.findById(req.admin._id);
    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    if (firstName) admin.firstName = firstName;
    if (lastName) admin.lastName = lastName;
    if (email) admin.email = email;
    if (contactNumber) admin.contactNumber = contactNumber;
    if (role) admin.role = role;

    if (removeProfileImage === "true") {
      admin.profileImage = "";
    }

    // Handle profile image upload
    if (req.file) {
      // The file is saved in uploads/admin-profiles/
      // Store the relative path in the database
      admin.profileImage = `/uploads/admin-profiles/${req.file.filename}`;
    }

    const updatedAdmin = await admin.save();
    
    // Don't send back sensitive info
    const adminResponse = updatedAdmin.toObject();
    delete adminResponse.password;
    delete adminResponse.refreshToken;

    res.json({
      message: "Profile updated successfully",
      admin: adminResponse
    });
  } catch (error) {
    console.error("Update admin profile error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
