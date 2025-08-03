import 'dotenv/config';
import nodemailer from 'nodemailer';
import { Complaint } from '../../models/complaint.model.js';
import { createAuditLog, AuditActionTypes } from '../../utils/auditLogger.js';

// configure SMTP transporter
const transporter = nodemailer.createTransporter({
    host:    process.env.MAIL_HOST,      // smtp.gmail.com
  port:   +process.env.MAIL_PORT,      // 587
  secure: process.env.MAIL_SECURE === 'true',
 
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  }
});

const getAllComplaints = async (req, res) => {
  try {
    const { status, type, page = 1, limit = 10, search } = req.query;
    
    // Build query object
    let query = {};
    if (status && status !== 'all') {
      query.status = status;
    }
    if (type && type !== 'all') {
      query.complaintType = type;
    }
    if (search) {
      query.$or = [
        { subject: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    const skip = (page - 1) * limit;

    // Get complaints with student details
    const complaints = await Complaint.find(query)
      .populate('studentId', 'studentName studentId email contactNumber roomBedNumber')
      .select('complaintType subject description status filedDate createdAt updatedAt attachments')
      .sort({ filedDate: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalComplaints = await Complaint.countDocuments(query);

    // Get status counts for the interface
    const statusCounts = await Complaint.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const counts = {
      all: await Complaint.countDocuments(),
      'in progress': 0,
      'resolved': 0
    };

    statusCounts.forEach(item => {
      counts[item._id] = item.count;
    });

    return res.json({ 
      message: "Complaints fetched successfully",
      complaints: complaints.map(complaint => ({
        _id: complaint._id,
        ticketId: `#${String(complaint._id).slice(-4).toUpperCase()}`, // Generate ticket ID from MongoDB _id
        subject: complaint.subject,
        description: complaint.description,
        complaintType: complaint.complaintType,
        status: complaint.status,
        filedDate: complaint.filedDate,
        hasAttachments: complaint.attachments.length > 0,
        attachmentCount: complaint.attachments.length,
        raisedBy: complaint.studentId ? {
          name: complaint.studentId.studentName,
          studentId: complaint.studentId.studentId,
          email: complaint.studentId.email,
          roomBedNumber: complaint.studentId.roomBedNumber
        } : null
      })),
      counts,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalComplaints / limit),
        totalComplaints,
        hasNextPage: page * limit < totalComplaints,
        hasPreviousPage: page > 1
      }
    });
  } catch (err) {
    console.error("Fetch complaints error:", err);
    return res.status(500).json({ message: "Server error while fetching complaints." });
  }
};

// Get open/pending complaints
const getOpenComplaints = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const openComplaints = await Complaint.find({ status: 'in progress' })
      .populate('studentId', 'studentName studentId email contactNumber')
      .select('complaintType subject description status filedDate attachments')
      .sort({ filedDate: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalOpen = await Complaint.countDocuments({ status: 'in progress' });

    return res.json({ 
      message: "Open complaints fetched successfully",
      complaints: openComplaints.map(complaint => ({
        _id: complaint._id,
        ticketId: `#${String(complaint._id).slice(-4).toUpperCase()}`,
        subject: complaint.subject,
        description: complaint.description,
        complaintType: complaint.complaintType,
        status: complaint.status,
        filedDate: complaint.filedDate,
        hasAttachments: complaint.attachments.length > 0,
        attachmentCount: complaint.attachments.length,
        raisedBy: complaint.studentId ? {
          name: complaint.studentId.studentName,
          studentId: complaint.studentId.studentId,
          email: complaint.studentId.email
        } : null
      })),
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalOpen / limit),
        totalComplaints: totalOpen,
        hasNextPage: page * limit < totalOpen,
        hasPreviousPage: page > 1
      }
    });
  } catch (err) {
    console.error("Fetch open complaints error:", err);
    return res.status(500).json({ message: "Server error while fetching open complaints." });
  }
};

// Get resolved complaints
const getResolvedComplaints = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const resolvedComplaints = await Complaint.find({ status: 'resolved' })
      .populate('studentId', 'studentName studentId email contactNumber')
      .select('complaintType subject description status filedDate updatedAt attachments')
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalResolved = await Complaint.countDocuments({ status: 'resolved' });

    return res.json({ 
      message: "Resolved complaints fetched successfully",
      complaints: resolvedComplaints.map(complaint => ({
        _id: complaint._id,
        ticketId: `#${String(complaint._id).slice(-4).toUpperCase()}`,
        subject: complaint.subject,
        description: complaint.description,
        complaintType: complaint.complaintType,
        status: complaint.status,
        filedDate: complaint.filedDate,
        resolvedDate: complaint.updatedAt,
        hasAttachments: complaint.attachments.length > 0,
        attachmentCount: complaint.attachments.length,
        raisedBy: complaint.studentId ? {
          name: complaint.studentId.studentName,
          studentId: complaint.studentId.studentId,
          email: complaint.studentId.email
        } : null
      })),
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalResolved / limit),
        totalComplaints: totalResolved,
        hasNextPage: page * limit < totalResolved,
        hasPreviousPage: page > 1
      }
    });
  } catch (err) {
    console.error("Fetch resolved complaints error:", err);
    return res.status(500).json({ message: "Server error while fetching resolved complaints." });
  }
};

// Update complaint status (Approve/Resolve or Reject)
const updateComplaintStatus = async (req, res) => {
  const { complaintId } = req.params;
  const { status, adminNotes } = req.body; // status should be 'resolved' or 'in progress'

  try {
    // Validate status
    if (!['resolved', 'in progress'].includes(status)) {
      return res.status(400).json({ message: "Invalid status. Must be 'resolved' or 'in progress'." });
    }

    // Find the complaint
    const complaint = await Complaint.findById(complaintId).populate('studentId', 'studentName studentId email');
    
    if (!complaint) {
      return res.status(404).json({ message: "Complaint not found." });
    }

    // Update complaint status
    complaint.status = status;
    if (adminNotes) {
      complaint.adminNotes = adminNotes; // You might want to add this field to your schema
    }
    
    await complaint.save();

    // Send email notification to student
    const student = complaint.studentId;
    const statusText = status === 'resolved' ? 'RESOLVED' : 'IN PROGRESS';
    const statusEmoji = status === 'resolved' ? '✅' : '🔄';

    const emailSubject = `Complaint ${statusText} - ${complaint.subject}`;
    const emailBody = `Hello ${student.studentName},

${statusEmoji} Your complaint has been marked as ${statusText.toLowerCase()}.

Complaint Details:
• Ticket ID: #${String(complaint._id).slice(-4).toUpperCase()}
• Subject: ${complaint.subject}
• Type: ${complaint.complaintType}
• Status: ${statusText}
• Filed Date: ${new Date(complaint.filedDate).toLocaleDateString("en-IN")}
${complaint.attachments.length > 0 ? `• Attachments: ${complaint.attachments.length} file(s)` : ''}
${adminNotes ? `• Admin Notes: ${adminNotes}` : ''}

${status === 'resolved' ? 
  'Thank you for reporting this issue. We appreciate your feedback.' : 
  'We are working on resolving your complaint. You will be notified once it is resolved.'}

If you have any questions, please contact the hostel administration.

– Hostel Admin`;

    // Send email notification
    try {
      await transporter.sendMail({
        from: `"Hostel Admin" <${process.env.MAIL_USER}>`,
        to: student.email,
        subject: emailSubject,
        text: emailBody
      });
      console.log(`📤 Complaint ${status} notification sent to ${student.email}`);
    } catch (emailErr) {
      console.error("Email sending error:", emailErr);
      // Don't fail the entire operation if email fails
    }

    await createAuditLog({
      adminId: req.admin?._id,
      adminName: req.admin?.adminId || 'System',
      actionType: status === 'resolved' ? AuditActionTypes.COMPLAINT_RESOLVED : AuditActionTypes.COMPLAINT_UPDATED,
      description: `${status === 'resolved' ? 'Resolved' : 'Updated'} complaint: ${complaint.subject} (Student: ${student.studentName})`,
      targetType: 'Complaint',
      targetId: complaintId,
      targetName: `${complaint.subject} - ${student.studentName}`,
      additionalData: {
        complaintType: complaint.complaintType,
        subject: complaint.subject,
        adminNotes,
        hasAttachments: complaint.attachments.length > 0,
        attachmentCount: complaint.attachments.length
      }
    });

    return res.json({ 
      message: `Complaint marked as ${status} successfully`,
      complaint: {
        _id: complaint._id,
        ticketId: `#${String(complaint._id).slice(-4).toUpperCase()}`,
        subject: complaint.subject,
        description: complaint.description,
        complaintType: complaint.complaintType,
        status: complaint.status,
        filedDate: complaint.filedDate,
        updatedAt: new Date(),
        hasAttachments: complaint.attachments.length > 0,
        attachmentCount: complaint.attachments.length,
        student: {
          studentName: student.studentName,
          studentId: student.studentId
        }
      }
    });

  } catch (err) {
    console.error("Update complaint status error:", err);
    return res.status(500).json({ message: "Server error while updating complaint status." });
  }
};

// Get complaint statistics for dashboard
const getComplaintStatistics = async (req, res) => {
  try {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    // Get counts
    const totalOpen = await Complaint.countDocuments({ status: 'in progress' });
    const totalResolved = await Complaint.countDocuments({ status: 'resolved' });
    const thisMonthComplaints = await Complaint.countDocuments({
      filedDate: { $gte: startOfMonth, $lte: endOfMonth }
    });

    // Get complaint type breakdown
    const complaintTypeStats = await Complaint.aggregate([
      {
        $group: {
          _id: '$complaintType',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get complaints with attachments count
    const complaintsWithAttachments = await Complaint.countDocuments({
      'attachments.0': { $exists: true }
    });

    // Get recent complaints (last 5)
    const recentComplaints = await Complaint.find()
      .populate('studentId', 'studentName studentId')
      .select('complaintType subject status filedDate attachments')
      .sort({ filedDate: -1 })
      .limit(5);

    return res.json({
      message: "Complaint statistics fetched successfully",
      statistics: {
        open: totalOpen,
        resolved: totalResolved,
        thisMonth: thisMonthComplaints,
        total: totalOpen + totalResolved,
        withAttachments: complaintsWithAttachments
      },
      complaintTypeBreakdown: complaintTypeStats,
      recentComplaints: recentComplaints.map(complaint => ({
        _id: complaint._id,
        ticketId: `#${String(complaint._id).slice(-4).toUpperCase()}`,
        subject: complaint.subject,
        complaintType: complaint.complaintType,
        status: complaint.status,
        filedDate: complaint.filedDate,
        hasAttachments: complaint.attachments.length > 0,
        attachmentCount: complaint.attachments.length,
        raisedBy: complaint.studentId ? complaint.studentId.studentName : 'Unknown'
      }))
    });

  } catch (err) {
    console.error("Fetch complaint statistics error:", err);
    return res.status(500).json({ message: "Server error while fetching complaint statistics." });
  }
};

// Get specific complaint details with attachments
const getComplaintDetails = async (req, res) => {
  const { complaintId } = req.params;

  try {
    const complaint = await Complaint.findById(complaintId)
      .populate('studentId', 'studentName studentId email contactNumber roomBedNumber');

    if (!complaint) {
      return res.status(404).json({ message: "Complaint not found." });
    }

    return res.json({
      message: "Complaint details fetched successfully",
      complaint: {
        _id: complaint._id,
        ticketId: `#${String(complaint._id).slice(-4).toUpperCase()}`,
        subject: complaint.subject,
        description: complaint.description,
        complaintType: complaint.complaintType,
        status: complaint.status,
        filedDate: complaint.filedDate,
        updatedAt: complaint.updatedAt,
        adminNotes: complaint.adminNotes || '',
        attachments: complaint.attachments.map(attachment => ({
          _id: attachment._id,
          filename: attachment.filename,
          originalName: attachment.originalName,
          mimeType: attachment.mimeType,
          size: attachment.size,
          uploadedAt: attachment.uploadedAt
        })),
        student: complaint.studentId ? {
          name: complaint.studentId.studentName,
          studentId: complaint.studentId.studentId,
          email: complaint.studentId.email,
          contactNumber: complaint.studentId.contactNumber,
          roomBedNumber: complaint.studentId.roomBedNumber
        } : null
      }
    });

  } catch (err) {
    console.error("Fetch complaint details error:", err);
    return res.status(500).json({ message: "Server error while fetching complaint details." });
  }
};

// Get complaint attachment (for downloading/viewing)
const getComplaintAttachment = async (req, res) => {
  const { complaintId, attachmentId } = req.params;

  try {
    const complaint = await Complaint.findById(complaintId);
    if (!complaint) {
      return res.status(404).json({ message: "Complaint not found" });
    }

    const attachment = complaint.attachments.id(attachmentId);
    if (!attachment) {
      return res.status(404).json({ message: "Attachment not found" });
    }

    // Check if file exists
    const fs = await import('fs');
    if (!fs.existsSync(attachment.path)) {
      return res.status(404).json({ message: "File not found on server" });
    }

    // Set appropriate headers
    res.setHeader('Content-Type', attachment.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${attachment.originalName}"`);

    // Stream the file
    const path = await import('path');
    return res.sendFile(path.resolve(attachment.path));

  } catch (err) {
    console.error("Get attachment error:", err);
    return res.status(500).json({ message: "Server error while fetching attachment." });
  }
};

// Bulk update complaint status
const bulkUpdateComplaintStatus = async (req, res) => {
  const { complaintIds, status, adminNotes } = req.body;

  try {
    if (!['resolved', 'in progress'].includes(status)) {
      return res.status(400).json({ message: "Invalid status. Must be 'resolved' or 'in progress'." });
    }

    if (!Array.isArray(complaintIds) || complaintIds.length === 0) {
      return res.status(400).json({ message: "Please provide an array of complaint IDs." });
    }

    // Find all complaints from the provided IDs
    const complaints = await Complaint.find({
      _id: { $in: complaintIds }
    }).populate('studentId', 'studentName studentId email');

    if (complaints.length === 0) {
      return res.status(400).json({ message: "No complaints found to update." });
    }

    // Update all complaints
    const updateResult = await Complaint.updateMany(
      {
        _id: { $in: complaintIds }
      },
      {
        status,
        adminNotes
      }
    );

    // Send emails to all affected students
    const emailPromises = complaints.map(async (complaint) => {
      const student = complaint.studentId;
      const statusText = status === 'resolved' ? 'RESOLVED' : 'IN PROGRESS';
      const statusEmoji = status === 'resolved' ? '✅' : '🔄';

      const emailSubject = `Complaint ${statusText} - ${complaint.subject}`;
      const emailBody = `Hello ${student.studentName},

${statusEmoji} Your complaint has been marked as ${statusText.toLowerCase()}.

Complaint Details:
• Ticket ID: #${String(complaint._id).slice(-4).toUpperCase()}
• Subject: ${complaint.subject}
• Type: ${complaint.complaintType}
• Status: ${statusText}
${complaint.attachments && complaint.attachments.length > 0 ? `• Attachments: ${complaint.attachments.length} file(s)` : ''}
${adminNotes ? `• Admin Notes: ${adminNotes}` : ''}

Filed Date: ${new Date(complaint.filedDate).toLocaleDateString("en-IN")}

${status === 'resolved' ? 
  'Thank you for reporting this issue. We appreciate your feedback.' : 
  'We are working on resolving your complaint. You will be notified once it is resolved.'}

– Hostel Admin`;

      try {
        await transporter.sendMail({
          from: `"Hostel Admin" <${process.env.MAIL_USER}>`,
          to: student.email,
          subject: emailSubject,
          text: emailBody
        });
      } catch (emailErr) {
        console.error(`Email sending error for ${student.email}:`, emailErr);
      }
    });

    await Promise.all(emailPromises);

    // Create audit log for bulk update
    await createAuditLog({
      adminId: req.admin?._id,
      adminName: req.admin?.adminId || 'System',
      actionType: status === 'resolved' ? AuditActionTypes.COMPLAINT_RESOLVED : AuditActionTypes.COMPLAINT_UPDATED,
      description: `Bulk ${status === 'resolved' ? 'resolved' : 'updated'} ${updateResult.modifiedCount} complaints`,
      targetType: 'Complaint',
      targetId: 'bulk_update',
      targetName: `Bulk Update - ${updateResult.modifiedCount} complaints`,
      additionalData: {
        complaintIds,
        status,
        adminNotes,
        affectedCount: updateResult.modifiedCount
      }
    });

    return res.json({ 
      message: `${updateResult.modifiedCount} complaints marked as ${status} successfully`,
      updatedCount: updateResult.modifiedCount,
      emailsSent: complaints.length
    });

  } catch (err) {
    console.error("Bulk update complaint status error:", err);
    return res.status(500).json({ message: "Server error while bulk updating complaint status." });
  }
};

export{
    getAllComplaints,
    getOpenComplaints,
    getResolvedComplaints,
    updateComplaintStatus,
    getComplaintStatistics,
    getComplaintDetails,
    bulkUpdateComplaintStatus,
    getComplaintAttachment
}