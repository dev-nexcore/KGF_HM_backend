import { Inspection } from '../../models/inspection.model.js';
import { createAuditLog, AuditActionTypes } from '../../utils/auditLogger.js';

// POST - Create new inspection
const createInspection = async (req, res) => {
  

  const {
    title,
    target,
    area,
    datetime,
    instructions
  } = req.body;

  try {
    // Validate required fields
    if (!title || !target || !area || !datetime) {
      return res.status(400).json({
        success: false,
        message: 'Title, target, area, and datetime are required.'
      });
    }

    // Create new inspection
    const newInspection = new Inspection({
      title,
      target,
      area,
      datetime: new Date(datetime),
      instructions: instructions || '',
      createdBy: req.admin.adminId,
      status: 'pending'
    });

    await newInspection.save();

    // Create audit log
    await createAuditLog({
      adminId: req.admin._id,
      adminName: req.admin.adminId || 'System',
      actionType: AuditActionTypes.INSPECTION_CREATED,
      description: `Created inspection: ${title} for ${target}`,
      targetType: 'Inspection',
      targetId: newInspection._id.toString(),
      targetName: title,
      additionalData: {
        target,
        area,
        datetime,
        instructions
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Inspection created successfully.',
      inspection: {
        id: newInspection._id,
        title: newInspection.title,
        target: newInspection.target,
        area: newInspection.area,
        datetime: newInspection.datetime,
        instructions: newInspection.instructions,
        status: newInspection.status,
        createdAt: newInspection.createdAt
      }
    });
  } catch (err) {
    console.error('Error creating inspection:', err);
    return res.status(500).json({
      success: false,
      message: 'Error creating inspection.'
    });
  }
};

// GET - Get all inspections
const getAllInspections = async (req, res) => {
  try {
    const {
      status,
      page = 1,
      limit = 50,
      sortBy = 'datetime',
      sortOrder = 'asc'
    } = req.query;

    // Build filter
    const filter = {};
    if (status) filter.status = status;

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Get inspections
    const inspections = await Inspection.find(filter)
      .populate('createdBy', 'adminId firstName lastName')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count
    const totalCount = await Inspection.countDocuments(filter);

    // Transform data for frontend
    const transformedInspections = inspections.map(inspection => ({
      id: inspection._id.toString(),
      title: inspection.title,
      target: inspection.target,
      area: inspection.area,
      date: inspection.datetime.toLocaleDateString('en-GB'),
      time: inspection.datetime.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }),
      datetime: inspection.datetime,
      instructions: inspection.instructions,
      status: inspection.status === 'pending' ? 'Scheduled' : 'Completed',
      createdBy: inspection.createdBy,
      createdAt: inspection.createdAt
    }));

    return res.json({
      success: true,
      message: 'Inspections fetched successfully.',
      inspections: transformedInspections,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / limit),
        totalCount,
        hasNextPage: page * limit < totalCount,
        hasPrevPage: page > 1
      }
    });
  } catch (err) {
    console.error('Error fetching inspections:', err);
    return res.status(500).json({
      success: false,
      message: 'Error fetching inspections.'
    });
  }
};

// GET - Get single inspection by ID
const getInspectionById = async (req, res) => {
  const { inspectionId } = req.params;

  try {
    const inspection = await Inspection.findById(inspectionId)
      .populate('createdBy', 'adminId firstName lastName');

    if (!inspection) {
      return res.status(404).json({
        success: false,
        message: 'Inspection not found.'
      });
    }

    return res.json({
      success: true,
      message: 'Inspection fetched successfully.',
      inspection: {
        id: inspection._id.toString(),
        title: inspection.title,
        target: inspection.target,
        area: inspection.area,
        datetime: inspection.datetime,
        instructions: inspection.instructions,
        status: inspection.status,
        createdBy: inspection.createdBy,
        createdAt: inspection.createdAt
      }
    });
  } catch (err) {
    console.error('Error fetching inspection:', err);
    return res.status(500).json({
      success: false,
      message: 'Error fetching inspection.'
    });
  }
};

// PUT - Update inspection
const updateInspection = async (req, res) => {
  const { inspectionId } = req.params;
  const {
    title,
    target,
    area,
    datetime,
    instructions,
    status
  } = req.body;

  try {
    // Check if inspection exists
    const existingInspection = await Inspection.findById(inspectionId);
    if (!existingInspection) {
      return res.status(404).json({
        success: false,
        message: 'Inspection not found.'
      });
    }

    // Prepare update data
    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (target !== undefined) updateData.target = target;
    if (area !== undefined) updateData.area = area;
    if (datetime !== undefined) updateData.datetime = new Date(datetime);
    if (instructions !== undefined) updateData.instructions = instructions;
    if (status !== undefined) updateData.status = status;

    // Update inspection
    const updatedInspection = await Inspection.findByIdAndUpdate(
      inspectionId,
      updateData,
      { new: true, runValidators: true }
    ).populate('createdBy', 'adminId firstName lastName');

    // Create audit log
    await createAuditLog({
      adminId: req.admin._id,
      adminName: req.admin.adminId || 'System',
      actionType: AuditActionTypes.INSPECTION_UPDATED,
      description: `Updated inspection: ${updatedInspection.title}`,
      targetType: 'Inspection',
      targetId: inspectionId,
      targetName: updatedInspection.title,
      additionalData: {
        updatedFields: Object.keys(updateData),
        oldData: {
          title: existingInspection.title,
          target: existingInspection.target,
          area: existingInspection.area,
          datetime: existingInspection.datetime,
          status: existingInspection.status
        },
        newData: updateData
      }
    });

    return res.json({
      success: true,
      message: 'Inspection updated successfully.',
      inspection: updatedInspection
    });
  } catch (err) {
    console.error('Error updating inspection:', err);
    return res.status(500).json({
      success: false,
      message: 'Error updating inspection.'
    });
  }
};

// DELETE - Delete inspection
const deleteInspection = async (req, res) => {
  const { inspectionId } = req.params;

  try {
    const inspection = await Inspection.findById(inspectionId);
    if (!inspection) {
      return res.status(404).json({
        success: false,
        message: 'Inspection not found.'
      });
    }

    // Store data for audit log
    const inspectionData = {
      title: inspection.title,
      target: inspection.target,
      area: inspection.area,
      datetime: inspection.datetime
    };

    // Delete inspection
    await Inspection.findByIdAndDelete(inspectionId);

    // Create audit log
    await createAuditLog({
      adminId: req.admin._id,
      adminName: req.admin.adminId || 'System',
      actionType: AuditActionTypes.INSPECTION_DELETED,
      description: `Deleted inspection: ${inspectionData.title}`,
      targetType: 'Inspection',
      targetId: inspectionId,
      targetName: inspectionData.title,
      additionalData: {
        deletedInspectionData: inspectionData
      }
    });

    return res.json({
      success: true,
      message: 'Inspection deleted successfully.',
      deletedInspection: {
        id: inspectionId,
        title: inspectionData.title
      }
    });
  } catch (err) {
    console.error('Error deleting inspection:', err);
    return res.status(500).json({
      success: false,
      message: 'Error deleting inspection.'
    });
  }
};

// PUT - Update inspection status (complete/pending)
const updateInspectionStatus = async (req, res) => {
  const { inspectionId } = req.params;
  const { status } = req.body;

  console.log("Updating inspection status:", { inspectionId, status, admin: req.admin });

  try {
    if (!['pending', 'completed'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Use "pending" or "completed".'
      });
    }

    const inspection = await Inspection.findById(inspectionId);
    if (!inspection) {
      return res.status(404).json({
        success: false,
        message: 'Inspection not found.'
      });
    }

    const oldStatus = inspection.status;
    inspection.status = status;
    await inspection.save();

    // Create audit log
    await createAuditLog({
      adminId: req.admin._id,
      adminName: req.admin.adminId || 'System',
      actionType: AuditActionTypes.INSPECTION_STATUS_UPDATED,
      description: `Changed inspection status from ${oldStatus} to ${status}: ${inspection.title}`,
      targetType: 'Inspection',
      targetId: inspectionId,
      targetName: inspection.title,
      additionalData: {
        oldStatus,
        newStatus: status
      }
    });

    return res.json({
      success: true,
      message: 'Inspection status updated successfully.',
      inspection: {
        id: inspection._id.toString(),
        status: inspection.status
      }
    });
  } catch (err) {
    console.error('Error updating inspection status:', err);
    return res.status(500).json({
      success: false,
      message: 'Error updating inspection status.'
    });
  }
};

export {
  createInspection,
  getAllInspections,
  getInspectionById,
  updateInspection,
  deleteInspection,
  updateInspectionStatus
};