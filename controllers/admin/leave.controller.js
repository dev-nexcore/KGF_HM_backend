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
    // Show leaves that are pending (awaiting parent), parent_approved, warden_approved, or warden_rejected (awaiting admin)
    const pendingLeaves = await Leave.find({ status: { $in: ['pending', 'parent_approved', 'warden_approved', 'warden_rejected'] } })
      .populate('studentId', 'firstName lastName studentId email contactNumber roomBedNumber')
      .select('leaveType otherLeaveType startDate endDate reason status appliedAt parentComment parentApprovalDate wardenComments adminComments')
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

    let query = {};
    if (status === 'pending') {
      query.status = { $in: ['pending', 'parent_approved', 'warden_approved', 'warden_rejected'] };
    } else if (status && status !== 'all') {
      query.status = status;
    }

    const skip = (page - 1) * limit;

    const leaves = await Leave.find(query)
      .populate('studentId', 'firstName lastName studentId email contactNumber roomBedNumber') // Changed from 'studentName' to 'firstName lastName'
      .select('leaveType otherLeaveType startDate endDate reason status appliedAt processedAt adminComments wardenComments')
      .sort({ appliedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalLeaves = await Leave.countDocuments(query);

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
      if (['pending', 'parent_approved', 'warden_approved', 'warden_rejected'].includes(item._id)) {
        counts.pending += item.count;
      } else {
        counts[item._id] = (counts[item._id] || 0) + item.count;
      }
    });

    return res.json({
      message: "Leave requests fetched successfully",
      leaves,
      counts,
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
  const { status, adminComments } = req.body;

  try {
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: "Invalid status. Must be 'approved' or 'rejected'." });
    }

    // Updated populate to use firstName and lastName
    const leave = await Leave.findById(leaveId).populate('studentId', 'firstName lastName studentId email');

    if (!leave) {
      return res.status(404).json({ message: "Leave request not found." });
    }

    // Only allow updating leaves that are pending, parent_approved, warden_approved, or warden_rejected
    if (!['pending', 'parent_approved', 'warden_approved', 'warden_rejected'].includes(leave.status)) {
      return res.status(400).json({ message: "Leave request has already been processed." });
    }

    leave.status = status;
    if (adminComments) {
      leave.adminComments = adminComments;
    }
    leave.processedAt = new Date();

    await leave.save();

    const student = leave.studentId;
    const studentName = student ? `${student.firstName} ${student.lastName}` : 'Unknown Student'; // Construct full name
    const statusText = status === 'approved' ? 'APPROVED' : 'REJECTED';
    const emailSubject = `Leave Request ${statusText} - ${leave.leaveType}`;
    // Send email notification
    try {
      const formattedStartDate = new Date(leave.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Kolkata' });
      const formattedEndDate = new Date(leave.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Kolkata' });
      
      const { default: sendEmail } = await import('../../utils/sendEmail.js');

      await sendEmail({ 
        to: student.email, 
        subject: emailSubject, 
        useKGFLayout: true,
        html: `
          <p style="margin: 0 0 10px; font-size: 11px; font-weight: 700; color: #0066cc; text-transform: uppercase; letter-spacing: 1px;">Leave Application Status</p>
          <h2 style="margin: 0 0 20px; font-size: 24px; color: #0f172a; font-weight: 700;">Update from Hostel Admin</h2>
          
          <p style="margin: 0 0 25px; font-size: 15px; color: #475569; line-height: 1.6;">
            Dear <strong>${studentName}</strong>,<br/>
            Your leave application for <strong>${leave.leaveType === 'Others' && leave.otherLeaveType ? `Others (${leave.otherLeaveType})` : leave.leaveType}</strong> has been <strong style="color: ${status === 'approved' ? '#16a34a' : '#dc2626'}">${statusText}</strong> by the hostel administration.
          </p>

          <div style="border: 1px solid #e2e8f0; border-left: 4px solid ${status === 'approved' ? '#16a34a' : '#dc2626'}; border-radius: 6px; padding: 25px; margin-bottom: 25px; background-color: #f8fafc;">
            <p style="margin: 0 0 20px; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 1px;">Application Details</p>
            
            <table width="100%" border="0" cellspacing="0" cellpadding="0">
              <tr>
                <td style="padding: 0 0 15px; border-bottom: 1px solid #e2e8f0; font-size: 14px; color: #64748b; width: 40%;">Leave Type</td>
                <td style="padding: 0 0 15px; border-bottom: 1px solid #e2e8f0; font-size: 14px; font-weight: 600; text-align: right; width: 60%;">${leave.leaveType === 'Others' && leave.otherLeaveType ? `Others (${leave.otherLeaveType})` : leave.leaveType}</td>
              </tr>
              <tr>
                <td style="padding: 15px 0 15px; border-bottom: 1px solid #e2e8f0; font-size: 14px; color: #64748b; width: 40%;">Start Date</td>
                <td style="padding: 15px 0 15px; border-bottom: 1px solid #e2e8f0; font-size: 14px; font-weight: 600; text-align: right; width: 60%;">${formattedStartDate}</td>
              </tr>
              <tr>
                <td style="padding: 15px 0 15px; border-bottom: 1px solid #e2e8f0; font-size: 14px; color: #64748b; width: 40%;">End Date</td>
                <td style="padding: 15px 0 15px; border-bottom: 1px solid #e2e8f0; font-size: 14px; font-weight: 600; text-align: right; width: 60%;">${formattedEndDate}</td>
              </tr>
              <tr>
                <td style="padding: 15px 0 15px; border-bottom: 1px solid #e2e8f0; font-size: 14px; color: #64748b; width: 40%;">Reason</td>
                <td style="padding: 15px 0 15px; border-bottom: 1px solid #e2e8f0; font-size: 14px; font-weight: 600; text-align: right; width: 60%;">${leave.reason}</td>
              </tr>
              <tr>
                <td style="padding: 15px 0 15px; border-bottom: 1px solid #e2e8f0; font-size: 14px; color: #64748b; width: 40%;">Current Status</td>
                <td style="padding: 15px 0 15px; border-bottom: 1px solid #e2e8f0; font-size: 14px; font-weight: 600; text-align: right; width: 60%; color: ${status === 'approved' ? '#16a34a' : '#dc2626'}; text-transform: capitalize;">${statusText}</td>
              </tr>
              ${adminComments ? `
              <tr>
                <td style="padding: 15px 0 0; font-size: 14px; color: #64748b; width: 40%; vertical-align: top;">Admin Comments</td>
                <td style="padding: 15px 0 0; font-size: 14px; font-weight: 600; text-align: right; width: 60%;">${adminComments}</td>
              </tr>
              ` : ''}
            </table>
          </div>
          <p style="margin: 0; font-size: 15px; color: #475569;">${status === 'approved' ? 'Please ensure you follow all hostel guidelines during your leave period.' : 'If you have any questions regarding this decision, please contact the hostel administration.'}</p>
        `
      });
      console.log(`📤 Leave ${status} notification sent to ${student.email}`);
    } catch (emailErr) {
      console.error("Email sending error:", emailErr);
    }

    // Create audit log
    await createAuditLog({
      adminId: req.admin?._id,
      adminName: req.admin?.adminId || 'System',
      actionType: status === 'approved' ? AuditActionTypes.LEAVE_APPROVED : AuditActionTypes.LEAVE_REJECTED,
      description: `${status === 'approved' ? 'Approved' : 'Rejected'} leave request for ${studentName}`,
      targetType: 'Leave',
      targetId: leaveId,
      targetName: `${studentName} - ${leave.leaveType}`,
      additionalData: {
        leaveType: leave.leaveType,
        status,
        adminComments
      }
    });

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
          studentName: studentName, // Use constructed name
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

    // Get counts - include all pending stages
    const totalPending = await Leave.countDocuments({ status: { $in: ['pending', 'parent_approved', 'warden_approved', 'warden_rejected'] } });
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
      .populate('studentId', 'firstName lastName studentId')
      .select('leaveType otherLeaveType startDate endDate status appliedAt')
      .sort({ appliedAt: -1 })
      .limit(5);

    const formattedRecentLeaves = recentLeaves.map(leave => ({
      ...leave.toObject(),
      studentName: leave.studentId ? `${leave.studentId.firstName} ${leave.studentId.lastName}` : 'Unknown'
    }));

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
      recentLeaves: formattedRecentLeaves
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
      .populate('studentId', 'firstName lastName studentId email')
      .select('leaveType otherLeaveType startDate endDate reason status appliedAt processedAt adminComments')
      .sort({ appliedAt: -1 });

    const formattedLeaves = leaves.map(leave => ({
      ...leave.toObject(),
      studentName: leave.studentId ? `${leave.studentId.firstName} ${leave.studentId.lastName}` : 'Unknown'
    }));

    if (leaves.length === 0) {
      return res.json({
        message: "No leave requests found for this student",
        leaves: []
      });
    }

    return res.json({
      message: "Student leave history fetched successfully",
      leaves: formattedLeaves
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
    const leave = await Leave.findById(leaveId).populate('studentId', 'firstName lastName studentId email');

    if (!leave) {
      return res.status(404).json({ message: "Leave request not found." });
    }

    const student = leave.studentId;
    const emailSubject = subject || `Regarding Your Leave Request - ${leave.leaveType === 'Others' && leave.otherLeaveType ? `Others (${leave.otherLeaveType})` : leave.leaveType}`;

    const formattedStartDate = new Date(leave.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Kolkata' });
    const formattedEndDate = new Date(leave.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Kolkata' });
    const formattedAppliedAt = new Date(leave.appliedAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Kolkata' });

    const { default: sendEmail } = await import('../../utils/sendEmail.js');

    // Send email
    await sendEmail({
      to: student.email,
      subject: emailSubject,
      useKGFLayout: true,
      html: `
        <p style="margin: 0 0 10px; font-size: 11px; font-weight: 700; color: #0066cc; text-transform: uppercase; letter-spacing: 1px;">Message regarding Leave Request</p>
        <h2 style="margin: 0 0 20px; font-size: 24px; color: #0f172a; font-weight: 700;">Update from Hostel Admin</h2>
        
        <p style="margin: 0 0 25px; font-size: 15px; color: #475569; line-height: 1.6;">
          Dear <strong>${student.firstName} ${student.lastName}</strong>,<br/><br/>
          ${message}
        </p>

        <div style="border: 1px solid #e2e8f0; border-left: 4px solid #0ea5e9; border-radius: 6px; padding: 25px; margin-bottom: 25px; background-color: #f8fafc;">
          <p style="margin: 0 0 20px; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 1px;">Application Details</p>
          
          <table width="100%" border="0" cellspacing="0" cellpadding="0">
            <tr>
              <td style="padding: 0 0 15px; border-bottom: 1px solid #e2e8f0; font-size: 14px; color: #64748b; width: 40%;">Leave Type</td>
              <td style="padding: 0 0 15px; border-bottom: 1px solid #e2e8f0; font-size: 14px; font-weight: 600; text-align: right; width: 60%;">${leave.leaveType === 'Others' && leave.otherLeaveType ? `Others (${leave.otherLeaveType})` : leave.leaveType}</td>
            </tr>
            <tr>
              <td style="padding: 15px 0 15px; border-bottom: 1px solid #e2e8f0; font-size: 14px; color: #64748b; width: 40%;">Start Date</td>
              <td style="padding: 15px 0 15px; border-bottom: 1px solid #e2e8f0; font-size: 14px; font-weight: 600; text-align: right; width: 60%;">${formattedStartDate}</td>
            </tr>
            <tr>
              <td style="padding: 15px 0 15px; border-bottom: 1px solid #e2e8f0; font-size: 14px; color: #64748b; width: 40%;">End Date</td>
              <td style="padding: 15px 0 15px; border-bottom: 1px solid #e2e8f0; font-size: 14px; font-weight: 600; text-align: right; width: 60%;">${formattedEndDate}</td>
            </tr>
            <tr>
              <td style="padding: 15px 0 15px; border-bottom: 1px solid #e2e8f0; font-size: 14px; color: #64748b; width: 40%;">Current Status</td>
              <td style="padding: 15px 0 15px; border-bottom: 1px solid #e2e8f0; font-size: 14px; font-weight: 600; text-align: right; width: 60%;">${leave.status.toUpperCase()}</td>
            </tr>
            <tr>
              <td style="padding: 15px 0 0; font-size: 14px; color: #64748b; width: 40%; vertical-align: top;">Applied On</td>
              <td style="padding: 15px 0 0; font-size: 14px; font-weight: 600; text-align: right; width: 60%;">${formattedAppliedAt}</td>
            </tr>
          </table>
        </div>
        <p style="margin: 0; font-size: 15px; color: #475569;">If you have any questions, please contact the hostel administration.</p>
      `
    });

    // Create audit log
    await createAuditLog({
      adminId: req.admin?._id,
      adminName: req.admin?.adminId || 'System',
      actionType: AuditActionTypes.LEAVE_MESSAGE_SENT,
      description: `Sent message to student ${student.firstName} ${student.lastName} regarding leave ${leave.leaveType}`,
      targetType: 'Leave',
      targetId: leaveId,
      targetName: `${student.firstName} ${student.lastName}`,
      additionalData: {
        message,
        subject
      }
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
      status: { $in: ['pending', 'parent_approved', 'warden_approved', 'warden_rejected'] }
    }).populate('studentId', 'firstName lastName studentId email');

    if (leaves.length === 0) {
      return res.status(400).json({ message: "No pending leave requests found to update." });
    }

    // Update all leaves
    const updateResult = await Leave.updateMany(
      {
        _id: { $in: leaves.map(l => l._id) },
        status: { $in: ['pending', 'parent_approved', 'warden_approved', 'warden_rejected'] }
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
      const formattedStartDate = new Date(leave.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Kolkata' });
      const formattedEndDate = new Date(leave.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Kolkata' });
      const { default: sendEmail } = await import('../../utils/sendEmail.js');

      try {
        await sendEmail({
          to: student.email,
        subject: emailSubject,
        useKGFLayout: true,
        html: `
          <p style="margin: 0 0 10px; font-size: 11px; font-weight: 700; color: #0066cc; text-transform: uppercase; letter-spacing: 1px;">Leave Application Status</p>
          <h2 style="margin: 0 0 20px; font-size: 24px; color: #0f172a; font-weight: 700;">Update from Hostel Admin</h2>
          
          <p style="margin: 0 0 25px; font-size: 15px; color: #475569; line-height: 1.6;">
            Dear <strong>${student.firstName} ${student.lastName}</strong>,<br/>
            Your leave application for <strong>${leave.leaveType === 'Others' && leave.otherLeaveType ? `Others (${leave.otherLeaveType})` : leave.leaveType}</strong> has been <strong style="color: ${status === 'approved' ? '#16a34a' : '#dc2626'}">${statusText}</strong> by the hostel administration.
          </p>

          <div style="border: 1px solid #e2e8f0; border-left: 4px solid ${status === 'approved' ? '#16a34a' : '#dc2626'}; border-radius: 6px; padding: 25px; margin-bottom: 25px; background-color: #f8fafc;">
            <p style="margin: 0 0 20px; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 1px;">Application Details</p>
            
            <table width="100%" border="0" cellspacing="0" cellpadding="0">
              <tr>
                <td style="padding: 0 0 15px; border-bottom: 1px solid #e2e8f0; font-size: 14px; color: #64748b; width: 40%;">Leave Type</td>
                <td style="padding: 0 0 15px; border-bottom: 1px solid #e2e8f0; font-size: 14px; font-weight: 600; text-align: right; width: 60%;">${leave.leaveType === 'Others' && leave.otherLeaveType ? `Others (${leave.otherLeaveType})` : leave.leaveType}</td>
              </tr>
              <tr>
                <td style="padding: 15px 0 15px; border-bottom: 1px solid #e2e8f0; font-size: 14px; color: #64748b; width: 40%;">Start Date</td>
                <td style="padding: 15px 0 15px; border-bottom: 1px solid #e2e8f0; font-size: 14px; font-weight: 600; text-align: right; width: 60%;">${formattedStartDate}</td>
              </tr>
              <tr>
                <td style="padding: 15px 0 15px; border-bottom: 1px solid #e2e8f0; font-size: 14px; color: #64748b; width: 40%;">End Date</td>
                <td style="padding: 15px 0 15px; border-bottom: 1px solid #e2e8f0; font-size: 14px; font-weight: 600; text-align: right; width: 60%;">${formattedEndDate}</td>
              </tr>
              <tr>
                <td style="padding: 15px 0 15px; border-bottom: 1px solid #e2e8f0; font-size: 14px; color: #64748b; width: 40%;">Reason</td>
                <td style="padding: 15px 0 15px; border-bottom: 1px solid #e2e8f0; font-size: 14px; font-weight: 600; text-align: right; width: 60%;">${leave.reason}</td>
              </tr>
              <tr>
                <td style="padding: 15px 0 15px; border-bottom: 1px solid #e2e8f0; font-size: 14px; color: #64748b; width: 40%;">Current Status</td>
                <td style="padding: 15px 0 15px; border-bottom: 1px solid #e2e8f0; font-size: 14px; font-weight: 600; text-align: right; width: 60%; color: ${status === 'approved' ? '#16a34a' : '#dc2626'}; text-transform: capitalize;">${statusText}</td>
              </tr>
              ${adminComments ? `
              <tr>
                <td style="padding: 15px 0 0; font-size: 14px; color: #64748b; width: 40%; vertical-align: top;">Admin Comments</td>
                <td style="padding: 15px 0 0; font-size: 14px; font-weight: 600; text-align: right; width: 60%;">${adminComments}</td>
              </tr>
              ` : ''}
            </table>
          </div>
          <p style="margin: 0; font-size: 15px; color: #475569;">${status === 'approved' ? 'Please ensure you follow all hostel guidelines during your leave period.' : 'If you have any questions regarding this decision, please contact the hostel administration.'}</p>
        `
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
        link: '/leaves',
      }).catch(err => {
        console.error(`Failed to send notification for leave ${leave._id}:`, err);
      })
    );

    await Promise.all(notifPromises);

    // Create audit log for bulk update
    await createAuditLog({
      adminId: req.admin?._id,
      adminName: req.admin?.adminId || 'System',
      actionType: status === 'approved' ? AuditActionTypes.LEAVE_APPROVED : AuditActionTypes.LEAVE_REJECTED,
      description: `Bulk ${status} ${updateResult.modifiedCount} leave requests`,
      targetType: 'Leave',
      targetId: 'bulk_update',
      targetName: `Bulk Update - ${updateResult.modifiedCount} leaves`,
      additionalData: {
        leaveIds,
        status,
        adminComments,
        affectedCount: updateResult.modifiedCount
      }
    });

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