import 'dotenv/config';
import { AuditLog } from '../../models/auditLog.model.js';

const getAuditLogs = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      search, 
      actionType, 
      adminId, 
      targetType,
      startDate,
      endDate
    } = req.query;

    // Build query
    let query = {};
    
    // Search in description, adminName, or targetName
    if (search) {
      query.$or = [
        { description: { $regex: search, $options: 'i' } },
        { adminName: { $regex: search, $options: 'i' } },
        { targetName: { $regex: search, $options: 'i' } }
      ];
    }

    // Filter by action type
    if (actionType && actionType !== 'all') {
      query.actionType = actionType;
    }

    // Filter by admin
    if (adminId && adminId !== 'all') {
      query.adminId = adminId;
    }

    // Filter by target type
    if (targetType && targetType !== 'all') {
      query.targetType = targetType;
    }

    // Date range filter
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) {
        query.timestamp.$gte = new Date(startDate);
      }
      if (endDate) {
        query.timestamp.$lte = new Date(endDate + 'T23:59:59.999Z');
      }
    }

    const skip = (page - 1) * limit;

    // Get audit logs
    const auditLogs = await AuditLog.find(query)
      .populate('adminId', 'adminId email')
      .select('adminName actionType description targetType targetId targetName timestamp')
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalLogs = await AuditLog.countDocuments(query);

    // Get filter options for frontend
    const actionTypes = await AuditLog.distinct('actionType');
    const admins = await AuditLog.aggregate([
      {
        $group: {
          _id: '$adminId',
          adminName: { $first: '$adminName' },
          count: { $sum: 1 }
        }
      }
    ]);
    const targetTypes = await AuditLog.distinct('targetType');

    return res.json({
      message: "Audit logs fetched successfully",
      logs: auditLogs.map(log => ({
        _id: log._id,
        timestamp: log.timestamp,
        user: log.adminName,
        actionType: log.actionType,
        description: log.description,
        targetType: log.targetType,
        targetId: log.targetId,
        targetName: log.targetName
      })),
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalLogs / limit),
        totalLogs,
        hasNextPage: page * limit < totalLogs,
        hasPreviousPage: page > 1
      },
      filters: {
        actionTypes,
        admins: admins.map(a => ({ _id: a._id, name: a.adminName, count: a.count })),
        targetTypes
      }
    });

  } catch (err) {
    console.error("Fetch audit logs error:", err);
    return res.status(500).json({ message: "Server error while fetching audit logs." });
  }
};

// Get audit log statistics
const getAuditLogStatistics = async (req, res) => {
  try {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));
    const startOfWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    // Get counts
    const totalLogs = await AuditLog.countDocuments();
    const todayLogs = await AuditLog.countDocuments({
      timestamp: { $gte: startOfDay, $lte: endOfDay }
    });
    const weekLogs = await AuditLog.countDocuments({
      timestamp: { $gte: startOfWeek }
    });
    const monthLogs = await AuditLog.countDocuments({
      timestamp: { $gte: startOfMonth }
    });

    // Get action type breakdown
    const actionTypeStats = await AuditLog.aggregate([
      {
        $group: {
          _id: '$actionType',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // Get most active admins
    const activeAdmins = await AuditLog.aggregate([
      {
        $group: {
          _id: '$adminId',
          adminName: { $first: '$adminName' },
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    // Get recent activities (last 10)
    const recentActivities = await AuditLog.find()
      .select('adminName actionType description timestamp targetName')
      .sort({ timestamp: -1 })
      .limit(10);

    return res.json({
      message: "Audit log statistics fetched successfully",
      statistics: {
        total: totalLogs,
        today: todayLogs,
        thisWeek: weekLogs,
        thisMonth: monthLogs
      },
      actionTypeBreakdown: actionTypeStats,
      activeAdmins: activeAdmins.map(admin => ({
        adminName: admin.adminName,
        count: admin.count
      })),
      recentActivities: recentActivities.map(activity => ({
        _id: activity._id,
        user: activity.adminName,
        action: activity.actionType,
        description: activity.description,
        timestamp: activity.timestamp,
        target: activity.targetName
      }))
    });

  } catch (err) {
    console.error("Fetch audit log statistics error:", err);
    return res.status(500).json({ message: "Server error while fetching audit log statistics." });
  }
};

// Get specific audit log details
const getAuditLogDetails = async (req, res) => {
  const { logId } = req.params;

  try {
    const auditLog = await AuditLog.findById(logId)
      .populate('adminId', 'adminId email');

    if (!auditLog) {
      return res.status(404).json({ message: "Audit log not found." });
    }

    return res.json({
      message: "Audit log details fetched successfully",
      log: {
        _id: auditLog._id,
        timestamp: auditLog.timestamp,
        adminName: auditLog.adminName,
        adminEmail: auditLog.adminId ? auditLog.adminId.email : 'Unknown',
        actionType: auditLog.actionType,
        description: auditLog.description,
        targetType: auditLog.targetType,
        targetId: auditLog.targetId,
        targetName: auditLog.targetName,
        sessionInfo: auditLog.sessionInfo,
        additionalData: auditLog.additionalData,
        createdAt: auditLog.createdAt,
        updatedAt: auditLog.updatedAt
      }
    });

  } catch (err) {
    console.error("Fetch audit log details error:", err);
    return res.status(500).json({ message: "Server error while fetching audit log details." });
  }
};

// Export audit logs to CSV (optional feature)
const exportAuditLogs = async (req, res) => {
  try {
    const { startDate, endDate, actionType } = req.query;
    
    let query = {};
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate + 'T23:59:59.999Z');
    }
    if (actionType && actionType !== 'all') {
      query.actionType = actionType;
    }

    const logs = await AuditLog.find(query)
      .select('timestamp adminName actionType description targetType targetName')
      .sort({ timestamp: -1 })
      .limit(10000); // Limit for performance

    // Convert to CSV format
    const csvHeaders = 'Timestamp,User,Action Type,Description,Target Type,Target Name\n';
    const csvData = logs.map(log => 
      `"${log.timestamp}","${log.adminName}","${log.actionType}","${log.description}","${log.targetType || ''}","${log.targetName || ''}"`
    ).join('\n');

    const csv = csvHeaders + csvData;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${new Date().toISOString().split('T')[0]}.csv"`);
    return res.send(csv);

  } catch (err) {
    console.error("Export audit logs error:", err);
    return res.status(500).json({ message: "Server error while exporting audit logs." });
  }
};

export{
    getAuditLogs,
    getAuditLogStatistics,
    getAuditLogDetails,
    exportAuditLogs
}