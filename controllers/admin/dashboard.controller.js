import 'dotenv/config';
import { Student } from '../../models/student.model.js';
import { StudentInvoice } from '../../models/studentInvoice.model.js';
import { Inventory } from '../../models/inventory.model.js';
import { StaffSalary } from '../../models/staffSalary.model.js';
import { Warden } from '../../models/warden.model.js';
import { Leave } from '../../models/leave.model.js';
import { Complaint } from '../../models/complaint.model.js';
import Attendance from '../../models/attendance.model.js';
import { Parent } from '../../models/parent.model.js';


const getTotalRevenue = async (req, res) => {
  try {
    const totalRevenue = await StudentInvoice.aggregate([
      { $match: { status: 'paid' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    return res.json({
      message: "Total revenue fetched successfully",
      totalRevenue: totalRevenue[0]?.total || 0
    });

  } catch (err) {
    console.error("Get total revenue error:", err);
    return res.status(500).json({ message: "Error fetching total revenue." });
  }
};

const getPendingPayments = async (req, res) => {
  try {
    const pendingInvoices = await StudentInvoice.aggregate([
      { $match: { status: { $in: ['pending', 'overdue'] } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    return res.json({
      message: "Pending payments fetched successfully",
      pendingPayments: pendingInvoices[0]?.total || 0,
      pendingInvoicesCount: await StudentInvoice.countDocuments({ status: { $in: ['pending', 'overdue'] } }),
    });

  } catch (err) {
    console.error("Get pending payments error:", err);
    return res.status(500).json({ message: "Error fetching pending payments." });
  }
};

const getFinancialSummary = async (req, res) => {
  try {
    // Total Revenue from Student Invoices (Paid)
    const revenueIn = await StudentInvoice.aggregate([
      { $match: { status: 'paid' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    // Total Salaries Paid (Out)
    const salariesOut = await StaffSalary.aggregate([
      { $match: { status: 'paid' } },
      { $group: { _id: null, total: { $sum: '$netSalary' } } }
    ]);

    // Pending Invoices (Incoming) - Now includes overdue
    const pendingInvoices = await StudentInvoice.aggregate([
      { $match: { status: { $in: ['pending', 'overdue'] } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    // Total Revenue (Collected)
    const totalRevenue = (revenueIn[0]?.total || 0);
    // Total Pending (Receivable from students)
    const totalPending = (pendingInvoices[0]?.total || 0);

    return res.json({
      message: "Financial summary fetched successfully",
      revenue: {
        totalRevenue,
        salariesPaid: salariesOut[0]?.total || 0,
        pendingPayments: totalPending,
        pendingInvoices: totalPending
      }
    });

  } catch (err) {
    console.error("Get financial summary error:", err);
    return res.status(500).json({ message: "Error fetching financial summary." });
  }
};

const getTodaysCheckInOutStatus = async (req, res) => {
  try {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    const checkIns = await Attendance.countDocuments({
      direction: 'IN',
      timestamp: { $gte: startOfDay, $lte: endOfDay }
    });

    const checkOuts = await Attendance.countDocuments({
      direction: 'OUT',
      timestamp: { $gte: startOfDay, $lte: endOfDay }
    });

    return res.json({
      checkIns,
      checkOuts
    });
  } catch (err) {
    console.error("Error fetching today's check-in/check-out data:", err);
    return res.status(500).json({ message: "Error fetching data." });
  }
};

const getBedOccupancyStatus = async (req, res) => {
  try {
    const bedCriteria = {
      $or: [
        { category: { $in: ['Furniture', 'BEDS', 'Bed'] } },
        { itemName: { $regex: /Bed|B\d+/i } }
      ],
      locationCategory: 'Residential Room',
      floor: { $nin: ['3', '03', '3rd', 'Floor 3', 'Third'] }
    };

    const totalBeds = await Inventory.countDocuments(bedCriteria);
    const occupiedBeds = await Inventory.countDocuments({ ...bedCriteria, status: 'In Use' });
    const availableBeds = await Inventory.countDocuments({ ...bedCriteria, status: 'Available' });

    return res.json({
      totalBeds,
      occupiedBeds,
      availableBeds
    });
  } catch (err) {
    console.error("Error fetching bed occupancy data:", err);
    return res.status(500).json({ message: "Error fetching data." });
  }
};
const getQuickStats = async (req, res) => {
  try {
    const totalStudents = await Student.countDocuments({ isWorking: { $ne: true } });
    const totalWorkers = await Student.countDocuments({ isWorking: true });
    const totalParents = await Parent.countDocuments();

    const totalRooms = await Inventory.countDocuments({
      itemName: { $regex: /^Room/i }
    });

    const activeStaff = await Warden.countDocuments({
      status: "active"
    });

    const pendingLeaves = await Leave.countDocuments({ status: "pending" });
    const pendingComplaints = await Complaint.countDocuments({ status: "pending" });

    return res.json({
      totalStudents,
      totalWorkers,
      totalParents,
      totalRooms,
      activeStaff,
      pendingTasks: pendingLeaves + pendingComplaints,
      pendingLeaves,
      pendingComplaints
    });

  } catch (err) {
    return res.status(500).json({
      message: "Failed to fetch quick stats"
    });
  }
};

export{
    getTodaysCheckInOutStatus,
    getBedOccupancyStatus,
    getTotalRevenue,
    getPendingPayments,
    getFinancialSummary,
    getQuickStats
}