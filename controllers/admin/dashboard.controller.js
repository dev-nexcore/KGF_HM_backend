import 'dotenv/config';
import { Student } from '../../models/student.model.js';
import { StudentInvoice } from '../../models/studentInvoice.model.js';
import { Inventory } from '../../models/inventory.model.js';
import { StaffSalary } from '../../models/staffSalary.model.js';


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
      { $match: { status: 'pending' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    // Get pending salaries
    const pendingSalaries = await StaffSalary.aggregate([
      { $match: { status: 'pending' } },
      { $group: { _id: null, total: { $sum: '$netSalary' } } }
    ]);

    const totalPending = (pendingInvoices[0]?.total || 0) + (pendingSalaries[0]?.total || 0);

    return res.json({
      message: "Pending payments fetched successfully",
      pendingPayments: totalPending,
      pendingInvoicesCount: await StudentInvoice.countDocuments({ status: 'pending' }),
      pendingSalariesCount: await StaffSalary.countDocuments({ status: 'pending' })
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

    // Pending Invoices (Incoming)
    const pendingInvoices = await StudentInvoice.aggregate([
      { $match: { status: 'pending' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    // Pending Salaries (Outgoing)
    const pendingSalaries = await StaffSalary.aggregate([
      { $match: { status: 'pending' } },
      { $group: { _id: null, total: { $sum: '$netSalary' } } }
    ]);

    const totalRevenue = (revenueIn[0]?.total || 0);
    const totalPending = (pendingInvoices[0]?.total || 0) + (pendingSalaries[0]?.total || 0);

    return res.json({
      message: "Financial summary fetched successfully",
      revenue: {
        totalRevenue,
        salariesPaid: salariesOut[0]?.total || 0,
        pendingPayments: totalPending,
        pendingInvoices: pendingInvoices[0]?.total || 0,
        pendingSalaries: pendingSalaries[0]?.total || 0
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

    // Get all students
    const students = await Student.find({}, { attendanceLog: 1 });

    let checkIns = 0;
    let checkOuts = 0;

    students.forEach((student) => {
      student.attendanceLog?.forEach((entry) => {
        const checkIn = entry.checkInDate ? new Date(entry.checkInDate) : null;
        const checkOut = entry.checkOutDate ? new Date(entry.checkOutDate) : null;

        if (checkIn && checkIn >= startOfDay && checkIn <= endOfDay) {
          checkIns++;
        }

        if (checkOut && checkOut >= startOfDay && checkOut <= endOfDay) {
          checkOuts++;
        }
      });
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
    // Get all students with a room number
    const totalBeds = await Inventory.countDocuments({ itemName: { $regex: /^Bed/i } });

    // Get the number of students who have checked in
   const occupiedBeds = await Student.countDocuments({ roomBedNumber: { $ne: null } });

    const availableBeds = totalBeds - occupiedBeds;

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
    const totalStudents = await Student.countDocuments();

    const totalRooms = await Inventory.countDocuments({
      itemName: { $regex: /^Room/i }
    });

    const activeStaff = await Warden.countDocuments({
      status: "active"
    });

    const pendingTasks =
      await Complaint.countDocuments({ status: "pending" }) +
      await Leave.countDocuments({ status: "pending" });

    return res.json({
      totalStudents,
      totalRooms,
      activeStaff,
      pendingTasks
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
    getFinancialSummary
}