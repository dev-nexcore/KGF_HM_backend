import 'dotenv/config';
import nodemailer from 'nodemailer';
import { Student } from '../../models/student.model.js';
import { Parent } from '../../models/parent.model.js';
import { Warden } from '../../models/warden.model.js';
import { Inventory } from '../../models/inventory.model.js';

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
    firstName,
    lastName,
    contactNumber,
    roomBedNumber,
    email,
    admissionDate,
    feeStatus,
    emergencyContactName,
    emergencyContactNumber
  } = req.body;

  try {
    // Generate unique student ID
    const generateStudentId = async () => {
      const count = await Student.countDocuments();
      const paddedNumber = String(count + 1).padStart(3, '0');
      const studentId = `STU-${paddedNumber}`;
      
      // Check if this ID already exists (in case of concurrent requests)
      const existingStudent = await Student.findOne({ studentId });
      if (existingStudent) {
        // If exists, find the next available number
        const allStudents = await Student.find({}, { studentId: 1 }).sort({ studentId: -1 });
        let maxNumber = 0;
        allStudents.forEach(student => {
          const match = student.studentId.match(/STU-(\d+)/);
          if (match) {
            const number = parseInt(match[1]);
            if (number > maxNumber) maxNumber = number;
          }
        });
        return `STU-${String(maxNumber + 1).padStart(3, '0')}`;
      }
      return studentId;
    };

    const studentId = await generateStudentId();

    // Generate a password: lowercase name (no spaces) + studentId
    const cleanName = firstName.replace(/\s+/g, '').toLowerCase();
    const password = `${cleanName}${studentId}`;

    // Create student record
    const newStudent = new Student({
      firstName,
      lastName,
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

      if (roomBedNumber && roomBedNumber !== "Not Assigned") {
      await Inventory.findByIdAndUpdate(
        roomBedNumber,
        { status: "In Use" },
        { new: true }
      );
    }

    // Send email with student credentials
    await transporter.sendMail({
      from: `"Hostel Admin" <${process.env.MAIL_USER}>`,
      to: email,
      subject: 'Your Student Panel Credentials',
      text: `Hello ${firstName} ${lastName},

Your student account has been created.

- Student ID: ${studentId}
- Password: ${password}

Please log in at https://www.KGF-HM.com and change your password after first login.

– Hostel Admin`
    });

    await createAuditLog({
      adminId: req.admin?._id,
      adminName: req.admin?.adminId || 'System',
      actionType: AuditActionTypes.STUDENT_REGISTERED,
      description: `Registered new student: ${firstName} ${lastName} (ID: ${studentId})`,
      targetType: 'Student',
      targetId: studentId,
      targetName: `${firstName} ${lastName}`,
      additionalData: {
        email,
        roomBedNumber,
        admissionDate
      }
    });

    return res.json({
      message: 'Student registered and credentials emailed.',
      student: { firstName, lastName, studentId, email, password }
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
      return res.status(409).json({ message: "Parent already exists with the same student ID." });
    }

    // Fetch the student details from the database using studentId
    const student = await Student.findOne({ studentId });
    if (!student) {
      return res.status(404).json({ message: "Student not found with the provided studentId." });
    }

    // Create new parent record (NO PASSWORD NEEDED for OTP login)
    const newParent = new Parent({
      firstName,
      lastName,
      email,
      contactNumber,
      studentId
      // Remove password field completely
    });

    await newParent.save();

    // Send welcome email with OTP login instructions
    await transporter.sendMail({
      from: `"Hostel Admin" <${process.env.MAIL_USER}>`,
      to: email,
      subject: 'Parent Account Created - Login Instructions',
      text: `Hello ${firstName} ${lastName},

Your parent account has been created successfully!

Login Details:
• Student ID: ${studentId}
• Login Method: OTP (One-Time Password)

How to Login:
1. Visit https://www.KGF-HM.com
2. Enter your child's Student ID: ${studentId}
3. Click "Send OTP" button
4. Check your email for the 6-digit OTP code
5. Enter the OTP to access your parent panel

The OTP will be valid for 5 minutes each time you request it.

If you have any questions, please contact the hostel administration.

– Hostel Admin`
    });

    return res.json({
      message: 'Parent registered successfully. Login instructions sent via email.',
      parent: { 
        firstName, 
        lastName, 
        email, 
        studentId 
        // Remove parentPassword from response
      }
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

const getAllStudents = async (req, res) => {
  try {
    // Get all students with selected fields
    const students = await Student.find({})
      .select('-password') // Exclude password from response
      .sort({ createdAt: -1 }); // Sort by newest first

    // Transform data for frontend compatibility
    const transformedStudents = students.map(student => ({
      id: student.studentId,
      firstName: student.firstName,
      lastName: student.lastName,
      studentId: student.studentId,
      contactNumber: student.contactNumber,
      roomBedNumber: student.roomBedNumber,
      email: student.email,
      admissionDate: student.admissionDate,
      feeStatus: student.feeStatus,
      emergencyContactName: student.emergencyContactName,
      emergencyContactNumber: student.emergencyContactNumber,
      createdAt: student.createdAt,
      updatedAt: student.updatedAt
    }));

    return res.json({
      success: true,
      message: 'Students fetched successfully',
      students: transformedStudents,
      count: transformedStudents.length
    });
  } catch (err) {
    console.error('Error fetching students:', err);
    return res.status(500).json({ 
      success: false,
      message: 'Error fetching students.' 
    });
  }
};

const getStudentsWithoutParents = async (req, res) => {
  try {
    // Get all student IDs that already have parents
    const studentsWithParents = await Parent.find({}, { studentId: 1 });
    const studentIdsWithParents = studentsWithParents.map(parent => parent.studentId);

    // Get all students who don't have parents yet
    const studentsWithoutParents = await Student.find({
      studentId: { $nin: studentIdsWithParents }
    }).select('studentId firstName lastName');

    res.status(200).json({
      success: true,
      students: studentsWithoutParents
    });
  } catch (error) {
    console.error('Error fetching students without parents:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching students without parents'
    });
  }
};

// PUT update student
const updateStudent = async (req, res) => {
  const { studentId } = req.params;
  const {
    firstName,
    lastName,
    contactNumber,
    email,
    roomBedNumber,
    emergencyContactNumber,
    admissionDate,
    emergencyContactName,
    feeStatus,
  } = req.body;

  try {
    // Get the current student data to check previous bed assignment
    const currentStudent = await Student.findOne({ studentId });
    if (!currentStudent) {
      return res.status(404).json({ message: 'Student not found.' });
    }

    const previousBedId = currentStudent.roomBedNumber;

    // Update student record
    const updatedStudent = await Student.findOneAndUpdate(
      { studentId },
      {
        firstName,
        lastName,
        contactNumber,
        email,
        roomBedNumber,
        emergencyContactNumber,
        admissionDate,
        emergencyContactName,
        feeStatus,
      },
      { new: true }
    );

    // Handle bed status changes
    const newBedId = roomBedNumber;

    // Case 1: Student had a bed before and is being assigned to a different bed
    if (previousBedId && previousBedId !== "Not Assigned" && previousBedId !== newBedId) {
      // Mark previous bed as Available
      await Inventory.findByIdAndUpdate(
        previousBedId,
        { status: "Available" },
        { new: true }
      );
    }

    // Case 2: Student is being assigned to a new bed (different from previous or first time assignment)
    if (newBedId && newBedId !== "Not Assigned" && newBedId !== previousBedId) {
      // Check if the new bed is actually available
      const bedToAssign = await Inventory.findById(newBedId);
      if (!bedToAssign) {
        return res.status(404).json({ message: 'Selected bed not found.' });
      }
      
      if (bedToAssign.status === "In Use") {
        return res.status(400).json({ message: 'Selected bed is already in use.' });
      }

      // Mark new bed as In Use
      await Inventory.findByIdAndUpdate(
        newBedId,
        { status: "In Use" },
        { new: true }
      );
    }

    // Case 3: Student bed is being removed (set to "Not Assigned")
    if (previousBedId && previousBedId !== "Not Assigned" && (!newBedId || newBedId === "Not Assigned")) {
      // Mark previous bed as Available
      await Inventory.findByIdAndUpdate(
        previousBedId,
        { status: "Available" },
        { new: true }
      );
    }

    // Create audit log for the update
    await createAuditLog({
      adminId: req.admin?._id,
      adminName: req.admin?.adminId || 'System',
      actionType: AuditActionTypes.STUDENT_UPDATED,
      description: `Updated student: ${firstName} ${lastName} (ID: ${studentId})`,
      targetType: 'Student',
      targetId: studentId,
      targetName: `${firstName} ${lastName}`,
      additionalData: {
        previousBed: previousBedId,
        newBed: newBedId,
        email,
        feeStatus
      }
    });

    return res.json({
      message: 'Student updated successfully.',
      student: updatedStudent
    });
  } catch (err) {
    console.error('Error updating student:', err);
    return res.status(500).json({ message: 'Error updating student.' });
  }
};

// DELETE student
const deleteStudent = async (req, res) => {
  const { studentId } = req.params;

  try {
    // Check if student exists
    const existingStudent = await Student.findOne({ studentId });
    if (!existingStudent) {
      return res.status(404).json({ 
        success: false,
        message: 'Student not found.' 
      });
    }

    // Store student data for audit log before deletion
    const studentData = {
      firstName: existingStudent.firstName,
      lastName: existingStudent.lastName,
      email: existingStudent.email,
      contactNumber: existingStudent.contactNumber,
      roomBedNumber: existingStudent.roomBedNumber
    };

    // Delete student
    await Student.deleteOne({ studentId });

    // Create audit log
    await createAuditLog({
      adminId: req.admin?._id,
      adminName: req.admin?.adminId || 'System',
      actionType: AuditActionTypes.STUDENT_DELETED,
      description: `Deleted student: ${studentData.firstName} ${studentData.lastName} (ID: ${studentId})`,
      targetType: 'Student',
      targetId: studentId,
      targetName: `${studentData.firstName} ${studentData.lastName}`,
      additionalData: {
        deletedStudentData: studentData
      }
    });

    return res.json({
      success: true,
      message: 'Student deleted successfully.',
      deletedStudent: {
        studentId,
        name: `${studentData.firstName} ${studentData.lastName}`
      }
    });
  } catch (err) {
    console.error('Error deleting student:', err);
    return res.status(500).json({ 
      success: false,
      message: 'Error deleting student.' 
    });
  }
};

// GET single student by ID
const getStudentById = async (req, res) => {
  const { studentId } = req.params;

  try {
    const student = await Student.findOne({ studentId }).select('-password');
    
    if (!student) {
      return res.status(404).json({ 
        success: false,
        message: 'Student not found.' 
      });
    }

    return res.json({
      success: true,
      message: 'Student fetched successfully.',
      student
    });
  } catch (err) {
    console.error('Error fetching student:', err);
    return res.status(500).json({ 
      success: false,
      message: 'Error fetching student.' 
    });
  }
};



export{
    registerStudent,
    registerParent,
    registerWarden,
     getAllStudents,
     getStudentsWithoutParents,
  getStudentById,
  updateStudent,
  deleteStudent,
}