import 'dotenv/config';

import nodemailer from 'nodemailer';
import { Leave } from '../../models/leave.model.js';

import { createAuditLog, AuditActionTypes } from '../../utils/auditLogger.js';
import { sendBulkNotifications, sendNotification } from '../../utils/sendNotification.js';

// configure SMTP transporter
const transporter = nodemailer.createTransport({

  host: process.env.MAIL_HOST,      // smtp.gmail.com
  port: +process.env.MAIL_PORT,      // 587
  secure: process.env.MAIL_SECURE === 'true',

  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  }
});

const getPendingLeaveRequests = async (req, res) => {
  try {
    const pendingLeaves = await Leave.find({ status: 'pending' })
      .populate('studentId', 'studentName studentId email contactNumber roomBedNumber')
      .select('leaveType startDate endDate reason status appliedAt')
      .sort({ appliedAt: -1 });

    return res.json({
      message: "Pending leave requests fetched successfully",
      leaves: pendingLeaves
    });
  } catch (err) {
    console.error("Fetch pending leaves error:", err);
    return res.status(500).json({ message: "Server error while fetching pending leave requests." });
  }
};

// Get all leave requests (pending, approved, rejected)
const getAllLeaveRequests = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;

    // Handle filter mapping from frontend
    let query = {};
    if (status && status !== 'all') {
      query.status = status;
    }

    const skip = (page - 1) * limit;

    const leaves = await Leave.find(query)
      .populate('studentId', 'studentName studentId email contactNumber roomBedNumber')
      .select('leaveType startDate endDate reason status appliedAt processedAt adminComments')
      .sort({ appliedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalLeaves = await Leave.countDocuments(query);

    // Add summary counts for the filter tabs
    const statusCounts = await Leave.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const counts = {
      all: totalLeaves,
      pending: 0,
      approved: 0,
      rejected: 0
    };

    statusCounts.forEach(item => {
      counts[item._id] = item.count;
    });

    return res.json({
      message: "Leave requests fetched successfully",
      leaves,
      counts, // For the filter tab badges
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalLeaves / limit),
        totalLeaves,
        hasNextPage: page * limit < totalLeaves,
        hasPreviousPage: page > 1
      }
    });
  } catch (err) {
    console.error("Fetch all leaves error:", err);
    return res.status(500).json({ message: "Server error while fetching leave requests." });
  }
};

// Approve or reject a leave request
const updateLeaveStatus = async (req, res) => {
  const { leaveId } = req.params;
  const { status, adminComments } = req.body; // status should be 'approved' or 'rejected'

  try {
    // Validate status
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: "Invalid status. Must be 'approved' or 'rejected'." });
    }

    // Find the leave request
    const leave = await Leave.findById(leaveId).populate('studentId', 'studentName studentId email');

    if (!leave) {
      return res.status(404).json({ message: "Leave request not found." });
    }

    if (leave.status !== 'pending') {
      return res.status(400).json({ message: "Leave request has already been processed." });
    }

    // Update leave status
    leave.status = status;
    if (adminComments) {
      leave.adminComments = adminComments;
    }
    leave.processedAt = new Date();

    await leave.save();

    // Send email notification to student
    const student = leave.studentId;
    const statusText = status === 'approved' ? 'APPROVED' : 'REJECTED';
    const statusEmoji = status === 'approved' ? '✅' : '❌';

    const emailSubject = `Leave Request ${statusText} - ${leave.leaveType}`;
    const emailBody = `Hello ${student.studentName},

${statusEmoji} Your leave request has been ${statusText.toLowerCase()}.

Leave Details:
• Type: ${leave.leaveType}
• From: ${new Date(leave.startDate).toLocaleDateString("en-IN")}
• To: ${new Date(leave.endDate).toLocaleDateString("en-IN")}
• Reason: ${leave.reason}
• Status: ${statusText}
${adminComments ? `• Admin Comments: ${adminComments}` : ''}

Applied on: ${new Date(leave.appliedAt).toLocaleDateString("en-IN")}
Processed on: ${new Date().toLocaleDateString("en-IN")}

${status === 'approved' ?
        'Please ensure you follow all hostel guidelines during your leave period.' :
        'If you have any questions regarding this decision, please contact the hostel administration.'}

– Hostel Admin`;

    // Send email notification
    try {
      await transporter.sendMail({
        from: `"Hostel Admin" <${process.env.MAIL_USER}>`,
        to: student.email,
        subject: emailSubject,
        text: emailBody
      });
      console.log(`📤 Leave ${status} notification sent to ${student.email}`);
    } catch (emailErr) {
      console.error("Email sending error:", emailErr);
      // Don't fail the entire operation if email fails
    }

    await createAuditLog({
      adminId: req.admin?._id,
      adminName: req.admin?.adminId || 'System',
      actionType: status === 'approved' ? AuditActionTypes.LEAVE_APPROVED : AuditActionTypes.LEAVE_REJECTED,
      description: `${status === 'approved' ? 'Approved' : 'Rejected'} leave request for ${student.studentName} (${leave.leaveType})`,
      targetType: 'Leave',
      targetId: leaveId,
      targetName: `${student.studentName} - ${leave.leaveType}`,
      additionalData: {
        leaveType: leave.leaveType,
        startDate: leave.startDate,
        endDate: leave.endDate,
        adminComments
      }
    });

    // Send in-app notification
    try {
      await sendNotification({
        studentId: student._id,
        message: `Your leave request has been ${status.toUpperCase()}`,
        type: 'leave',
        link: '/leave-history',
      });
    } catch (notifErr) {
      console.error("Failed to send leave notification:", notifErr);
    }

    return res.json({
      message: `Leave request ${status} successfully`,
      leave: {
        _id: leave._id,
        leaveType: leave.leaveType,
        startDate: leave.startDate,
        endDate: leave.endDate,
        reason: leave.reason,
        status: leave.status,
        adminComments: leave.adminComments,
        processedAt: leave.processedAt,
        student: {
          studentName: student.studentName,
          studentId: student.studentId || student._id
        }
      }
    });

  } catch (err) {
    console.error("Update leave status error:", err);
    return res.status(500).json({ message: "Server error while updating leave status." });
  }
};

// Get leave statistics for dashboard
const getLeaveStatistics = async (req, res) => {
  try {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    // Get counts
    const totalPending = await Leave.countDocuments({ status: 'pending' });
    const totalApproved = await Leave.countDocuments({ status: 'approved' });
    const totalRejected = await Leave.countDocuments({ status: 'rejected' });
    const thisMonthLeaves = await Leave.countDocuments({
      appliedAt: { $gte: startOfMonth, $lte: endOfMonth }
    });

    // Get leave type breakdown
    const leaveTypeStats = await Leave.aggregate([
      {
        $group: {
          _id: '$leaveType',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get recent leave requests (last 5)
    const recentLeaves = await Leave.find()
      .populate('studentId', 'studentName studentId')
      .select('leaveType startDate endDate status appliedAt')
      .sort({ appliedAt: -1 })
      .limit(5);

    return res.json({
      message: "Leave statistics fetched successfully",
      statistics: {
        pending: totalPending,
        approved: totalApproved,
        rejected: totalRejected,
        thisMonth: thisMonthLeaves,
        total: totalPending + totalApproved + totalRejected
      },
      leaveTypeBreakdown: leaveTypeStats,
      recentLeaves
    });

  } catch (err) {
    console.error("Fetch leave statistics error:", err);
    return res.status(500).json({ message: "Server error while fetching leave statistics." });
  }
};

// Get leave requests for a specific student
const getStudentLeaveHistory = async (req, res) => {
  const { studentId } = req.params;

  try {
    const leaves = await Leave.find({ studentId })
      .populate('studentId', 'studentName studentId email')
      .select('leaveType startDate endDate reason status appliedAt processedAt adminComments')
      .sort({ appliedAt: -1 });

    if (leaves.length === 0) {
      return res.json({
        message: "No leave requests found for this student",
        leaves: []
      });
    }

    return res.json({
      message: "Student leave history fetched successfully",
      leaves
    });

  } catch (err) {
    console.error("Fetch student leave history error:", err);
    return res.status(500).json({ message: "Server error while fetching student leave history." });
  }
};

// Send message/notification to student regarding leave
const sendLeaveMessage = async (req, res) => {
  const { leaveId } = req.params;
  const { message, subject } = req.body;

  try {
    const leave = await Leave.findById(leaveId).populate('studentId', 'studentName studentId email');

    if (!leave) {
      return res.status(404).json({ message: "Leave request not found." });
    }

    const student = leave.studentId;
    const emailSubject = subject || `Regarding Your Leave Request - ${leave.leaveType}`;

    const emailBody = `Hello ${student.studentName},

${message}

Leave Request Details:
• Type: ${leave.leaveType}
• From: ${new Date(leave.startDate).toLocaleDateString("en-IN")}
• To: ${new Date(leave.endDate).toLocaleDateString("en-IN")}
• Status: ${leave.status.toUpperCase()}

Applied on: ${new Date(leave.appliedAt).toLocaleDateString("en-IN")}

If you have any questions, please contact the hostel administration.

– Hostel Admin`;

    // Send email
    await transporter.sendMail({
      from: `"Hostel Admin" <${process.env.MAIL_USER}>`,
      to: student.email,
      subject: emailSubject,
      text: emailBody
    });

    return res.json({
      message: "Message sent successfully to student",
      sentTo: student.email
    });

  } catch (err) {
    console.error("Send leave message error:", err);
    return res.status(500).json({ message: "Server error while sending message." });
  }
};

// Bulk approve/reject leaves
const bulkUpdateLeaveStatus = async (req, res) => {
  const { leaveIds, status, adminComments } = req.body;

  try {
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: "Invalid status. Must be 'approved' or 'rejected'." });
    }

    if (!Array.isArray(leaveIds) || leaveIds.length === 0) {
      return res.status(400).json({ message: "Please provide an array of leave IDs." });
    }

    // Find all pending leaves from the provided IDs
    const leaves = await Leave.find({
      _id: { $in: leaveIds },
      status: 'pending'
    }).populate('studentId', 'studentName studentId email');

    if (leaves.length === 0) {
      return res.status(400).json({ message: "No pending leave requests found to update." });
    }

    // Update all leaves
    const updateResult = await Leave.updateMany(
      {
        _id: { $in: leaves.map(l => l._id) },
        status: 'pending'
      },
      {
        status,
        adminComments,
        processedAt: new Date()
      }
    );

    // Send emails to all affected students
    const emailPromises = leaves.map(async (leave) => {
      const student = leave.studentId;
      const statusText = status === 'approved' ? 'APPROVED' : 'REJECTED';
      const statusEmoji = status === 'approved' ? '✅' : '❌';

      const emailSubject = `Leave Request ${statusText} - ${leave.leaveType}`;
      const emailBody = `Hello ${student.studentName},

${statusEmoji} Your leave request has been ${statusText.toLowerCase()}.

Leave Details:
• Type: ${leave.leaveType}
• From: ${new Date(leave.startDate).toLocaleDateString("en-IN")}
• To: ${new Date(leave.endDate).toLocaleDateString("en-IN")}
• Reason: ${leave.reason}
• Status: ${statusText}
${adminComments ? `• Admin Comments: ${adminComments}` : ''}

Applied on: ${new Date(leave.appliedAt).toLocaleDateString("en-IN")}
Processed on: ${new Date().toLocaleDateString("en-IN")}

${status === 'approved' ?
          'Please ensure you follow all hostel guidelines during your leave period.' :
          'If you have any questions regarding this decision, please contact the hostel administration.'}

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

    // 🔔 Send in-app notifications to all affected students
    const notifPromises = leaves.map(leave =>
      sendNotification({
        studentId: leave.studentId._id,
        message: `Your leave request has been ${status.toUpperCase()}`,
        type: 'leave',
        link: '/leave-history',
      }).catch(err => {
        console.error(`Failed to send notification for leave ${leave._id}:`, err);
      })
    );

    await Promise.all(notifPromises);

    return res.json({
      message: `${updateResult.modifiedCount} leave requests ${status} successfully`,
      updatedCount: updateResult.modifiedCount,
      emailsSent: leaves.length
    });

  } catch (err) {
    console.error("Bulk update leave status error:", err);
    return res.status(500).json({ message: "Server error while bulk updating leave status." });
  }
};

export {
  getPendingLeaveRequests,
  getAllLeaveRequests,
  updateLeaveStatus,
  getLeaveStatistics,
  getStudentLeaveHistory,
  sendLeaveMessage,
  bulkUpdateLeaveStatus
}