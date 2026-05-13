import 'dotenv/config';
import nodemailer from 'nodemailer';
import { Student } from '../../models/student.model.js';
import { Warden } from '../../models/warden.model.js';
import { createAuditLog, AuditActionTypes } from '../../utils/auditLogger.js';
import { StudentInvoice } from '../../models/studentInvoice.model.js';
import { ManagementInvoice } from '../../models/managementInvoice.model.js';
import { StaffSalary } from '../../models/staffSalary.model.js';
import { Refund } from '../../models/refund.model.js';
import { sendBulkNotifications, sendNotification } from '../../utils/sendNotification.js';
import razorpay from '../../config/razorpay.config.js';
import crypto from 'crypto';

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

const generateStudentInvoice = async (req, res) => {
  const { studentId, amount, invoiceType, dueDate, description } = req.body;

  try {
    // Find student
    const student = await Student.findOne({ studentId });
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    // Generate invoice number
    const invoiceCount = await StudentInvoice.countDocuments();
    const invoiceNumber = `INV-${Date.now()}-${(invoiceCount + 1).toString().padStart(4, '0')}`;

    // Create invoice
    const newInvoice = new StudentInvoice({
      studentId: student._id,
      invoiceNumber,
      amount,
      invoiceType,
      dueDate: new Date(dueDate),
      description,
      generatedBy: req.admin?._id
    });

    await newInvoice.save();

    // Create audit log
    await createAuditLog({
      adminId: req.admin?._id,
      adminName: req.admin?.adminId || 'System',
      actionType: 'Invoice Generated',
      description: `Generated invoice ${invoiceNumber} for ${student.studentName} - ₹${amount}`,
      targetType: 'Invoice',
      targetId: invoiceNumber,
      targetName: `${student.studentName} - ${invoiceType}`
    });

    return res.json({
      message: "Invoice generated successfully",
      invoice: {
        invoiceNumber,
        studentName: student.studentName,
        amount,
        dueDate,
        status: 'pending'
      }
    });

  } catch (err) {
    console.error("Generate invoice error:", err);
    return res.status(500).json({ message: "Error generating invoice." });
  }
};

const getStudentInvoices = async (req, res) => {
  try {
    const { status, page = 1, limit = 10, search, studentId } = req.query;

    let query = {};
    if (status && status !== 'all') {
      query.status = status;
    }
    if (studentId) {
      query.studentId = studentId;
    }

    const skip = (page - 1) * limit;

    // Get invoices with student details
    const invoices = await StudentInvoice.find(query)
      .populate('studentId', 'firstName lastName studentId roomBedNumber email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Filter by search if provided
    let filteredInvoices = invoices;
    if (search) {
      filteredInvoices = invoices.filter(invoice =>
        invoice.studentId?.studentName?.toLowerCase().includes(search.toLowerCase()) ||
        invoice.invoiceNumber.toLowerCase().includes(search.toLowerCase())
      );
    }

    const totalInvoices = await StudentInvoice.countDocuments(query);

    return res.json({
      message: "Student invoices fetched successfully",
      invoices: filteredInvoices.map(invoice => ({
        _id: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        studentName: invoice.studentId?.studentName || 'Unknown',
        roomNumber: invoice.studentId?.roomBedNumber || 'N/A',
        amount: invoice.amount,
        dueDate: invoice.dueDate,
        status: invoice.status,
        invoiceType: invoice.invoiceType,
        paidDate: invoice.paidDate,
        studentId: invoice.studentId?._id
      })),
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalInvoices / limit),
        totalInvoices
      }
    });

  } catch (err) {
    console.error("Get student invoices error:", err);
    return res.status(500).json({ message: "Error fetching student invoices." });
  }
};

const updateStudentInvoiceStatus = async (req, res) => {
  const { invoiceId } = req.params;
  const { status, paymentMethod, paidAmountToAdd } = req.body;

  try {
    const invoice = await StudentInvoice.findById(invoiceId)
      .populate('studentId', 'firstName lastName studentId email');

    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    const studentDisplayName = `${invoice.studentId?.firstName || ""} ${invoice.studentId?.lastName || ""}`.trim() || invoice.studentId?.studentId || "Student";

    // Handle partial payment logic
    if (paidAmountToAdd && Number(paidAmountToAdd) > 0) {
      invoice.paidAmount = (invoice.paidAmount || 0) + Number(paidAmountToAdd);
      invoice.paymentMethod = paymentMethod || invoice.paymentMethod;
      
      // If fully paid, update status
      if (invoice.paidAmount >= invoice.amount) {
        invoice.status = 'paid';
        invoice.paidDate = new Date();
      } else {
        invoice.status = 'pending'; // Keep as pending if partial
      }
    } else if (status) {
      // Direct status update
      invoice.status = status;
      if (status === 'paid') {
        invoice.paidAmount = invoice.amount; // Full payment
        invoice.paidDate = new Date();
        invoice.paymentMethod = paymentMethod || invoice.paymentMethod;
      }
    }

    await invoice.save();

    // Create audit log
    await createAuditLog({
      adminId: req.admin?._id,
      adminName: req.admin?.adminId || 'System',
      actionType: `Invoice ${invoice.status.toUpperCase()}`,
      description: `Updated invoice ${invoice.invoiceNumber} for ${studentDisplayName}. Paid: ₹${invoice.paidAmount}/${invoice.amount}`,
      targetType: 'Invoice',
      targetId: invoice.invoiceNumber,
      targetName: `${studentDisplayName} - ₹${invoice.amount}`
    });

    return res.json({
      message: `Invoice updated successfully`,
      invoice
    });

  } catch (err) {
    console.error("Update invoice status error:", err);
    return res.status(500).json({ message: "Error updating invoice status." });
  }
};

// ====================== MANAGEMENT INVOICES ======================

const createManagementInvoice = async (req, res) => {
  const { vendorName, itemDescription, amount, category, purchaseDate } = req.body;

  try {
    // Generate invoice number
    const invoiceCount = await ManagementInvoice.countDocuments();
    const invoiceNumber = `MGT-${Date.now()}-${(invoiceCount + 1).toString().padStart(4, '0')}`;

    const newInvoice = new ManagementInvoice({
      invoiceNumber,
      vendorName,
      itemDescription,
      amount,
      category,
      purchaseDate: new Date(purchaseDate),
      processedBy: req.admin?._id
    });

    await newInvoice.save();

    // Create audit log
    await createAuditLog({
      adminId: req.admin?._id,
      adminName: req.admin?.adminId || 'System',
      actionType: 'Management Invoice Created',
      description: `Created management invoice ${invoiceNumber} for ${vendorName} - ₹${amount}`,
      targetType: 'Management Invoice',
      targetId: invoiceNumber,
      targetName: `${vendorName} - ${itemDescription}`
    });

    return res.json({
      message: "Management invoice created successfully",
      invoice: {
        invoiceNumber,
        vendorName,
        amount,
        status: 'pending'
      }
    });

  } catch (err) {
    console.error("Create management invoice error:", err);
    return res.status(500).json({ message: "Error creating management invoice." });
  }
};

const getManagementInvoices = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;

    let query = {};
    if (status && status !== 'all') {
      query.status = status;
    }

    const skip = (page - 1) * limit;

    const invoices = await ManagementInvoice.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalInvoices = await ManagementInvoice.countDocuments(query);

    return res.json({
      message: "Management invoices fetched successfully",
      invoices: invoices.map(invoice => ({
        _id: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        vendorName: invoice.vendorName,
        itemDescription: invoice.itemDescription,
        amount: invoice.amount,
        category: invoice.category,
        purchaseDate: invoice.purchaseDate,
        status: invoice.status
      })),
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalInvoices / limit),
        totalInvoices
      }
    });

  } catch (err) {
    console.error("Get management invoices error:", err);
    return res.status(500).json({ message: "Error fetching management invoices." });
  }
};

const updateManagementInvoiceStatus = async (req, res) => {
  const { invoiceId } = req.params;
  const { status, adminNotes } = req.body;

  try {
    const invoice = await ManagementInvoice.findById(invoiceId);

    if (!invoice) {
      return res.status(404).json({ message: "Management invoice not found" });
    }

    invoice.status = status;
    if (adminNotes) {
      invoice.adminNotes = adminNotes;
    }
    if (status === 'approved') {
      invoice.paymentDate = new Date();
    }

    await invoice.save();

    // Create audit log
    await createAuditLog({
      adminId: req.admin?._id,
      adminName: req.admin?.adminId || 'System',
      actionType: `Management Invoice ${status.charAt(0).toUpperCase() + status.slice(1)}`,
      description: `${status} management invoice ${invoice.invoiceNumber} for ${invoice.vendorName}`,
      targetType: 'Management Invoice',
      targetId: invoice.invoiceNumber,
      targetName: `${invoice.vendorName} - ₹${invoice.amount}`
    });

    return res.json({
      message: `Management invoice ${status} successfully`,
      invoice: {
        invoiceNumber: invoice.invoiceNumber,
        status: invoice.status
      }
    });

  } catch (err) {
    console.error("Update management invoice status error:", err);
    return res.status(500).json({ message: "Error updating management invoice status." });
  }
};


const generateStaffSalary = async (req, res) => {
  console.log("💰 Processing salary request:", req.body);
  const { 
    staffId, 
    month, 
    year, 
    basicSalary, 
    allowances = 0, 
    deductions = 0, 
    tax = 0, 
    pf = 0, 
    loanDeduction = 0,
    paymentMethod = 'bank_transfer',
    bankName = '',
    accountNumber = '',
    ifscCode = ''
  } = req.body;

  try {
    // Basic validation
    if (!staffId || !month || !year || basicSalary === undefined) {
      console.log("❌ Validation failed: missing fields");
      return res.status(400).json({ message: "Missing required fields: staffId, month, year, or basicSalary" });
    }

    // Find staff member
    const staff = await Warden.findById(staffId);
    if (!staff) {
      console.log("❌ Warden not found:", staffId);
      return res.status(404).json({ message: "Staff member (Warden) not found" });
    }

    // Check if salary already exists for this month/year
    const existingSalary = await StaffSalary.findOne({ staffId, month, year });
    if (existingSalary) {
      console.log("❌ Salary already exists for this period");
      return res.status(400).json({ message: `Salary already generated for ${staff.firstName} in ${month}` });
    }

    // Ensure all values are numbers
    const bSalary = Number(basicSalary);
    const allow = Number(allowances);
    const ded = Number(deductions);
    const t = Number(tax);
    const p = Number(pf);
    const loan = Number(loanDeduction);

    if (isNaN(bSalary) || isNaN(allow) || isNaN(ded)) {
      console.log("❌ Invalid numeric values");
      return res.status(400).json({ message: "Invalid numeric values provided" });
    }

    // Calculate net salary
    const netSalary = bSalary + allow - ded - t - p - loan;

    const newSalary = new StaffSalary({
      staffId,
      month,
      year,
      basicSalary: bSalary,
      allowances: allow,
      deductions: ded,
      tax: t,
      pf: p,
      loanDeduction: loan,
      netSalary,
      paymentMethod,
      bankName,
      accountNumber,
      ifscCode,
      processedBy: req.admin?._id
    });

    await newSalary.save();
    console.log("✅ Salary saved successfully");

    // Create audit log
    await createAuditLog({
      adminId: req.admin?._id,
      adminName: req.admin?.adminId || 'System',
      actionType: 'Salary Generated',
      description: `Generated salary for ${staff.firstName} ${staff.lastName} for ${month}/${year} - ₹${netSalary}`,
      targetType: 'Salary',
      targetId: newSalary._id.toString(),
      targetName: `${staff.firstName} ${staff.lastName} - ${month}/${year}`
    });

    return res.json({
      success: true,
      message: "Staff salary generated successfully",
      salary: {
        _id: newSalary._id,
        staffName: `${staff.firstName} ${staff.lastName}`,
        month,
        year,
        basicSalary: bSalary,
        netSalary,
        status: 'pending',
        bankName,
        accountNumber,
        ifscCode,
        paymentMethod
      }
    });

  } catch (err) {
    console.error("🔥 Generate staff salary error:", err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: err.message });
    }
    if (err.code === 11000) {
      return res.status(400).json({ message: "Duplicate salary record detected" });
    }
    return res.status(500).json({ message: "Error generating staff salary." });
  }
};

const getStaffSalaries = async (req, res) => {
  try {
    const { month, year, status, page = 1, limit = 10 } = req.query;

    let query = {};
    if (month) query.month = month;
    if (year) query.year = parseInt(year);
    if (status && status !== 'all') query.status = status;

    const skip = (page - 1) * limit;

    const salaries = await StaffSalary.find(query)
      .populate('staffId', 'firstName lastName wardenId email')
      .populate('processedBy', 'firstName lastName adminId')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalSalaries = await StaffSalary.countDocuments(query);

    // Calculate totals for the current query
    const totals = await StaffSalary.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalPayroll: { $sum: '$basicSalary' },
          totalDeductions: { $sum: { $add: ['$deductions', '$tax', '$pf', '$loanDeduction'] } },
          totalPayout: { $sum: '$netSalary' }
        }
      }
    ]);

    return res.json({
      success: true,
      message: "Staff salaries fetched successfully",
      salaries: salaries.map(salary => ({
        _id: salary._id,
        staffName: `${salary.staffId.firstName} ${salary.staffId.lastName}`,
        role: 'Warden', // You can add role field to Warden model later
        month: salary.month,
        year: salary.year,
        basicSalary: salary.basicSalary,
        tax: salary.tax,
        pf: salary.pf,
        loanDeduction: salary.loanDeduction,
        netSalary: salary.netSalary,
        status: salary.status,
        paymentDate: salary.paymentDate,
        bankName: salary.bankName,
        accountNumber: salary.accountNumber,
        ifscCode: salary.ifscCode,
        paymentMethod: salary.paymentMethod,
        processedByName: salary.processedBy ? `${salary.processedBy.firstName} ${salary.processedBy.lastName}` : 'System Admin'
      })),
      totals: {
        totalPayroll: totals[0]?.totalPayroll || 0,
        totalDeductions: totals[0]?.totalDeductions || 0,
        totalPayout: totals[0]?.totalPayout || 0
      },
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalSalaries / limit),
        totalSalaries
      }
    });

  } catch (err) {
    console.error("Get staff salaries error:", err);
    return res.status(500).json({ message: "Error fetching staff salaries." });
  }
};

const updateSalaryStatus = async (req, res) => {
  const { salaryId } = req.params;
  const { status, paymentMethod } = req.body;

  try {
    const salary = await StaffSalary.findById(salaryId)
      .populate('staffId', 'firstName lastName wardenId');

    if (!salary) {
      return res.status(404).json({ message: "Salary record not found" });
    }

    salary.status = status;
    if (status === 'paid') {
      salary.paymentDate = new Date();
      salary.paymentMethod = paymentMethod;
    }

    await salary.save();

    // Create audit log
    await createAuditLog({
      adminId: req.admin?._id,
      adminName: req.admin?.adminId || 'System',
      actionType: `Salary ${status.charAt(0).toUpperCase() + status.slice(1)}`,
      description: `Marked salary as ${status} for ${salary.staffId.firstName} ${salary.staffId.lastName} - ₹${salary.netSalary}`,
      targetType: 'Salary',
      targetId: salaryId,
      targetName: `${salary.staffId.firstName} ${salary.staffId.lastName} - ${salary.month}/${salary.year}`
    });

    return res.json({
      message: `Salary marked as ${status} successfully`,
      salary: {
        staffName: `${salary.staffId.firstName} ${salary.staffId.lastName}`,
        status: salary.status,
        paymentDate: salary.paymentDate
      }
    });

  } catch (err) {
    console.error("Update salary status error:", err);
    return res.status(500).json({ message: "Error updating salary status." });
  }
};

const generateSalarySlip = async (req, res) => {
  const { salaryId } = req.params;

  try {
    const salary = await StaffSalary.findById(salaryId)
      .populate('staffId', 'firstName lastName wardenId email contactNumber');

    if (!salary) {
      return res.status(404).json({ message: "Salary record not found" });
    }

    // Generate detailed salary slip data
    const salarySlip = {
      staffDetails: {
        name: `${salary.staffId.firstName} ${salary.staffId.lastName}`,
        id: salary.staffId.wardenId,
        email: salary.staffId.email,
        contact: salary.staffId.contactNumber
      },
      salaryDetails: {
        month: salary.month,
        year: salary.year,
        basicSalary: salary.basicSalary,
        allowances: salary.allowances,
        grossSalary: salary.basicSalary + salary.allowances,
        deductions: {
          tax: salary.tax,
          pf: salary.pf,
          loanDeduction: salary.loanDeduction,
          otherDeductions: salary.deductions,
          totalDeductions: salary.tax + salary.pf + salary.loanDeduction + salary.deductions
        },
        netSalary: salary.netSalary,
        paymentDate: salary.paymentDate,
        status: salary.status
      },
      generatedAt: new Date(),
      generatedBy: req.admin?.adminId
    };

    return res.json({
      message: "Salary slip generated successfully",
      salarySlip
    });

  } catch (err) {
    console.error("Generate salary slip error:", err);
    return res.status(500).json({ message: "Error generating salary slip." });
  }
};

// ====================== REFUND MANAGEMENT ======================

const initiateRefund = async (req, res) => {
  const { studentId, amount, reason, paymentMethod } = req.body;

  try {
    // Find student
    const student = await Student.findOne({ studentId });
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    // Generate refund ID
    const refundCount = await Refund.countDocuments();
    const refundId = `REF-${Date.now()}-${(refundCount + 1).toString().padStart(4, '0')}`;

    const newRefund = new Refund({
      refundId,
      studentId: student._id,
      amount,
      reason,
      paymentMethod,
      processedBy: req.admin?._id
    });

    await newRefund.save();

    // Create audit log
    await createAuditLog({
      adminId: req.admin?._id,
      adminName: req.admin?.adminId || 'System',
      actionType: 'Refund Initiated',
      description: `Initiated refund ${refundId} for ${student.studentName} - ₹${amount}`,
      targetType: 'Refund',
      targetId: refundId,
      targetName: `${student.studentName} - ₹${amount}`
    });

    return res.json({
      message: "Refund initiated successfully",
      refund: {
        refundId,
        studentName: student.studentName,
        amount,
        status: 'pending'
      }
    });

  } catch (err) {
    console.error("Initiate refund error:", err);
    return res.status(500).json({ message: "Error initiating refund." });
  }
};

const getRefunds = async (req, res) => {
  try {
    const { status, page = 1, limit = 10, search } = req.query;

    let query = {};
    if (status && status !== 'all') {
      query.status = status;
    }

    const skip = (page - 1) * limit;

    const refunds = await Refund.find(query)
      .populate('studentId', 'studentName studentId')
      .populate('processedBy', 'adminId')
      .sort({ requestDate: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Filter by search if provided
    let filteredRefunds = refunds;
    if (search) {
      filteredRefunds = refunds.filter(refund =>
        refund.studentId?.studentName?.toLowerCase().includes(search.toLowerCase()) ||
        refund.refundId.toLowerCase().includes(search.toLowerCase())
      );
    }

    const totalRefunds = await Refund.countDocuments(query);

    return res.json({
      message: "Refunds fetched successfully",
      refunds: filteredRefunds.map(refund => ({
        _id: refund._id,
        refundId: refund.refundId,
        date: refund.requestDate,
        recipientName: refund.studentId?.studentName || 'Unknown',
        amount: refund.amount,
        reason: refund.reason,
        status: refund.status,
        processedBy: refund.processedBy?.adminId || 'N/A',
        processedDate: refund.processedDate,
        paymentMethod: refund.paymentMethod
      })),
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalRefunds / limit),
        totalRefunds
      }
    });

  } catch (err) {
    console.error("Get refunds error:", err);
    return res.status(500).json({ message: "Error fetching refunds." });
  }
};

const updateRefundStatus = async (req, res) => {
  const { refundId } = req.params;
  const { status, adminNotes, paymentMethod } = req.body;

  try {
    const refund = await Refund.findById(refundId)
      .populate('studentId', 'studentName studentId email');

    if (!refund) {
      return res.status(404).json({ message: "Refund not found" });
    }

    refund.status = status;
    if (adminNotes) {
      refund.adminNotes = adminNotes;
    }
    if (status === 'completed') {
      refund.processedDate = new Date();
      refund.paymentMethod = paymentMethod;
    }
    refund.processedBy = req.admin?._id;

    await refund.save();

    // Send email notification to student
    try {
      const statusText = status.toUpperCase();
      const statusEmoji = status === 'completed' ? '✅' : status === 'rejected' ? '❌' : '🔄';

      await transporter.sendMail({
        from: `"Hostel Admin" <${process.env.MAIL_USER}>`,
        to: refund.studentId.email,
        subject: `Refund Request ${statusText} - ${refund.refundId}`,
        text: `Hello ${refund.studentId.studentName},

${statusEmoji} Your refund request has been ${status}.

Refund Details:
• Refund ID: ${refund.refundId}
• Amount: ₹${refund.amount}
• Reason: ${refund.reason}
• Status: ${statusText}
${status === 'completed' ? `• Payment Method: ${paymentMethod}` : ''}
${adminNotes ? `• Admin Notes: ${adminNotes}` : ''}

Request Date: ${new Date(refund.requestDate).toLocaleDateString("en-IN")}
${status === 'completed' ? `Processed Date: ${new Date().toLocaleDateString("en-IN")}` : ''}

${status === 'completed' ?
            'Your refund has been processed successfully.' :
            status === 'rejected' ?
              'If you have any questions regarding this decision, please contact the hostel administration.' :
              'Your refund is being processed. You will be notified once completed.'}

– Hostel Admin`
      });
    } catch (emailErr) {
      console.error("Refund email error:", emailErr);
    }

    // Create audit log
    await createAuditLog({
      adminId: req.admin?._id,
      adminName: req.admin?.adminId || 'System',
      actionType: `Refund ${status.charAt(0).toUpperCase() + status.slice(1)}`,
      description: `${status} refund ${refund.refundId} for ${refund.studentId.studentName} - ₹${refund.amount}`,
      targetType: 'Refund',
      targetId: refund.refundId,
      targetName: `${refund.studentId.studentName} - ₹${refund.amount}`
    });

    // 🔔 Send in-app notification
    try {
      await sendNotification({
        studentId: refund.studentId._id,
        message: `Your refund request has been ${status.toUpperCase()}`,
        type: 'refund',
        link: '/refunds',
      });
    } catch (notifErr) {
      console.error("Failed to send refund notification:", notifErr);
    }

    return res.json({
      success: true,
      message: `Refund ${status} successfully`
    });

  } catch (err) {
    console.error("Update refund status error:", err);
    return res.status(500).json({ message: "Error updating refund status." });
  }
};

// ====================== RAZORPAY INTEGRATION ======================

const createRazorpayOrder = async (req, res) => {
  const { amount, currency = 'INR', receiptId, type } = req.body;

  try {
    const options = {
      amount: Math.round(amount * 100), // amount in the smallest currency unit
      currency,
      receipt: receiptId,
      notes: {
        type: type // 'student_invoice' or 'staff_salary'
      }
    };

    const order = await razorpay.orders.create(options);

    return res.json({
      success: true,
      order
    });
  } catch (err) {
    console.error("Create Razorpay order error:", err);
    return res.status(500).json({ message: "Error creating payment order." });
  }
};

const verifyRazorpayPayment = async (req, res) => {
  const { 
    razorpay_order_id, 
    razorpay_payment_id, 
    razorpay_signature,
    id, // Invoice ID or Salary ID
    type // 'student_invoice' or 'staff_salary'
  } = req.body;

  try {
    // 1. Verify signature
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest('hex');

    const isSignatureValid = expectedSignature === razorpay_signature;

    if (!isSignatureValid) {
      return res.status(400).json({ success: false, message: "Invalid payment signature" });
    }

    // 2. Update the record
    if (type === 'student_invoice') {
      const invoice = await StudentInvoice.findById(id).populate('studentId');
      if (!invoice) return res.status(404).json({ message: "Invoice not found" });

      invoice.status = 'paid';
      invoice.paidDate = new Date();
      invoice.paymentMethod = 'razorpay';
      invoice.razorpayPaymentId = razorpay_payment_id;
      invoice.razorpayOrderId = razorpay_order_id;
      await invoice.save();

      // Audit Log
      await createAuditLog({
        adminId: req.admin?._id,
        adminName: req.admin?.adminId || 'System',
        actionType: 'Invoice Paid (Razorpay)',
        description: `Invoice ${invoice.invoiceNumber} paid via Razorpay by ${invoice.studentId?.studentName}`,
        targetType: 'Invoice',
        targetId: invoice.invoiceNumber,
        targetName: invoice.studentId?.studentName
      });

    } else if (type === 'staff_salary') {
      const salary = await StaffSalary.findById(id).populate('staffId');
      if (!salary) return res.status(404).json({ message: "Salary record not found" });

      salary.status = 'paid';
      salary.paymentDate = new Date();
      salary.paymentMethod = 'razorpay';
      salary.razorpayPaymentId = razorpay_payment_id;
      salary.razorpayOrderId = razorpay_order_id;
      await salary.save();

      // Audit Log
      await createAuditLog({
        adminId: req.admin?._id,
        adminName: req.admin?.adminId || 'System',
        actionType: 'Salary Paid (Razorpay)',
        description: `Salary paid via Razorpay to ${salary.staffId?.firstName} ${salary.staffId?.lastName}`,
        targetType: 'Salary',
        targetId: salary._id.toString(),
        targetName: `${salary.staffId?.firstName} ${salary.staffId?.lastName}`
      });
    }

    return res.json({
      success: true,
      message: "Payment verified and record updated successfully"
    });

  } catch (err) {
    console.error("Verify Razorpay payment error:", err);
    return res.status(500).json({ message: "Error verifying payment." });
  }
};

export {
  generateStudentInvoice,
  getStudentInvoices,
  updateStudentInvoiceStatus,
  createManagementInvoice,
  getManagementInvoices,
  updateManagementInvoiceStatus,
  generateStaffSalary,
  getStaffSalaries,
  updateSalaryStatus,
  generateSalarySlip,
  initiateRefund,
  getRefunds,
  updateRefundStatus,
  createRazorpayOrder,
  verifyRazorpayPayment
}