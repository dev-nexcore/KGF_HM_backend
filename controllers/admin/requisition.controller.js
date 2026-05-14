import 'dotenv/config';
import { Requisition } from "../../models/requisition.model.js";
import { Warden } from "../../models/warden.model.js";
import { Student } from "../../models/student.model.js";
import { Parent } from "../../models/parent.model.js";
import { Staff } from "../../models/staff.model.js";
import { Admin } from "../../models/admin.model.js";
import mongoose from 'mongoose';
import sendEmail from '../../utils/sendEmail.js';

// Get all requisitions with optional filters
export const getAllRequisitions = async (req, res) => {
  try {
    const { status, type, search } = req.query;
    
    const filter = {};
    
    if (status) {
      filter.status = status;
    }
    
    if (type) {
      filter.requisitionType = type;
    }
    
    if (search) {
      filter.$or = [
        { requestedByName: { $regex: search, $options: 'i' } },
        { _id: mongoose.Types.ObjectId.isValid(search) ? search : null }
      ];
    }
    
    const requisitions = await Requisition.find(filter)
      .populate('requestedBy', 'wardenId firstName lastName email')
      .sort({ createdAt: -1 })
      .lean();
    
    return res.status(200).json({
      success: true,
      requisitions,
    });
  } catch (error) {
    console.error("Error fetching requisitions:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch requisitions",
      error: error.message,
    });
  }
};

// Get single requisition details
export const getRequisitionById = async (req, res) => {
  try {
    const { id } = req.params;
    const requisition = await Requisition.findById(id)
      .populate('requestedBy', 'wardenId firstName lastName email contactNumber')
      .lean();

    if (!requisition) {
      return res.status(404).json({
        success: false,
        message: "Requisition not found"
      });
    }

    res.status(200).json({
      success: true,
      requisition
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching requisition details",
      error: error.message
    });
  }
};

// Update requisition status (Approve/Reject)
export const updateRequisitionStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, rejectionReason, notes } = req.body;
    const adminId = req.admin?.id;

    if (!adminId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Admin authentication required",
      });
    }

    const admin = await Admin.findById(adminId);
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin not found",
      });
    }

    const requisition = await Requisition.findById(id);
    if (!requisition) {
      return res.status(404).json({
        success: false,
        message: "Requisition not found",
      });
    }

    if (requisition.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: "Invalid status transition. Only pending requisitions can be updated.",
      });
    }

    // Handle approval
    if (status === 'approved') {
      const { requisitionType, data, documents } = requisition;
      
      // Check for duplicate email
      let existingEntity;
      if (requisitionType === 'student') {
        existingEntity = await Student.findOne({ email: data.email });
      } else if (requisitionType === 'parent') {
        existingEntity = await Parent.findOne({ email: data.email });
      } else if (requisitionType === 'worker' || requisitionType === 'staff') {
        existingEntity = await Staff.findOne({ email: data.email });
      }
      
      if (existingEntity) {
        return res.status(409).json({
          success: false,
          message: "Email already registered",
        });
      }
      
      // Create entity based on type
      let createdEntity;
      let entityId;
      let randomPassword = Math.random().toString(36).slice(-8);
      
      if (requisitionType === 'student') {
        // Auto-generate Student ID
        const lastStudent = await Student.findOne().sort({ studentId: -1 }).select("studentId");
        let newStudentId = "STU001";
        if (lastStudent && lastStudent.studentId) {
          const lastIdNumber = parseInt(lastStudent.studentId.replace("STU", ""));
          const nextIdNumber = lastIdNumber + 1;
          newStudentId = `STU${String(nextIdNumber).padStart(3, "0")}`;
        }
        
        createdEntity = new Student({
          ...data,
          studentId: newStudentId,
          password: randomPassword,
          documents,
        });
        await createdEntity.save();
        entityId = newStudentId;
        
      } else if (requisitionType === 'parent') {
        // Auto-generate Parent ID
        const lastParent = await Parent.findOne().sort({ parentId: -1 }).select("parentId");
        let newParentId = "PAR001";
        if (lastParent && lastParent.parentId) {
          const lastIdNumber = parseInt(lastParent.parentId.replace("PAR", ""));
          const nextIdNumber = lastIdNumber + 1;
          newParentId = `PAR${String(nextIdNumber).padStart(3, "0")}`;
        }
        
        createdEntity = new Parent({
          ...data,
          parentId: newParentId,
          password: randomPassword,
          documents,
        });
        await createdEntity.save();
        entityId = newParentId;
        
      } else if (requisitionType === 'worker' || requisitionType === 'staff') {
        // Auto-generate Staff ID
        const lastStaff = await Staff.findOne().sort({ staffId: -1 }).select("staffId");
        let newStaffId = "STF001";
        if (lastStaff && lastStaff.staffId) {
          const lastIdNumber = parseInt(lastStaff.staffId.replace("STF", ""));
          const nextIdNumber = lastIdNumber + 1;
          newStaffId = `STF${String(nextIdNumber).padStart(3, "0")}`;
        }
        
        createdEntity = new Staff({
          ...data,
          staffId: newStaffId,
          password: randomPassword,
          documents,
          role: requisitionType === 'worker' ? 'worker' : 'staff',
        });
        await createdEntity.save();
        entityId = newStaffId;
      }
      
      // Update requisition status
      requisition.status = 'approved';
      requisition.approvedBy = adminId;
      requisition.approvedByName = `${admin.firstName || ''} ${admin.lastName || ''}`.trim() || admin.email;
      requisition.approvedAt = new Date();
      if (notes) requisition.notes = notes;
      await requisition.save();
      
      // Send credentials email
      try {
        await sendEmail({
          to: data.email,
          subject: `${requisitionType.charAt(0).toUpperCase() + requisitionType.slice(1)} Registration - Login Credentials`,
          text: `Hello ${data.firstName} ${data.lastName},\n\nYou have been registered in the Hostel Management System.\n\nYour login credentials:\nID: ${entityId}\nPassword: ${randomPassword}\n\nPlease change your password after first login.\n\n– Hostel Management System`,
          fromName: "Hostel Management"
        });
      } catch (emailError) {
        console.error("Error sending credentials email:", emailError);
        // Continue even if email fails
      }
      
      return res.status(200).json({
        success: true,
        message: `${requisitionType.charAt(0).toUpperCase() + requisitionType.slice(1)} registered successfully`,
        entityId,
      });
    }

    // Handle rejection
    if (status === 'rejected') {
      if (!rejectionReason || rejectionReason.trim() === '') {
        return res.status(400).json({
          success: false,
          message: "Rejection reason is required",
        });
      }
      
      requisition.status = 'rejected';
      requisition.rejectedBy = adminId;
      requisition.rejectedByName = `${admin.firstName || ''} ${admin.lastName || ''}`.trim() || admin.email;
      requisition.rejectedAt = new Date();
      requisition.rejectionReason = rejectionReason;
      if (notes) requisition.notes = notes;
      await requisition.save();
      
      return res.status(200).json({
        success: true,
        message: "Requisition rejected successfully",
      });
    }

    return res.status(400).json({
      success: false,
      message: "Invalid status value",
    });

  } catch (error) {
    console.error("Error updating requisition status:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update requisition status",
      error: error.message,
    });
  }
};

// Get requisition statistics
export const getRequisitionStats = async (req, res) => {
  try {
    const total = await Requisition.countDocuments();
    const pending = await Requisition.countDocuments({ status: 'pending' });
    const approved = await Requisition.countDocuments({ status: 'approved' });
    const rejected = await Requisition.countDocuments({ status: 'rejected' });
    
    return res.status(200).json({
      success: true,
      stats: {
        total,
        pending,
        approved,
        rejected,
      },
    });
  } catch (error) {
    console.error("Error fetching requisition stats:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch requisition statistics",
      error: error.message,
    });
  }
};
