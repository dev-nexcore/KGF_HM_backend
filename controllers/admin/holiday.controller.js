import { Holiday } from '../../models/holiday.model.js';
import { createAuditLog } from '../../utils/auditLogger.js';

// Get all holidays (optionally filter by month and year)
export const getHolidays = async (req, res) => {
  try {
    const { month, year } = req.query;
    
    let query = {};
    if (month && year) {
      // Month is expected as 1-12
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59, 999);
      query.date = { $gte: startDate, $lte: endDate };
    }

    const holidays = await Holiday.find(query).sort({ date: 1 });
    
    res.status(200).json({
      success: true,
      holidays
    });
  } catch (error) {
    console.error("Get holidays error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching holidays",
      error: error.message
    });
  }
};

// Add a new holiday
export const addHoliday = async (req, res) => {
  try {
    const { date, title, type } = req.body;
    
    // Check if a holiday already exists for this date
    const holidayDate = new Date(date);
    holidayDate.setHours(0, 0, 0, 0); // Normalize to midnight
    
    const nextDay = new Date(holidayDate);
    nextDay.setDate(nextDay.getDate() + 1);

    const existingHoliday = await Holiday.findOne({
      date: { $gte: holidayDate, $lt: nextDay }
    });

    if (existingHoliday) {
      return res.status(400).json({
        success: false,
        message: "A holiday is already scheduled for this date."
      });
    }

    const newHoliday = new Holiday({
      date: holidayDate,
      title,
      type: type || 'Other',
      createdBy: req.admin?._id
    });

    await newHoliday.save();

    await createAuditLog({
      adminId: req.admin?._id,
      adminName: req.admin?.adminId || 'System',
      actionType: 'Holiday Added',
      description: `Added holiday: ${title} on ${holidayDate.toLocaleDateString()}`,
      targetType: 'Holiday',
      targetId: newHoliday._id.toString(),
      targetName: title
    });

    res.status(201).json({
      success: true,
      message: "Holiday added successfully",
      holiday: newHoliday
    });
  } catch (error) {
    console.error("Add holiday error:", error);
    res.status(500).json({
      success: false,
      message: "Error adding holiday",
      error: error.message
    });
  }
};

// Delete a holiday
export const deleteHoliday = async (req, res) => {
  try {
    const { id } = req.params;
    const holiday = await Holiday.findById(id);

    if (!holiday) {
      return res.status(404).json({
        success: false,
        message: "Holiday not found"
      });
    }

    await Holiday.findByIdAndDelete(id);

    await createAuditLog({
      adminId: req.admin?._id,
      adminName: req.admin?.adminId || 'System',
      actionType: 'Holiday Deleted',
      description: `Deleted holiday: ${holiday.title} on ${holiday.date.toLocaleDateString()}`,
      targetType: 'Holiday',
      targetId: holiday._id.toString(),
      targetName: holiday.title
    });

    res.status(200).json({
      success: true,
      message: "Holiday deleted successfully"
    });
  } catch (error) {
    console.error("Delete holiday error:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting holiday",
      error: error.message
    });
  }
};
