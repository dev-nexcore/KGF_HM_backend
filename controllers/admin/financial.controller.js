import 'dotenv/config';
import nodemailer from 'nodemailer';
import { Student } from '../../models/student.model.js';
import { Warden } from '../../models/warden.model.js';
import { createAuditLog, AuditActionTypes } from '../../utils/auditLogger.js';
import { StudentInvoice } from '../../models/studentInvoice.model.js';
import { ManagementInvoice } from '../../models/managementInvoice.model.js';
import { StaffSalary } from '../../models/staffSalary.model.js';
import { Refund } from '../../models/refund.model.js';
// configure SMTP transporter
const transporter = nodemailer.createTransport({

    host:    process.env.MAIL_HOST,      // smtp.gmail.com
  port:   +process.env.MAIL_PORT,      // 587
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
    const { status, page = 1, limit = 10, search } = req.query;

    let query = {};
    if (status && status !== 'all') {
      query.status = status;
    }

    const skip = (page - 1) * limit;

    // Get invoices with student details
    const invoices = await StudentInvoice.find(query)
      .populate('studentId', 'studentName studentId roomBedNumber email')
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
        paidDate: invoice.paidDate
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
  const { status, paymentMethod, adminNotes } = req.body;

  try {
    const invoice = await StudentInvoice.findById(invoiceId)
      .populate('studentId', 'studentName studentId email');

    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    // Update invoice
    invoice.status = status;
    if (status === 'paid') {
      invoice.paidDate = new Date();
      invoice.paymentMethod = paymentMethod;
    }
    
    await invoice.save();

    // Create audit log
    await createAuditLog({
      adminId: req.admin?._id,
      adminName: req.admin?.adminId || 'System',
      actionType: `Invoice ${status.charAt(0).toUpperCase() + status.slice(1)}`,
      description: `Marked invoice ${invoice.invoiceNumber} as ${status} for ${invoice.studentId.studentName}`,
      targetType: 'Invoice',
      targetId: invoice.invoiceNumber,
      targetName: `${invoice.studentId.studentName} - ₹${invoice.amount}`
    });

    return res.json({
      message: `Invoice marked as ${status} successfully`,
      invoice: {
        invoiceNumber: invoice.invoiceNumber,
        status: invoice.status,
        paidDate: invoice.paidDate
      }
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
  const { staffId, month, year, basicSalary, allowances, deductions, tax, pf, loanDeduction } = req.body;

  try {
    // Find staff member
    const staff = await Warden.findById(staffId);
    if (!staff) {
      return res.status(404).json({ message: "Staff member not found" });
    }

    // Check if salary already exists for this month/year
    const existingSalary = await StaffSalary.findOne({ staffId, month, year });
    if (existingSalary) {
      return res.status(400).json({ message: "Salary already generated for this month" });
    }

    // Calculate net salary
    const netSalary = basicSalary + allowances - deductions - tax - pf - loanDeduction;

    const newSalary = new StaffSalary({
      staffId,
      month,
      year,
      basicSalary,
      allowances,
      deductions,
      tax,
      pf,
      loanDeduction,
      netSalary,
      processedBy: req.admin?._id
    });

    await newSalary.save();

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
      message: "Staff salary generated successfully",
      salary: {
        staffName: `${staff.firstName} ${staff.lastName}`,
        month,
        year,
        netSalary,
        status: 'pending'
      }
    });

  } catch (err) {
    console.error("Generate staff salary error:", err);
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
        paymentDate: salary.paymentDate
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

    return res.json({
      message: `Refund ${status} successfully`,
      refund: {
        refundId: refund.refundId,
        studentName: refund.studentId.studentName,
        status: refund.status,
        processedDate: refund.processedDate
      }
    });

  } catch (err) {
    console.error("Update refund status error:", err);
    return res.status(500).json({ message: "Error updating refund status." });
  }
};

export{
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
    updateRefundStatus
}