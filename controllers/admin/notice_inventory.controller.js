import 'dotenv/config';
import QRCode from 'qrcode';
import ExcelJS from 'exceljs';
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

import { sendNotification, sendBulkNotifications } from '../../utils/sendNotification.js';
import { createAuditLog } from '../../utils/auditLogger.js';


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
    // Check if it's a receipt or bulk upload file
    if (file.fieldname === 'receipt') {
      cb(null, 'uploads/receipts/');
    } else if (file.fieldname === 'file') {
      cb(null, 'uploads/bulk/');
    } else {
      cb(null, 'uploads/');
    }
  },
  filename: (req, file, cb) => {
    if (file.fieldname === 'receipt') {
      cb(null, `receipt-${Date.now()}${path.extname(file.originalname)}`);
    } else if (file.fieldname === 'file') {
      cb(null, `bulk-${Date.now()}${path.extname(file.originalname)}`);
    } else {
      cb(null, `${Date.now()}${path.extname(file.originalname)}`);
    }
  }
});

const memoryStorage = multer.memoryStorage();
const uploadMemory = multer({ storage: memoryStorage });

const upload = multer({ storage });

// If you use ES modules and need __dirname:
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper function to convert DD-MM-YYYY to valid Date object
const convertDateFormat = (dateString) => {
  if (!dateString) return null;

  // Check if it's already in ISO format or a valid date
  const isoDate = new Date(dateString);
  if (!isNaN(isoDate.getTime()) && !dateString.includes('-') || dateString.match(/^\d{4}-/)) {
    return isoDate;
  }

  // Handle DD-MM-YYYY format
  if (dateString.match(/^\d{2}-\d{2}-\d{4}$/)) {
    const [day, month, year] = dateString.split('-');
    // Create date in YYYY-MM-DD format (month is 0-indexed in Date constructor)
    return new Date(year, month - 1, day);
  }

  // Handle other formats or return null for invalid dates
  return null;
};

const addInventoryItem = async (req, res) => {

  console.log("hello world@")

  const clean = (v) => (v === "" || v === null || v === "undefined" ? undefined : v);

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
    const parsedPurchaseDate =
      purchaseDate && purchaseDate.trim() !== ""
        ? new Date(purchaseDate.split("-").reverse().join("-"))
        : undefined;

    const newItem = new Inventory({
      itemName,
      barcodeId,
      category,
      location,
      roomNo,
      floor,
      status,
      description: clean(description),
      purchaseDate: parsedPurchaseDate,
      purchaseCost: clean(purchaseCost),
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
    newItem.qrCodeUrl = `/qrcodes/${newItem._id}.png`;
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
      inventoryItem.qrCodeUrl = `/qrcodes/${inventoryItem._id}.png`;
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

// Add this function for QR scanning
const getItemByQRSlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const inventoryItem = await Inventory.findOne({ publicSlug: slug });

    if (!inventoryItem) {
      return res.status(404).json({
        success: false,
        message: 'Inventory item not found'
      });
    }

    res.status(200).json({
      success: true,
      item: inventoryItem
    });
  } catch (error) {
    console.error('Error fetching inventory item by QR slug:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching inventory item'
    });
  }
};

// Add this function for generating stock report
const generateStockReport = async (req, res) => {
  try {
    // Import Excel library at the top of your file
    // import ExcelJS from 'exceljs';

    // Get all inventory items
    const items = await Inventory.find({}).sort({ category: 1, itemName: 1 });

    // Create workbook and worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Monthly Stock Report');

    // Add title and date
    const now = new Date();
    const monthYear = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    worksheet.addRow([`Monthly Stock Report - ${monthYear}`]);
    worksheet.addRow([`Generated on: ${now.toLocaleDateString('en-IN')}`]);
    worksheet.addRow([]); // Empty row

    // Add headers
    const headers = [
      'Item Name',
      'Barcode ID',
      'Category',
      'Location',
      'Room No',
      'Floor',
      'Status',
      'Purchase Date',
      'Purchase Cost (₹)',
      'Description'
    ];

    const headerRow = worksheet.addRow(headers);

    // Style headers
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '366092' }
      };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });

    // Add data rows
    items.forEach(item => {
      const row = worksheet.addRow([
        item.itemName,
        item.barcodeId,
        item.category,
        item.location,
        item.roomNo,
        item.floor,
        item.status,
        item.purchaseDate ? new Date(item.purchaseDate).toLocaleDateString('en-IN') : '',
        item.purchaseCost || '',
        item.description || ''
      ]);

      // Add borders to data rows
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
    });

    // Auto-fit columns
    worksheet.columns.forEach(column => {
      column.width = 15;
    });

    worksheet.getColumn(10).width = 30; // if description is the 2nd column



    // Add summary at the end
    worksheet.addRow([]);
    worksheet.addRow(['Summary']);
    worksheet.addRow([`Total Items: ${items.length}`]);
    worksheet.addRow([`Available Items: ${items.filter(item => item.status === 'Available').length}`]);
    worksheet.addRow([`In Use Items: ${items.filter(item => item.status === 'In Use').length}`]);
    worksheet.addRow([`In Maintenance Items: ${items.filter(item => item.status === 'In maintenance').length}`]);
    worksheet.addRow([`Damaged Items: ${items.filter(item => item.status === 'Damaged').length}`]);

    // Set response headers
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="Monthly_Stock_Report_${monthYear.replace(' ', '_')}.xlsx"`
    );

    // Write to response
    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Error generating stock report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate stock report'
    });
  }
};

// Add after the generateStockReport function
// Bulk upload inventory items from CSV/Excel

// const bulkUploadInventory = async (req, res) => {
//   try {
//     if (!req.file) {
//       return res.status(400).json({
//         success: false,
//         message: 'No file uploaded'
//       });
//     }

//     const workbook = new ExcelJS.Workbook();
//     const fileBuffer = req.file.buffer;

//     // Read the uploaded file
//     if (req.file.mimetype === 'text/csv') {
//       await workbook.csv.read(fileBuffer);
//     } else {
//       await workbook.xlsx.load(fileBuffer);
//     }

//     const worksheet = workbook.worksheets[0];
//     const items = [];
//     const errors = [];

//     // Skip header row (row 1)
//     for (let i = 2; i <= worksheet.rowCount; i++) {
//       const row = worksheet.getRow(i);

//       // Skip empty rows
//       if (!row.getCell(1).value) continue;

//       try {
//         const itemName = row.getCell(1).value?.toString().trim();
//         const category = row.getCell(2).value?.toString().trim();
//         const location = row.getCell(3).value?.toString().trim();
//         const status = row.getCell(4).value?.toString().trim();
//         const roomNo = row.getCell(5).value?.toString().trim();
//         const floor = row.getCell(6).value?.toString().trim();
//         const description = row.getCell(7).value?.toString().trim() || '';
//         const purchaseDate = row.getCell(8).value ? convertDateFormat(row.getCell(8).value.toString().trim()) : null;
//         const purchaseCost = row.getCell(9).value ? parseFloat(row.getCell(9).value) : null;

//         // Validate required fields
//         if (!itemName || !category || !location || !status || !roomNo || !floor) {
//           errors.push({ row: i, error: 'Missing required fields' });
//           continue;
//         }

//         // Generate unique barcode ID
//         const timestamp = Date.now();
//         const random = Math.floor(Math.random() * 1000);
//         const itemPrefix = itemName.toUpperCase().replace(/\s+/g, '').substring(0, 3);
//         const barcodeId = `${itemPrefix}${timestamp}${random}`;

//         // Check if barcode already exists
//         const existingItem = await Inventory.findOne({ barcodeId });
//         if (existingItem) {
//           errors.push({ row: i, error: 'Duplicate barcode ID' });
//           continue;
//         }

//         const publicSlug = nanoid(10);

//         const newItem = {
//           itemName,
//           barcodeId,
//           category,
//           location,
//           roomNo,
//           floor,
//           status,
//           description,
//           purchaseDate,
//           purchaseCost,
//           publicSlug
//         };

//         items.push(newItem);
//       } catch (error) {
//         errors.push({ row: i, error: error.message });
//       }
//     }

//     // Insert all valid items
//     let addedItems = [];
//     if (items.length > 0) {
//       addedItems = await Inventory.insertMany(items);
//     }

//     return res.status(201).json({
//       success: true,
//       message: `Successfully added ${addedItems.length} items`,
//       addedCount: addedItems.length,
//       items: addedItems,
//       errors: errors.length > 0 ? errors : undefined
//     });

//   } catch (error) {
//     console.error('Bulk upload error:', error);
//     return res.status(500).json({
//       success: false,
//       message: 'Failed to upload items',
//       error: error.message
//     });
//   }
// };


// Add after the generateStockReport function
// Bulk upload inventory items from CSV/Excel
export const bulkUploadInventory = async (req, res) => {
  try {
    if (!req.file || !req.file.path) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded"
      });
    }

    const filePath = req.file.path;

    const workbook = new ExcelJS.Workbook();
    await workbook.csv.read(fs.createReadStream(filePath));

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return res.status(400).json({
        success: false,
        message: "Invalid CSV file"
      });
    }

    const items = [];

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // header

      const itemName = row.values[1];
      if (!itemName || String(itemName).trim() === "") return;

      // Parse DD-MM-YYYY safely
      let purchaseDate = null;
      const rawDate = row.values[8];
      if (rawDate && typeof rawDate === "string") {
        const [dd, mm, yyyy] = rawDate.split("-");
        if (dd && mm && yyyy) {
          purchaseDate = new Date(`${yyyy}-${mm}-${dd}`);
        }
      }

      const statusRaw = String(row.values[4] || "Available").trim();
      const statusAllowed = ["Available", "In Use", "Damaged"];

      items.push({
        itemName: String(itemName).trim(),
        category: String(row.values[2] || "").trim(),
        location: String(row.values[3] || "").trim(),
        status: statusAllowed.includes(statusRaw)
          ? statusRaw
          : "Available",
        roomNo: String(row.values[5] || "").trim(),
        floor: String(row.values[6] || "").trim(),
        description: String(row.values[7] || "").trim(),
        purchaseDate,
        purchaseCost: Number(row.values[9] || 0),

        // REQUIRED FIELDS
        barcodeId: `BULK-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        publicSlug: nanoid(10),
        qrCodeUrl: null
      });
    });

    if (items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid rows found in CSV"
      });
    }

    const savedItems = await Inventory.insertMany(items, {
      ordered: false
    });

    fs.unlinkSync(filePath);

    return res.status(201).json({
      success: true,
      addedCount: savedItems.length,
      items: savedItems
    });

  } catch (error) {
    console.error("Bulk upload error:", error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};




// Bulk generate QR codes for multiple items
const bulkGenerateQRCodes = async (req, res) => {
  try {
    const { itemIds } = req.body;

    if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Item IDs array is required'
      });
    }

    const items = await Inventory.find({ _id: { $in: itemIds } });

    if (items.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No items found'
      });
    }

    // Ensure QR codes directory exists
    const qrCodesDir = path.join(process.cwd(), 'public', 'qrcodes');
    if (!fs.existsSync(qrCodesDir)) {
      fs.mkdirSync(qrCodesDir, { recursive: true });
    }

    const updatedItems = [];
    const errors = [];

    for (const item of items) {
      try {
        // Generate public slug if it doesn't exist
        if (!item.publicSlug) {
          item.publicSlug = nanoid(10);
        }

        const qrData = `${FRONTEND_BASE_URL}/inventory/item/${item.publicSlug}`;

        // Generate QR code file
        const qrCodePath = path.join(qrCodesDir, `${item._id}.png`);
        await QRCode.toFile(qrCodePath, qrData, {
          width: 300,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        });

        // Update item with QR code URL
        item.qrCodeUrl = `/qrcodes/${item._id}.png`;
        await item.save();

        updatedItems.push(item);
      } catch (error) {
        errors.push({
          itemId: item._id.toString(),
          itemName: item.itemName,
          error: error.message
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: `Generated ${updatedItems.length} QR codes successfully`,
      count: updatedItems.length,
      items: updatedItems,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Bulk QR generation error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate QR codes',
      error: error.message
    });
  }
};

// Add this function for available rooms and floors for inventory
const getAvailableRoomsFloors = async (req, res) => {
  try {
    // Get all unique room numbers that already have beds assigned (regardless of status)
    const occupiedRooms = await Inventory.find({
      category: 'Furniture',
      itemName: { $regex: /^bed$/i }, // Case-insensitive match for "bed"
      roomNo: { $exists: true, $ne: null, $ne: '' }
    }).distinct('roomNo');

    // Get all possible rooms (you might want to define this based on your building structure)
    const allRooms = [];
    for (let i = 101; i <= 110; i++) allRooms.push(i.toString()); // Floor 1
    for (let i = 201; i <= 210; i++) allRooms.push(i.toString()); // Floor 2  
    for (let i = 301; i <= 310; i++) allRooms.push(i.toString()); // Floor 3
    // Add more floors as needed

    // Filter out rooms that already have beds assigned
    const availableRooms = allRooms.filter(room => !occupiedRooms.includes(room));

    // Available floors (assuming 3 floors)
    const availableFloors = ['1', '2', '3'];

    res.status(200).json({
      success: true,
      rooms: availableRooms,
      floors: availableFloors
    });
  } catch (error) {
    console.error('Error fetching available rooms and floors:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching available rooms and floors'
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
const getAvailableRooms = async (req, res) => {
  try {
    // Get unique available rooms
    const availableRooms = await Inventory.aggregate([
      {
        $match: {
          category: 'Furniture',
          itemName: 'Bed',
          status: 'Available'
        }
      },
      {
        $group: {
          _id: "$roomNo",
          floor: { $first: "$floor" },
          location: { $first: "$location" }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    res.status(200).json({
      success: true,
      availableRooms: availableRooms
    });
  } catch (error) {
    console.error('Error fetching available rooms:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching available rooms'
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


// const issueNotice = async (req, res) => {
//   const {
//     template,
//     title,
//     message,
//     issueDate,
//     recipientType,
//     individualRecipient
//   } = req.body;

//   try {
//     // Validate required fields
//     if (!title || !message || !issueDate || !recipientType) {
//       return res.status(400).json({
//         success: false,
//         message: 'Title, message, issue date, and recipient type are required.'
//       });
//     }

//     const notice = await Notice.create({
//       template,
//       title,
//       message,
//       issueDate: new Date(issueDate),
//       recipientType,
//       individualRecipient,
//       createdBy: req.admin?._id
//     });

//     const subject = `Hostel Notice: ${title}`;

//     const istDateTime = new Date(issueDate).toLocaleString("en-IN", {
//       timeZone: "Asia/Kolkata"
//     });

//     const emailBody = `
// ${message}

// Issued on: ${istDateTime}

// – Hostel Admin
// `;

//     let recipients = [];
//     let studentRecipients = [];

//     if (recipientType === 'All') {
//       const students = await Student.find({}, 'email');
//       const parents = await Parent.find({}, 'email');
//       const wardens = await Warden.find({}, 'email');

//       studentRecipients = students;
//       recipients = [
//         ...students.map(s => s.email).filter(Boolean),
//         ...parents.map(p => p.email).filter(Boolean),
//         ...wardens.map(w => w.email).filter(Boolean)
//       ];
//     } else if (recipientType === 'Student') {
//       if (!individualRecipient) {
//         const students = await Student.find({}, '_id email');
//         studentRecipients = students;
//         recipients = students.map(s => s.email).filter(Boolean);
//       } else {
//         const student = await Student.findOne({ studentId: individualRecipient }, '_id email');
//         if (student?.email) recipients.push(student.email);
//         if (student) studentRecipients.push(student);
//       }
//     } else if (recipientType === 'Parent') {
//       if (!individualRecipient) {
//         const parents = await Parent.find({}, 'email');
//         recipients = parents.map(p => p.email).filter(Boolean);
//       } else {
//         const parent = await Parent.findOne({ studentId: individualRecipient });
//         if (parent?.email) recipients.push(parent.email);
//       }
//     } else if (recipientType === 'Warden') {
//       if (!individualRecipient) {
//         const wardens = await Warden.find({}, 'email');
//         recipients = wardens.map(w => w.email).filter(Boolean);
//       } else {
//         const warden = await Warden.findOne({ wardenId: individualRecipient });
//         if (warden?.email) recipients.push(warden.email);
//       }
//     }

//     if (recipients.length === 0) {
//       return res.status(400).json({ 
//         success: false,
//         message: "No recipients found to send notice." 
//       });
//     }

//     // Send emails
//     for (const email of recipients) {
//       try {
//         const result = await transporter.sendMail({
//           from: `"Hostel Admin" <${process.env.MAIL_USER}>`,
//           to: email,
//           subject,
//           text: emailBody
//         });
//         console.log(`📤 Email sent to ${email} - MessageId: ${result.messageId}`);
//       } catch (emailError) {
//         console.error(`Failed to send email to ${email}:`, emailError);
//       }
//     }

//     // Send push notifications to students
//     if (studentRecipients.length > 0) {
//       try {
//         await sendBulkNotifications(
//           studentRecipients,
//           `New notice: ${title}`,
//           'notice',
//           '/notices'
//         );
//       } catch (notificationError) {
//         console.error('Failed to send push notifications:', notificationError);
//       }
//     }

//     // Create audit log
//     await createAuditLog({
//       adminId: req.admin?._id,
//       adminName: req.admin?.adminId || 'System',
//       actionType: AuditActionTypes.NOTICE_ISSUED,
//       description: `Issued notice: ${title} to ${recipientType}`,
//       targetType: 'Notice',
//       targetId: notice._id.toString(),
//       targetName: title,
//       additionalData: {
//         recipientType,
//         individualRecipient,
//         recipientCount: recipients.length
//       }
//     });

//     return res.status(201).json({ 
//       success: true,
//       message: "Notice issued and emailed successfully", 
//       notice: {
//         id: notice._id,
//         title: notice.title,
//         message: notice.message,
//         issueDate: notice.issueDate,
//         recipientType: notice.recipientType,
//         individualRecipient: notice.individualRecipient,
//         template: notice.template,
//         status: 'Active',
//         createdAt: notice.createdAt
//       }
//     });
//   } catch (err) {
//     console.error("Issue notice error:", err);
//     return res.status(500).json({ 
//       success: false,
//       message: "Failed to issue notice" 
//     });
//   }
// };

// GET - Get all notices


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
    // ---------------- VALIDATION ----------------
    if (!title || !message || !issueDate || !recipientType) {
      return res.status(400).json({
        success: false,
        message: "Title, message, issue date, and recipient type are required."
      });
    }

    // ---------------- DATE PARSING (FIX) ----------------
    let parsedIssueDate;

    // Case 1: ISO format (YYYY-MM-DD or full ISO)
    if (!isNaN(Date.parse(issueDate))) {
      parsedIssueDate = new Date(issueDate);
    }
    // Case 2: DD-MM-YYYY
    else if (typeof issueDate === "string" && issueDate.includes("-")) {
      const [dd, mm, yyyy] = issueDate.split("-");
      parsedIssueDate = new Date(`${yyyy}-${mm}-${dd}`);
    }

    // Final safety check
    if (!parsedIssueDate || isNaN(parsedIssueDate)) {
      return res.status(400).json({
        success: false,
        message: "Invalid issue date format"
      });
    }

    // ---------------- CREATE NOTICE ----------------
    const notice = await Notice.create({
      template,
      title,
      message,
      issueDate: parsedIssueDate,
      recipientType,
      individualRecipient,
      createdBy: req.admin?._id
    });

    // ---------------- EMAIL CONTENT ----------------
    const subject = `Hostel Notice: ${title}`;

    const istDateTime = parsedIssueDate.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata"
    });

    const emailBody = `
${message}

Issued on: ${istDateTime}

– Hostel Admin
`;

    // ---------------- RECIPIENT LOGIC ----------------
    let recipients = [];
    let studentRecipients = [];

    if (recipientType === "All") {
      const students = await Student.find({}, "_id email");
      const parents = await Parent.find({}, "email");
      const wardens = await Warden.find({}, "email");

      studentRecipients = students;

      recipients = [
        ...students.map(s => s.email),
        ...parents.map(p => p.email),
        ...wardens.map(w => w.email)
      ].filter(Boolean);

    } else if (recipientType === "Student") {
      if (!individualRecipient) {
        const students = await Student.find({}, "_id email");
        studentRecipients = students;
        recipients = students.map(s => s.email).filter(Boolean);
      } else {
        const student = await Student.findOne(
          { studentId: individualRecipient },
          "_id email"
        );
        if (student?.email) recipients.push(student.email);
        if (student) studentRecipients.push(student);
      }

    } else if (recipientType === "Parent") {
      if (!individualRecipient) {
        const parents = await Parent.find({}, "email");
        recipients = parents.map(p => p.email).filter(Boolean);
      } else {
        const parent = await Parent.findOne({ studentId: individualRecipient });
        if (parent?.email) recipients.push(parent.email);
      }

    } else if (recipientType === "Warden") {
      if (!individualRecipient) {
        const wardens = await Warden.find({}, "email");
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

    // ---------------- SEND EMAILS ----------------
    for (const email of recipients) {
      try {
        const result = await transporter.sendMail({
          from: `"Hostel Admin" <${process.env.MAIL_USER}>`,
          to: email,
          subject,
          text: emailBody
        });
        console.log(`📤 Email sent to ${email} | MessageId: ${result.messageId}`);
      } catch (emailError) {
        console.error(`Failed to send email to ${email}:`, emailError);
      }
    }

    // ---------------- PUSH NOTIFICATIONS ----------------
    if (studentRecipients.length > 0) {
      try {
        await sendBulkNotifications(
          studentRecipients,
          `New notice: ${title}`,
          "notice",
          "/notices"
        );
      } catch (notificationError) {
        console.error("Failed to send push notifications:", notificationError);
      }
    }

    // ---------------- AUDIT LOG ----------------
    await createAuditLog({
      adminId: req.admin?._id,
      adminName: req.admin?.adminId || "System",
      actionType: AuditActionTypes.NOTICE_ISSUED,
      description: `Issued notice: ${title} to ${recipientType}`,
      targetType: "Notice",
      targetId: notice._id.toString(),
      targetName: title,
      additionalData: {
        recipientType,
        individualRecipient,
        recipientCount: recipients.length
      }
    });

    // ---------------- RESPONSE ----------------
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
        status: "Active",
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
  getAvailableRooms,
  updateInventoryReceipt,
  issueNotice,
  getAllNotices,
  getNoticeById,
  updateNotice,
  deleteNotice,
  updateNoticeReadStatus,
  upload,
  getItemByQRSlug,
  generateStockReport,
  bulkGenerateQRCodes,
  getAvailableRoomsFloors
}