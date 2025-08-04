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
      status,
      description,
      purchaseDate,
      purchaseCost
    } = req.body;

    const receiptUrl = req.file ? `/uploads/receipts/${req.file.filename}` : null;

    const publicSlug = nanoid(10); // short, non-guessable slug

    const newItem = new Inventory({
      itemName,
      barcodeId,
      category,
      location,
      status,
      description,
      purchaseDate,
      purchaseCost,
      receiptUrl,
      publicSlug
    });

    await newItem.save();

    const qrData = `${FRONTEND_BASE_URL}/p/${publicSlug}`;

    const qrCodesDir = path.join(process.cwd(), 'public', 'qrcodes');
    if (!fs.existsSync(qrCodesDir)) fs.mkdirSync(qrCodesDir, { recursive: true });

    const qrCodePath = path.join(qrCodesDir, `${newItem._id}.png`);
    await QRCode.toFile(qrCodePath, qrData);

    newItem.qrCodeUrl = `/public/qrcodes/${newItem._id}.png`;
    await newItem.save();

    return res.status(201).json({
      message: 'Inventory item added successfully',
      item: newItem,
      qrCodeUrl: newItem.qrCodeUrl,
      publicUrl: `${FRONTEND_BASE_URL}/p/${publicSlug}`
    });

  } catch (err) {
    console.error('Add Inventory Error:', err);
    return res.status(500).json({ message: 'Failed to add inventory item.' });
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
    const notice = await Notice.create({
      template,
      title,
      message,
      issueDate,
      recipientType,
      individualRecipient
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
      return res.status(400).json({ message: "No recipients found to send notice." });
    }

    for (const email of recipients) {
      const result = await transporter.sendMail({
        from: `"Hostel Admin" <${process.env.MAIL_USER}>`,
        to: email,
        subject,
        text: emailBody
      });

      console.log(`📤 Email sent to ${email} - MessageId: ${result.messageId}`);
    }

    if (studentRecipients.length > 0) {
      await sendBulkNotifications(
        studentRecipients,
        `New notice: ${title}`,
        'notice',
        '/notices'
      );
    }

    return res.status(201).json({ message: "Notice issued and emailed successfully", notice });
  } catch (err) {
    console.error("Issue notice error:", err);
    return res.status(500).json({ message: "Failed to issue notice" });
  }
};


export {
  addInventoryItem,
  issueNotice,
  upload
}