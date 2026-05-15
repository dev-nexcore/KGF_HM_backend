import 'dotenv/config';
import { Requisition } from "../../models/requisition.model.js";
import { Warden } from "../../models/warden.model.js";
import { Student } from "../../models/student.model.js";
import { Parent } from "../../models/parent.model.js";
import { Staff } from "../../models/staff.model.js";
import { Admin } from "../../models/admin.model.js";
import { Notice } from "../../models/notice.model.js";
import mongoose from 'mongoose';
import sendEmail from '../../utils/sendEmail.js';
import { sendBulkNotifications } from '../../utils/sendNotification.js';

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
    const adminId = req.admin?._id;

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
      if (requisitionType === 'student' || requisitionType === 'worker') {
        existingEntity = await Student.findOne({ email: data.email });
      } else if (requisitionType === 'parent') {
        existingEntity = await Parent.findOne({ email: data.email });
      } else if (requisitionType === 'staff') {
        existingEntity = await Staff.findOne({ email: data.email });
      }
      
      if (existingEntity) {
        return res.status(409).json({
          success: false,
          message: `${requisitionType.charAt(0).toUpperCase() + requisitionType.slice(1)} with this email already exists`,
        });
      }
      
      let createdEntity;
      let entityId;
      let password;
      
      if (requisitionType === 'student' || requisitionType === 'worker') {
        const isWorking = requisitionType === 'worker';
        const prefix = isWorking ? "STUW" : "STU";
        
        // Generate ID
        const idRegex = new RegExp(`^${prefix}`);
        const lastStudent = await Student.findOne({ studentId: idRegex }).sort({ studentId: -1 }).select("studentId");
        let nextId = `${prefix}001`;
        if (lastStudent && lastStudent.studentId) {
          const match = lastStudent.studentId.match(/\d+/);
          if (match) {
            const lastNumber = parseInt(match[0]);
            nextId = `${prefix}${String(lastNumber + 1).padStart(3, "0")}`;
          }
        }
        
        password = `${data.firstName.toLowerCase().replace(/\s+/g, '')}${nextId}`;
        
        const studentData = {
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          contactNumber: data.contactNumber,
          admissionDate: data.admissionDate || new Date(),
          feeStatus: data.feeStatus || "Unpaid",
          roomType: data.roomType || "",
          emergencyContactName: data.emergencyContactName || "",
          emergencyContactNumber: data.emergencyContact || data.emergencyContactNumber || "",
          studentId: nextId,
          password,
          documents,
          isWorking,
          hasCollegeId: data.hasCollegeId === true || data.hasCollegeId === 'true'
        };

        // Only add roomBedNumber if it's a valid ObjectId
        if (data.roomBedNumber && mongoose.Types.ObjectId.isValid(data.roomBedNumber)) {
          studentData.roomBedNumber = data.roomBedNumber;
        }

        try {
          createdEntity = new Student(studentData);
          await createdEntity.save();
          entityId = nextId;
        } catch (saveError) {
          console.error("Error saving student:", saveError);
          return res.status(400).json({
            success: false,
            message: `Registration failed: ${saveError.message}`,
            error: saveError.message
          });
        }
        
      } else if (requisitionType === 'staff') {
        const prefix = "STF";
        const idRegex = new RegExp(`^${prefix}`);
        const lastStaff = await Staff.findOne({ staffId: idRegex }).sort({ staffId: -1 }).select("staffId");
        let nextId = `${prefix}001`;
        if (lastStaff && lastStaff.staffId) {
          const match = lastStaff.staffId.match(/\d+/);
          if (match) {
            const lastNumber = parseInt(match[0]);
            nextId = `${prefix}${String(lastNumber + 1).padStart(3, "0")}`;
          }
        }

        password = `${data.firstName.toLowerCase().replace(/\s+/g, '')}${nextId}`;

        createdEntity = new Staff({
          ...data,
          staffId: nextId,
          password
        });
        await createdEntity.save();
        entityId = nextId;

      } else if (requisitionType === 'parent') {
        const student = await Student.findOne({ studentId: data.studentId });
        if (!student) {
          return res.status(404).json({ success: false, message: "Student associated with this parent not found" });
        }
        
        password = `${data.firstName.toLowerCase().replace(/\s+/g, '')}${data.studentId}`;
        
        createdEntity = new Parent({
          ...data,
          password,
          documents
        });
        await createdEntity.save();
        entityId = data.studentId; 
        
      } else if (requisitionType === 'notice') {
        // ---------------- DATE PARSING ----------------
        let parsedIssueDate;
        const issueDateRaw = data.issueDate;

        if (!isNaN(Date.parse(issueDateRaw))) {
          parsedIssueDate = new Date(issueDateRaw);
        } else if (typeof issueDateRaw === "string" && issueDateRaw.includes("-")) {
          const [dd, mm, yyyy] = issueDateRaw.split("-");
          parsedIssueDate = new Date(`${yyyy}-${mm}-${dd}`);
        }

        // Final safety check
        if (!parsedIssueDate || isNaN(parsedIssueDate)) {
          parsedIssueDate = new Date(); // Fallback to current date
        }

        // Create the actual Notice
        const notice = new Notice({
          ...data,
          issueDate: parsedIssueDate,
          createdBy: adminId
        });
        await notice.save();
        
        // Notification Logic
        const { title, message, recipientType, individualRecipient } = data;
        let recipients = [];
        let studentRecipients = [];

        if (recipientType === "All") {
          const students = await Student.find({}, "_id email");
          const parents = await Parent.find({}, "email");
          const wardens = await Warden.find({}, "email");
          studentRecipients = students;
          recipients = [
            ...students.map(s => s.email),
            ...parents.map(p => p.email),
            ...wardens.map(w => w.email)
          ].filter(Boolean);

        } else if (recipientType === "Student") {
          if (!individualRecipient) {
            const students = await Student.find({}, "_id email");
            studentRecipients = students;
            recipients = students.map(s => s.email).filter(Boolean);
          } else {
            const student = await Student.findOne({ studentId: individualRecipient }, "_id email");
            if (student?.email) recipients.push(student.email);
            if (student) studentRecipients.push(student);
          }
        } else if (recipientType === "Parent") {
          if (!individualRecipient) {
            const parents = await Parent.find({}, "email");
            recipients = parents.map(p => p.email).filter(Boolean);
          } else {
            const parent = await Parent.findOne({ studentId: individualRecipient });
            if (parent?.email) recipients.push(parent.email);
          }
        } else if (recipientType === "Warden") {
          if (!individualRecipient) {
            const wardens = await Warden.find({}, "email");
            recipients = wardens.map(w => w.email).filter(Boolean);
          } else {
            const warden = await Warden.findOne({ wardenId: individualRecipient });
            if (warden?.email) recipients.push(warden.email);
          }
        }

        // Send Emails (Wrapped in try-catch to avoid 500 if one fails)
        try {
          await Promise.all(
            recipients.map(email =>
              sendEmail({
                to: email,
                subject: `Notice: ${title}`,
                text: message,
                fromName: "Hostel Management"
              })
            )
          );
        } catch (emailError) {
          console.error("Failed to send some emails for notice:", emailError);
        }

        // Send Push Notifications
        if (studentRecipients.length > 0) {
          try {
            await sendBulkNotifications(
              studentRecipients,
              `New notice: ${title}`,
              "notice",
              "/notices"
            );
          } catch (notificationError) {
            console.error("Failed to send push notifications:", notificationError);
          }
        }

        // Update requisition status and return early for notice as it doesn't need the general email sending below
        requisition.status = 'approved';
        requisition.approvedBy = adminId;
        requisition.approvedByName = `${admin.firstName || ''} ${admin.lastName || ''}`.trim() || admin.email;
        requisition.approvedAt = new Date();
        if (notes) requisition.notes = notes;
        await requisition.save();

        return res.status(200).json({
          success: true,
          message: "Notice approved and issued successfully"
        });
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
          subject: `${requisitionType.charAt(0).toUpperCase() + requisitionType.slice(1)} Registration Approved`,
          text: `Hello ${data.firstName} ${data.lastName},\n\nYour registration request has been approved by the Admin.\n\nYour login credentials:\nID: ${entityId}\nPassword: ${password}\n\nPlease change your password after first login.\n\n– Hostel Management System`,
          fromName: "Hostel Management"
        });
      } catch (emailError) {
        console.error("Error sending credentials email:", emailError);
      }
      
      return res.status(200).json({
        success: true,
        message: `${requisitionType.charAt(0).toUpperCase() + requisitionType.slice(1)} approved and registered successfully`,
        entityId,
        password
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
