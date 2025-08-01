import 'dotenv/config';
import { Student } from '../../models/student.model.js';
import { StudentInvoice } from '../../models/studentInvoice.model.js';


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
    const pendingPayments = await StudentInvoice.aggregate([
      { $match: { status: 'pending' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    // Also get count of pending invoices
    const pendingCount = await StudentInvoice.countDocuments({ status: 'pending' });

    return res.json({
      message: "Pending payments fetched successfully",
      pendingPayments: pendingPayments[0]?.total || 0,
      pendingInvoicesCount: pendingCount
    });

  } catch (err) {
    console.error("Get pending payments error:", err);
    return res.status(500).json({ message: "Error fetching pending payments." });
  }
};

const getFinancialSummary = async (req, res) => {
  try {
    // Get total revenue
    const totalRevenue = await StudentInvoice.aggregate([
      { $match: { status: 'paid' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    // Get pending payments
    const pendingPayments = await StudentInvoice.aggregate([
      { $match: { status: 'pending' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    // Get overdue payments (past due date)
    const today = new Date();
    const overduePayments = await StudentInvoice.aggregate([
      { 
        $match: { 
          status: 'pending',
          dueDate: { $lt: today }
        } 
      },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    // Get counts
    const totalInvoices = await StudentInvoice.countDocuments();
    const paidInvoices = await StudentInvoice.countDocuments({ status: 'paid' });
    const pendingInvoices = await StudentInvoice.countDocuments({ status: 'pending' });
    const overdueInvoices = await StudentInvoice.countDocuments({ 
      status: 'pending',
      dueDate: { $lt: today }
    });

    return res.json({
      message: "Financial summary fetched successfully",
      revenue: {
        totalRevenue: totalRevenue[0]?.total || 0,
        pendingPayments: pendingPayments[0]?.total || 0,
        overduePayments: overduePayments[0]?.total || 0
      },
      invoiceCounts: {
        total: totalInvoices,
        paid: paidInvoices,
        pending: pendingInvoices,
        overdue: overdueInvoices
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
    const totalBeds = 75

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

export{
    getTodaysCheckInOutStatus,
    getBedOccupancyStatus,
    getTotalRevenue,
    getPendingPayments,
    getFinancialSummary
}