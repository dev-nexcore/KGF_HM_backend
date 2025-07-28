import 'dotenv/config';
import nodemailer from 'nodemailer';
import { Student } from '../../models/student.model.js';
import { Parent } from '../../models/parent.model.js';
import { Warden } from '../../models/warden.model.js';

import { createAuditLog, AuditActionTypes } from '../../utils/auditLogger.js';

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

const registerStudent = async (req, res) => {
  const {
    studentName,
    studentId,
    contactNumber,
    roomBedNumber,
    email,
    admissionDate,
    feeStatus,
    emergencyContactName,
    emergencyContactNumber
  } = req.body;

  // Generate a password: lowercase name (no spaces) + studentId
  const cleanName = studentName.replace(/\s+/g, '').toLowerCase();
  const password = `${cleanName}${studentId}`;

  try {
    // Create student record
    const newStudent = new Student({
      studentName,
      studentId,
      contactNumber,
      roomBedNumber,
      email,
      admissionDate,
      feeStatus,
      emergencyContactName,
      emergencyContactNumber,
      password
    });

    await newStudent.save();

    // Send email with student credentials
    await transporter.sendMail({
      from: `"Hostel Admin" <${process.env.MAIL_USER}>`,
      to: email,
      subject: 'Your Student Panel Credentials',
      text: `Hello ${studentName},

Your student account has been created.

• Student ID: ${studentId}
• Password: ${password}

Please log in at https://www.KGF-HM.com and change your password after first login.

– Hostel Admin`
    });

    await createAuditLog({
      adminId: req.admin?._id, // Assuming you have admin info in req from auth middleware
      adminName: req.admin?.adminId || 'System',
      actionType: AuditActionTypes.STUDENT_REGISTERED,
      description: `Registered new student: ${studentName} (ID: ${studentId})`,
      targetType: 'Student',
      targetId: studentId,
      targetName: studentName,
      additionalData: {
        email,
        roomBedNumber,
        admissionDate
      }
    });

    return res.json({
      message: 'Student registered and credentials emailed.',
      student: { studentName, studentId, email, password }
    });
  } catch (err) {
    console.error('Error registering student:', err);
    return res.status(500).json({ message: 'Error registering student.' });
  }
};


const registerParent = async (req, res) => {
  const { firstName, lastName, email, contactNumber, studentId } = req.body;

  try {
    // Check if the parent already exists
    const existingParent = await Parent.findOne({ studentId });
    if (existingParent) {
      return res.status(409).json({ message: "Parent already exists with the same ID or email." });
    }

    // Fetch the student details from the database using studentId
    const student = await Student.findOne({ studentId });
    if (!student) {
      return res.status(404).json({ message: "Student not found with the provided studentId." });
    }

    // Generate password for the parent
    const cleanName = firstName.replace(/\s+/g, '').toLowerCase(); // Remove spaces from first name
    const parentPassword = `${cleanName}${studentId}`; // Password will be a combination of firstName and student's studentId

    // Create new parent record
    const newParent = new Parent({
      firstName,
      lastName,
      email,
      contactNumber,
      studentId,
      password: parentPassword 
    });

    await newParent.save();

    // Send email with the login credentials
    await transporter.sendMail({
      from: `"Hostel Admin" <${process.env.MAIL_USER}>`,
      to: email,
      subject: 'Your Parent Panel Credentials',
      text: `Hello ${firstName} ${lastName},

Your parent account has been created.


• Your Child's Student ID: ${studentId}
• Your Login Password: ${parentPassword}

Please log in at https://www.KGF-HM.com and change your password after first login.

– Hostel Admin`
    });

    return res.json({
      message: 'Parent registered and login credentials emailed.',
      parent: { firstName, lastName, email, studentId, parentPassword }
    });
  } catch (err) {
    console.error("Error registering parent:", err);
    return res.status(500).json({ message: "Error registering parent." });
  }
};




const registerWarden = async (req, res) => {
     const { firstName,lastName, email, wardenId, contactNumber} = req.body;

  try {
    // Check if the warden already exists by email
    const existingWarden = await Warden.findOne({ email });
    if (existingWarden) {
      return res.status(409).json({ message: "Warden already exists with the same email." });
    }

    // Generate a password for the warden (can be a combination of firstName, lastName, or something else)
    const cleanName = firstName.replace(/\s+/g, '').toLowerCase(); // Remove spaces from first name
    const wardenPassword = `${cleanName}${lastName}`; // Password will be a combination of firstName and lastName

    // Create new warden record
    const newWarden = new Warden({
      firstName,
      lastName,
      email,
      wardenId,
      contactNumber,
      password: wardenPassword
   // Set the generated password
    });

    await newWarden.save();

    // Send email with the login credentials
    await transporter.sendMail({
      from: `"Hostel Admin" <${process.env.MAIL_USER}>`,
      to: email,
      subject: 'Your Warden Panel Credentials',
      text: `Hello ${firstName} ${lastName},

Your warden account has been created.

• Warden Name: ${firstName} ${lastName}
• Warden ID: ${wardenId}
• Your Login Password: ${wardenPassword}

Please log in at https://www.KGF-HM.com and change your password after first login.

– Hostel Admin`
    });

    return res.json({
      message: 'Warden registered and login credentials emailed.',
      warden: { firstName, lastName, email, wardenId, wardenPassword }
    });
  } catch (err) {
    console.error("Error registering warden:", err);
    return res.status(500).json({ message: "Error registering warden." });
  }
};

export{
    registerStudent,
    registerParent,
    registerWarden
}