import 'dotenv/config';
import QRCode from 'qrcode';

import nodemailer from 'nodemailer';

import { Student } from '../../models/student.model.js';
import { Parent } from '../../models/parent.model.js';

import { Warden } from '../../models/warden.model.js';
import { Notice } from '../../models/notice.model.js';
import { Inventory } from '../../models/inventory.model.js';

import path from 'path';
import multer from 'multer';

import { nanoid } from 'nanoid';
import { fileURLToPath } from 'url';
import fs from 'fs';

const FRONTEND_BASE_URL = process.env.FRONTEND_BASE_URL || 'http://localhost:3000';

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

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/receipts/');
  },
  filename: (req, file, cb) => {
    cb(null, `receipt-${Date.now()}${path.extname(file.originalname)}`);
  }
});
const upload = multer({ storage });

// If you use ES modules and need __dirname:
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const addInventoryItem = async (req, res) => {
  try {
    const {
      itemName,
      barcodeId,
      category,
      location,
      roomNo,
      floor,
      status,
      description,
      purchaseDate,
      purchaseCost
    } = req.body;

    // Check if barcode ID already exists
    const existingItem = await Inventory.findOne({ barcodeId });
    if (existingItem) {
      return res.status(400).json({
        success: false,
        message: 'Barcode ID already exists. Please use a unique barcode ID.'
      });
    }

    const receiptUrl = req.file ? `/uploads/receipts/${req.file.filename}` : null;
    const publicSlug = nanoid(10); // Generate unique slug for public access

    // Create new inventory item
    const newItem = new Inventory({
      itemName,
      barcodeId,
      category,
      location,
      roomNo,
      floor,
      status,
      description,
      purchaseDate,
      purchaseCost,
      receiptUrl,
      publicSlug
    });

    await newItem.save();

    // Generate QR code data (URL that will show item details)
    const qrData = `${FRONTEND_BASE_URL}/inventory/item/${publicSlug}`;

    // Ensure QR codes directory exists
    const qrCodesDir = path.join(process.cwd(), 'public', 'qrcodes');
    if (!fs.existsSync(qrCodesDir)) {
      fs.mkdirSync(qrCodesDir, { recursive: true });
    }

    // Generate QR code file
    const qrCodePath = path.join(qrCodesDir, `${newItem._id}.png`);
    await QRCode.toFile(qrCodePath, qrData, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    // Update item with QR code URL
    newItem.qrCodeUrl = `/public/qrcodes/${newItem._id}.png`;
    await newItem.save();

    // Ensure publicSlug is present in the item object
    // Ensure publicSlug is present in the item object (for both lean and hydrated docs)
    let itemWithSlug = newItem.toObject ? newItem.toObject() : { ...newItem };
    if (!itemWithSlug.publicSlug && newItem.publicSlug) {
      itemWithSlug.publicSlug = newItem.publicSlug;
    }
    return res.status(201).json({
      success: true,
      message: 'Inventory item added successfully',
      item: itemWithSlug,
      qrCodeUrl: newItem.qrCodeUrl,
      publicSlug: newItem.publicSlug,
      publicUrl: qrData
    });

  } catch (err) {
    console.error('Add Inventory Error:', err);
    return res.status(500).json({ 
      success: false,
      message: 'Failed to add inventory item.' 
    });
  }
};
const getInventoryItems = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      category, 
      status, 
      search 
    } = req.query;

    // Build filter object
    const filter = {};
    if (category && category !== 'All Categories') filter.category = category;
    if (status && status !== 'All Status') filter.status = status;
    if (search) {
      filter.$or = [
        { itemName: { $regex: search, $options: 'i' } },
        { barcodeId: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } }
      ];
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Get items with pagination
    const items = await Inventory.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalItems = await Inventory.countDocuments(filter);

    return res.json({ 
      success: true,
      items,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalItems / limit),
        totalItems,
        hasNextPage: page * limit < totalItems,
        hasPrevPage: page > 1
      }
    });
  } catch (err) {
    console.error("Error fetching inventory:", err);
    return res.status(500).json({ 
      success: false,
      message: "Failed to fetch inventory items." 
    });
  }
};

const getInventoryItemById = async (req, res) => {
  try {
    const { id } = req.params;
    const inventoryItem = await Inventory.findById(id);
    
    if (!inventoryItem) {
      return res.status(404).json({
        success: false,
        message: 'Inventory item not found'
      });
    }

    res.status(200).json({
      success: true,
      inventory: inventoryItem
    });
  } catch (error) {
    console.error('Error fetching inventory item:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching inventory item'
    });
  }
};

const getInventoryItemBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const inventoryItem = await Inventory.findOne({ publicSlug: slug });
    
    if (!inventoryItem) {
      return res.status(404).json({
        success: false,
        message: 'Inventory item not found'
      });
    }

    // Return public-safe information, including publicSlug
    const publicItemData = {
      itemName: inventoryItem.itemName,
      barcodeId: inventoryItem.barcodeId,
      category: inventoryItem.category,
      location: inventoryItem.location,
      roomNo: inventoryItem.roomNo,
      floor: inventoryItem.floor,
      status: inventoryItem.status,
      description: inventoryItem.description,
      purchaseDate: inventoryItem.purchaseDate,
      qrCodeUrl: inventoryItem.qrCodeUrl,
      publicSlug: inventoryItem.publicSlug, // <-- ensure this is returned
      // Don't expose sensitive data like purchase cost unless authorized
      lastUpdated: inventoryItem.updatedAt
    };

    res.status(200).json({
      success: true,
      item: publicItemData
    });
  } catch (error) {
    console.error('Error fetching inventory item by slug:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching inventory item'
    });
  }
};

const generateQRCode = async (req, res) => {
  try {
    const { id } = req.params;
    const inventoryItem = await Inventory.findById(id);
    
    if (!inventoryItem) {
      return res.status(404).json({
        success: false,
        message: 'Inventory item not found'
      });
    }

    // Generate public slug if it doesn't exist
    if (!inventoryItem.publicSlug) {
      inventoryItem.publicSlug = nanoid(10);
      await inventoryItem.save();
    }

    const qrData = `${FRONTEND_BASE_URL}/inventory/item/${inventoryItem.publicSlug}`;

    // Ensure QR codes directory exists
    const qrCodesDir = path.join(process.cwd(), 'public', 'qrcodes');
    if (!fs.existsSync(qrCodesDir)) {
      fs.mkdirSync(qrCodesDir, { recursive: true });
    }

    // Generate QR code file
    const qrCodePath = path.join(qrCodesDir, `${inventoryItem._id}.png`);
    await QRCode.toFile(qrCodePath, qrData, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    // Update item with QR code URL if not already set
    if (!inventoryItem.qrCodeUrl) {
      inventoryItem.qrCodeUrl = `/public/qrcodes/${inventoryItem._id}.png`;
      await inventoryItem.save();
    }

    return res.status(200).json({
      success: true,
      message: 'QR code generated successfully',
      qrCodeUrl: inventoryItem.qrCodeUrl,
      publicUrl: qrData
    });

  } catch (error) {
    console.error('Error generating QR code:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate QR code'
    });
  }
};

// Download QR code
const downloadQRCode = async (req, res) => {
  try {
    const { id } = req.params;
    const inventoryItem = await Inventory.findById(id);
    
    if (!inventoryItem || !inventoryItem.qrCodeUrl) {
      return res.status(404).json({
        success: false,
        message: 'QR code not found for this item'
      });
    }

    const qrCodePath = path.join(process.cwd(), 'public', 'qrcodes', `${id}.png`);
    
    if (!fs.existsSync(qrCodePath)) {
      return res.status(404).json({
        success: false,
        message: 'QR code file not found'
      });
    }

    // Set headers for file download
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `attachment; filename="${inventoryItem.itemName}-QR.png"`);
    
    // Send file
    res.sendFile(qrCodePath);

  } catch (error) {
    console.error('Error downloading QR code:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to download QR code'
    });
  }
};

const getAvailableBeds = async (req, res) => {
  try {
    const availableBeds = await Inventory.find({
      category: 'Furniture',
      itemName: 'Bed',
      status: 'Available'
    }).select('_id barcodeId roomNo floor location');
    
    res.status(200).json({
      success: true,
      availableBeds: availableBeds
    });
  } catch (error) {
    console.error('Error fetching available beds:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching available beds'
    });
  }
};

// Update inventory item
const updateInventoryItem = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Check if barcode ID is being updated and if it already exists
    if (updateData.barcodeId) {
      const existingItem = await Inventory.findOne({ 
        barcodeId: updateData.barcodeId,
        _id: { $ne: id }
      });
      
      if (existingItem) {
        return res.status(400).json({
          success: false,
          message: 'Barcode ID already exists. Please use a unique barcode ID.'
        });
      }
    }

    const updatedItem = await Inventory.findByIdAndUpdate(
      id, 
      updateData, 
      { new: true, runValidators: true }
    );
    
    if (!updatedItem) {
      return res.status(404).json({ 
        success: false,
        message: "Item not found" 
      });
    }

    res.json({ 
      success: true,
      message: "Inventory item updated successfully", 
      item: updatedItem 
    });
  } catch (err) {
    console.error("Error updating inventory:", err);
    res.status(500).json({ 
      success: false,
      message: "Failed to update inventory item" 
    });
  }
};

// Update inventory receipt
const updateInventoryReceipt = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!req.file) {
      return res.status(400).json({ 
        success: false,
        message: "No receipt uploaded" 
      });
    }

    const updatedItem = await Inventory.findByIdAndUpdate(
      id,
      { receiptUrl: `/uploads/receipts/${req.file.filename}` },
      { new: true }
    );

    if (!updatedItem) {
      return res.status(404).json({ 
        success: false,
        message: "Item not found" 
      });
    }

    res.json({ 
      success: true,
      message: "Receipt uploaded successfully", 
      item: updatedItem 
    });
  } catch (err) {
    console.error("Error uploading receipt:", err);
    res.status(500).json({ 
      success: false,
      message: "Failed to upload receipt" 
    });
  }
};

// Delete inventory item
const deleteInventoryItem = async (req, res) => {
  try {
    const { id } = req.params;
    
    const inventoryItem = await Inventory.findById(id);
    if (!inventoryItem) {
      return res.status(404).json({
        success: false,
        message: 'Inventory item not found'
      });
    }

    // Delete QR code file if it exists
    if (inventoryItem.qrCodeUrl) {
      const qrCodePath = path.join(process.cwd(), 'public', 'qrcodes', `${id}.png`);
      if (fs.existsSync(qrCodePath)) {
        fs.unlinkSync(qrCodePath);
      }
    }

    // Delete receipt file if it exists
    if (inventoryItem.receiptUrl) {
      const receiptPath = path.join(process.cwd(), inventoryItem.receiptUrl);
      if (fs.existsSync(receiptPath)) {
        fs.unlinkSync(receiptPath);
      }
    }

    await Inventory.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Inventory item deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting inventory item:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete inventory item'
    });
  }
};


const issueNotice = async (req, res) => {
  const {
    template,
    title,
    message,
    issueDate,
    recipientType,
    individualRecipient
  } = req.body;

  try {
    // Validate required fields
    if (!title || !message || !issueDate || !recipientType) {
      return res.status(400).json({
        success: false,
        message: 'Title, message, issue date, and recipient type are required.'
      });
    }

    const notice = await Notice.create({
      template,
      title,
      message,
      issueDate: new Date(issueDate),
      recipientType,
      individualRecipient,
      createdBy: req.admin?._id
    });

    const subject = `Hostel Notice: ${title}`;

    const istDateTime = new Date(issueDate).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata"
    });

    const emailBody = `
${message}

Issued on: ${istDateTime}

– Hostel Admin
`;

    let recipients = [];
    let studentRecipients = [];

    if (recipientType === 'All') {
      const students = await Student.find({}, 'email');
      const parents = await Parent.find({}, 'email');
      const wardens = await Warden.find({}, 'email');

      studentRecipients = students;
      recipients = [
        ...students.map(s => s.email).filter(Boolean),
        ...parents.map(p => p.email).filter(Boolean),
        ...wardens.map(w => w.email).filter(Boolean)
      ];
    } else if (recipientType === 'Student') {
      if (!individualRecipient) {
        const students = await Student.find({}, '_id email');
        studentRecipients = students;
        recipients = students.map(s => s.email).filter(Boolean);
      } else {
        const student = await Student.findOne({ studentId: individualRecipient }, '_id email');
        if (student?.email) recipients.push(student.email);
        if (student) studentRecipients.push(student);
      }
    } else if (recipientType === 'Parent') {
      if (!individualRecipient) {
        const parents = await Parent.find({}, 'email');
        recipients = parents.map(p => p.email).filter(Boolean);
      } else {
        const parent = await Parent.findOne({ studentId: individualRecipient });
        if (parent?.email) recipients.push(parent.email);
      }
    } else if (recipientType === 'Warden') {
      if (!individualRecipient) {
        const wardens = await Warden.find({}, 'email');
        recipients = wardens.map(w => w.email).filter(Boolean);
      } else {
        const warden = await Warden.findOne({ wardenId: individualRecipient });
        if (warden?.email) recipients.push(warden.email);
      }
    }

    if (recipients.length === 0) {
      return res.status(400).json({ 
        success: false,
        message: "No recipients found to send notice." 
      });
    }

    // Send emails
    for (const email of recipients) {
      try {
        const result = await transporter.sendMail({
          from: `"Hostel Admin" <${process.env.MAIL_USER}>`,
          to: email,
          subject,
          text: emailBody
        });
        console.log(`📤 Email sent to ${email} - MessageId: ${result.messageId}`);
      } catch (emailError) {
        console.error(`Failed to send email to ${email}:`, emailError);
      }
    }

    // Send push notifications to students
    if (studentRecipients.length > 0) {
      try {
        await sendBulkNotifications(
          studentRecipients,
          `New notice: ${title}`,
          'notice',
          '/notices'
        );
      } catch (notificationError) {
        console.error('Failed to send push notifications:', notificationError);
      }
    }

    // Create audit log
    await createAuditLog({
      adminId: req.admin?._id,
      adminName: req.admin?.adminId || 'System',
      actionType: AuditActionTypes.NOTICE_ISSUED,
      description: `Issued notice: ${title} to ${recipientType}`,
      targetType: 'Notice',
      targetId: notice._id.toString(),
      targetName: title,
      additionalData: {
        recipientType,
        individualRecipient,
        recipientCount: recipients.length
      }
    });

    return res.status(201).json({ 
      success: true,
      message: "Notice issued and emailed successfully", 
      notice: {
        id: notice._id,
        title: notice.title,
        message: notice.message,
        issueDate: notice.issueDate,
        recipientType: notice.recipientType,
        individualRecipient: notice.individualRecipient,
        template: notice.template,
        status: 'Active',
        createdAt: notice.createdAt
      }
    });
  } catch (err) {
    console.error("Issue notice error:", err);
    return res.status(500).json({ 
      success: false,
      message: "Failed to issue notice" 
    });
  }
};

// GET - Get all notices
const getAllNotices = async (req, res) => {
  try {
    const {
      status,
      recipientType,
      page = 1,
      limit = 50,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter
    const filter = {};
    if (status && status !== 'All') {
      // For now, we'll determine status based on createdAt (notices older than 30 days are archived)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      if (status === 'Active') {
        filter.createdAt = { $gte: thirtyDaysAgo };
      } else if (status === 'Archived') {
        filter.createdAt = { $lt: thirtyDaysAgo };
      }
    }
    if (recipientType) filter.recipientType = recipientType;

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Get notices
    const notices = await Notice.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('createdBy', 'adminId firstName lastName');

    // Get total count
    const totalCount = await Notice.countDocuments(filter);

    // Transform data for frontend
    const transformedNotices = notices.map(notice => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      return {
        id: notice._id.toString(),
        title: notice.title,
        message: notice.message,
        template: notice.template || '',
        recipient: notice.recipientType === 'All' ? 'All (Students & Warden)' : notice.recipientType,
        individualRecipient: notice.individualRecipient || '',
        date: notice.issueDate.toLocaleDateString('en-GB'),
        issueDate: notice.issueDate,
        status: notice.createdAt >= thirtyDaysAgo ? 'Active' : 'Archived',
        readStatus: notice.readStatus || 'Unread',
        createdBy: notice.createdBy,
        createdAt: notice.createdAt,
        updatedAt: notice.updatedAt
      };
    });

    return res.json({
      success: true,
      message: 'Notices fetched successfully.',
      notices: transformedNotices,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / limit),
        totalCount,
        hasNextPage: page * limit < totalCount,
        hasPrevPage: page > 1
      }
    });
  } catch (err) {
    console.error('Error fetching notices:', err);
    return res.status(500).json({
      success: false,
      message: 'Error fetching notices.'
    });
  }
};

// GET - Get single notice by ID
const getNoticeById = async (req, res) => {
  const { noticeId } = req.params;

  try {
    const notice = await Notice.findById(noticeId)
      .populate('createdBy', 'adminId firstName lastName');

    if (!notice) {
      return res.status(404).json({
        success: false,
        message: 'Notice not found.'
      });
    }

    return res.json({
      success: true,
      message: 'Notice fetched successfully.',
      notice: {
        id: notice._id.toString(),
        title: notice.title,
        message: notice.message,
        template: notice.template,
        recipientType: notice.recipientType,
        individualRecipient: notice.individualRecipient,
        issueDate: notice.issueDate,
        readStatus: notice.readStatus,
        readBy: notice.readBy,
        createdBy: notice.createdBy,
        createdAt: notice.createdAt,
        updatedAt: notice.updatedAt
      }
    });
  } catch (err) {
    console.error('Error fetching notice:', err);
    return res.status(500).json({
      success: false,
      message: 'Error fetching notice.'
    });
  }
};

// PUT - Update notice
const updateNotice = async (req, res) => {
  const { noticeId } = req.params;
  const {
    template,
    title,
    message,
    issueDate,
    recipientType,
    individualRecipient,
    readStatus
  } = req.body;

  try {
    // Check if notice exists
    const existingNotice = await Notice.findById(noticeId);
    if (!existingNotice) {
      return res.status(404).json({
        success: false,
        message: 'Notice not found.'
      });
    }

    // Prepare update data
    const updateData = {};
    if (template !== undefined) updateData.template = template;
    if (title !== undefined) updateData.title = title;
    if (message !== undefined) updateData.message = message;
    if (issueDate !== undefined) updateData.issueDate = new Date(issueDate);
    if (recipientType !== undefined) updateData.recipientType = recipientType;
    if (individualRecipient !== undefined) updateData.individualRecipient = individualRecipient;
    if (readStatus !== undefined) updateData.readStatus = readStatus;

    // Update notice
    const updatedNotice = await Notice.findByIdAndUpdate(
      noticeId,
      updateData,
      { new: true, runValidators: true }
    ).populate('createdBy', 'adminId firstName lastName');

    // Create audit log
    await createAuditLog({
      adminId: req.admin?._id,
      adminName: req.admin?.adminId || 'System',
      actionType: AuditActionTypes.NOTICE_UPDATED,
      description: `Updated notice: ${updatedNotice.title}`,
      targetType: 'Notice',
      targetId: noticeId,
      targetName: updatedNotice.title,
      additionalData: {
        updatedFields: Object.keys(updateData),
        oldData: {
          title: existingNotice.title,
          message: existingNotice.message,
          recipientType: existingNotice.recipientType
        },
        newData: updateData
      }
    });

    return res.json({
      success: true,
      message: 'Notice updated successfully.',
      notice: updatedNotice
    });
  } catch (err) {
    console.error('Error updating notice:', err);
    return res.status(500).json({
      success: false,
      message: 'Error updating notice.'
    });
  }
};

// DELETE - Delete notice
const deleteNotice = async (req, res) => {
  const { noticeId } = req.params;

  try {
    const notice = await Notice.findById(noticeId);
    if (!notice) {
      return res.status(404).json({
        success: false,
        message: 'Notice not found.'
      });
    }

    // Store data for audit log
    const noticeData = {
      title: notice.title,
      message: notice.message,
      recipientType: notice.recipientType,
      issueDate: notice.issueDate
    };

    // Delete notice
    await Notice.findByIdAndDelete(noticeId);

    // Create audit log
    await createAuditLog({
      adminId: req.admin?._id,
      adminName: req.admin?.adminId || 'System',
      actionType: AuditActionTypes.NOTICE_DELETED,
      description: `Deleted notice: ${noticeData.title}`,
      targetType: 'Notice',
      targetId: noticeId,
      targetName: noticeData.title,
      additionalData: {
        deletedNoticeData: noticeData
      }
    });

    return res.json({
      success: true,
      message: 'Notice deleted successfully.',
      deletedNotice: {
        id: noticeId,
        title: noticeData.title
      }
    });
  } catch (err) {
    console.error('Error deleting notice:', err);
    return res.status(500).json({
      success: false,
      message: 'Error deleting notice.'
    });
  }
};

// PATCH - Mark notice as read/unread
const updateNoticeReadStatus = async (req, res) => {
  const { noticeId } = req.params;
  const { readStatus, studentId } = req.body;

  try {
    if (!['Read', 'Unread'].includes(readStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid read status. Use "Read" or "Unread".'
      });
    }

    const notice = await Notice.findById(noticeId);
    if (!notice) {
      return res.status(404).json({
        success: false,
        message: 'Notice not found.'
      });
    }

    // Update general read status
    notice.readStatus = readStatus;

    // If marking as read and studentId provided, add to readBy array
    if (readStatus === 'Read' && studentId) {
      const existingRead = notice.readBy.find(r => r.studentId === studentId);
      if (!existingRead) {
        notice.readBy.push({
          studentId,
          readAt: new Date()
        });
      }
    }

    await notice.save();

    return res.json({
      success: true,
      message: 'Notice read status updated successfully.',
      notice: {
        id: notice._id.toString(),
        readStatus: notice.readStatus,
        readBy: notice.readBy
      }
    });
  } catch (err) {
    console.error('Error updating notice read status:', err);
    return res.status(500).json({
      success: false,
      message: 'Error updating notice read status.'
    });
  }
};


export {
  addInventoryItem,
  getInventoryItems,
  getInventoryItemBySlug,
   generateQRCode,
  downloadQRCode,
  updateInventoryItem,
  getInventoryItemById,
  deleteInventoryItem,
  getAvailableBeds,
  updateInventoryReceipt,
  issueNotice,
  getAllNotices,
  getNoticeById,
  updateNotice,
  deleteNotice,
  updateNoticeReadStatus,
  upload
}