// import 'dotenv/config';
// import nodemailer from 'nodemailer';
// import { Student } from '../../models/student.model.js';
// import { Parent } from '../../models/parent.model.js';
// import { Warden } from '../../models/warden.model.js';
// import { Inventory } from '../../models/inventory.model.js';
// import fs from 'fs';

// import { createAuditLog, AuditActionTypes } from '../../utils/auditLogger.js';

// // configure SMTP transporter
// const transporter = nodemailer.createTransport({

//     host:    process.env.MAIL_HOST,      // smtp.gmail.com
//   port:   +process.env.MAIL_PORT,      // 587
//   secure: process.env.MAIL_SECURE === 'true',
 
//   auth: {
//     user: process.env.MAIL_USER,
//     pass: process.env.MAIL_PASS
//   }
// });

// // const registerStudent = async (req, res) => {

// //   console.log("req.admin =>", req.admin);
// // console.log("req.user =>", req.user);
// //   const {
// //     firstName,
// //     lastName,
// //     contactNumber,
// //     roomBedNumber,
// //     email,
// //     admissionDate,
// //     feeStatus,
// //     emergencyContactName,
// //     emergencyContactNumber
// //   } = req.body;

// //   try {
// //     // Generate unique student ID
// //     const generateStudentId = async () => {
// //       const count = await Student.countDocuments();
// //       const paddedNumber = String(count + 1).padStart(3, '0');
// //       const studentId = `STU-${paddedNumber}`;
      
// //       const existingStudent = await Student.findOne({ studentId });
// //       if (existingStudent) {
// //         const allStudents = await Student.find({}, { studentId: 1 }).sort({ studentId: -1 });
// //         let maxNumber = 0;
// //         allStudents.forEach(student => {
// //           const match = student.studentId.match(/STU-(\d+)/);
// //           if (match) {
// //             const number = parseInt(match[1]);
// //             if (number > maxNumber) maxNumber = number;
// //           }
// //         });
// //         return `STU-${String(maxNumber + 1).padStart(3, '0')}`;
// //       }
// //       return studentId;
// //     };

// //     const studentId = await generateStudentId();

// //     // Generate password
// //     const cleanName = firstName.replace(/\s+/g, '').toLowerCase();
// //     const password = `${cleanName}${studentId}`;

// //     // Handle document uploads
// //     const documents = {
// //       aadharCard: {},
// //       panCard: {}
// //     };

// //     if (req.files) {
// //       // Check if aadharCard was uploaded
// //       if (req.files['aadharCard'] && req.files['aadharCard'][0]) {
// //         const aadharFile = req.files['aadharCard'][0];
// //         documents.aadharCard = {
// //           filename: aadharFile.filename,
// //           path: aadharFile.path,
// //           uploadedAt: new Date()
// //         };
// //       }

// //       // Check if panCard was uploaded
// //       if (req.files['panCard'] && req.files['panCard'][0]) {
// //         const panFile = req.files['panCard'][0];
// //         documents.panCard = {
// //           filename: panFile.filename,
// //           path: panFile.path,
// //           uploadedAt: new Date()
// //         };
// //       }
// //     }

// //     // Create student record
// //     const newStudent = new Student({
// //       firstName,
// //       lastName,
// //       studentId,
// //       contactNumber,
// //       roomBedNumber,
// //       email,
// //       admissionDate,
// //       feeStatus,
// //       emergencyContactName,
// //       emergencyContactNumber,
// //       password,
// //       documents // Add documents to student record
// //     });

// //     await newStudent.save();

// //     if (roomBedNumber && roomBedNumber !== "Not Assigned") {
// //       await Inventory.findByIdAndUpdate(
// //         roomBedNumber,
// //         { status: "In Use" },
// //         { new: true }
// //       );
// //     }

// //     // Send email with credentials
// //     await transporter.sendMail({
// //       from: `"Hostel Admin" <${process.env.MAIL_USER}>`,
// //       to: email,
// //       subject: 'Your Student Panel Credentials',
// //       text: `Hello ${firstName} ${lastName},

// // Your student account has been created successfully!

// // Login Details:
// // - Student ID: ${studentId}
// // - Login Method: OTP (One-Time Password)

// // How to Login:
// // 1. Visit https://kokanglobal.org/student
// // 2. Enter your student ID: ${studentId}
// // 3. Click "Send OTP" button
// // 4. Check your Email or Whatsapp for the 6-digit OTP code
// // 5. Enter the OTP to access your parent panel

// // The OTP will be valid for 5 minutes each time you request it.

// // – Hostel Admin`
// //     });

// //     await createAuditLog({
// //       adminId: req.admin?._id,
// //       adminName: req.admin?.adminId || 'System',
// //       actionType: AuditActionTypes.STUDENT_REGISTERED,
// //       description: `Registered new student: ${firstName} ${lastName} (ID: ${studentId})`,
// //       targetType: 'Student',
// //       targetId: studentId,
// //       targetName: `${firstName} ${lastName}`,
// //       additionalData: {
// //         email,
// //         roomBedNumber,
// //         admissionDate,
// //         documentsUploaded: {
// //           aadharCard: !!documents.aadharCard.filename,
// //           panCard: !!documents.panCard.filename
// //         }
// //       }
// //     });

// //     return res.json({
// //       message: 'Student registered and credentials emailed.',
// //       student: { 
// //         firstName, 
// //         lastName, 
// //         studentId, 
// //         email, 
// //         password,
// //         documentsUploaded: {
// //           aadharCard: !!documents.aadharCard.filename,
// //           panCard: !!documents.panCard.filename
// //         }
// //       }
// //     });
// //   } catch (err) {
// //     console.error('Error registering student:', err);
    
// //     // Clean up uploaded files if registration fails
// //     if (req.files) {
// //       Object.values(req.files).flat().forEach(file => {
// //         if (fs.existsSync(file.path)) {
// //           fs.unlinkSync(file.path);
// //         }
// //       });
// //     }
    
// //     return res.status(500).json({ message: 'Error registering student.' });
// //   }
// // };


// const registerStudent = async (req, res) => {

//   console.log("req.admin =>", req.admin);
//   console.log("req.user =>", req.user);

//   const {
//     firstName,
//     lastName,
//     contactNumber,
//     roomBedNumber,
//     email,
//     admissionDate,
//     feeStatus,
//     emergencyContactName,
//     emergencyContactNumber,
//     hasCollegeId
//   } = req.body;

//   try {

//     // Generate unique student ID
//     const generateStudentId = async () => {

//       const count =
//         await Student.countDocuments();

//       const paddedNumber =
//         String(count + 1).padStart(3, "0");

//       const studentId =
//         `STU-${paddedNumber}`;

//       const existingStudent =
//         await Student.findOne({
//           studentId
//         });

//       if (existingStudent) {

//         const allStudents =
//           await Student.find(
//             {},
//             { studentId: 1 }
//           ).sort({
//             studentId: -1
//           });

//         let maxNumber = 0;

//         allStudents.forEach(
//           (student) => {

//             const match =
//               student.studentId.match(
//                 /STU-(\d+)/
//               );

//             if (match) {

//               const number =
//                 parseInt(match[1]);

//               if (
//                 number > maxNumber
//               ) {
//                 maxNumber = number;
//               }
//             }
//           }
//         );

//         return `STU-${String(
//           maxNumber + 1
//         ).padStart(3, "0")}`;
//       }

//       return studentId;
//     };

//     const studentId =
//       await generateStudentId();

//     // Generate password
//     const cleanName =
//       firstName
//         .replace(/\s+/g, "")
//         .toLowerCase();

//     const password =
//       `${cleanName}${studentId}`;

//     // Handle document uploads
//     const documents = {

//       aadharCard: {},

//       panCard: {},

//       studentIdCard: {},

//       feesReceipt: {}
//     };

//     if (req.files) {

//       // Aadhar Card
//       if (
//         req.files["aadharCard"] &&
//         req.files["aadharCard"][0]
//       ) {

//         const aadharFile =
//           req.files["aadharCard"][0];

//         documents.aadharCard = {
//           filename:
//             aadharFile.filename,

//           path:
//             aadharFile.path,

//           uploadedAt:
//             new Date()
//         };
//       }

//       // PAN Card
//       if (
//         req.files["panCard"] &&
//         req.files["panCard"][0]
//       ) {

//         const panFile =
//           req.files["panCard"][0];

//         documents.panCard = {
//           filename:
//             panFile.filename,

//           path:
//             panFile.path,

//           uploadedAt:
//             new Date()
//         };
//       }

//       // Student ID Card
//       if (
//         req.files["studentIdCard"] &&
//         req.files["studentIdCard"][0]
//       ) {

//         const studentIdFile =
//           req.files["studentIdCard"][0];

//         documents.studentIdCard = {
//           filename:
//             studentIdFile.filename,

//           path:
//             studentIdFile.path,

//           uploadedAt:
//             new Date()
//         };
//       }

//       // Fees Receipt
//       if (
//         req.files["feesReceipt"] &&
//         req.files["feesReceipt"][0]
//       ) {

//         const feesReceiptFile =
//           req.files["feesReceipt"][0];

//         documents.feesReceipt = {
//           filename:
//             feesReceiptFile.filename,

//           path:
//             feesReceiptFile.path,

//           uploadedAt:
//             new Date()
//         };
//       }
//     }

//     // Create student record
//     const newStudent =
//       new Student({

//         firstName,

//         lastName,

//         studentId,

//         contactNumber,

//         roomBedNumber,

//         email,

//         admissionDate,

//         feeStatus,

//         emergencyContactName,

//         emergencyContactNumber,

//         password,

//         documents,

//         hasCollegeId
//       });

//     await newStudent.save();

//     // Update bed status
//     if (
//       roomBedNumber &&
//       roomBedNumber !==
//         "Not Assigned"
//     ) {

//       await Inventory.findByIdAndUpdate(
//         roomBedNumber,
//         {
//           status: "In Use"
//         },
//         {
//           new: true
//         }
//       );
//     }

//     // Send Email
//     await transporter.sendMail({

//       from:
//         `"Hostel Admin" <${process.env.MAIL_USER}>`,

//       to: email,

//       subject:
//         "Your Student Panel Credentials",

//       text: `Hello ${firstName} ${lastName},

// Your student account has been created successfully!

// Login Details:
// - Student ID: ${studentId}
// - Login Method: OTP (One-Time Password)

// How to Login:
// 1. Visit https://kokanglobal.org/student
// 2. Enter your student ID: ${studentId}
// 3. Click "Send OTP" button
// 4. Check your Email or Whatsapp for the 6-digit OTP code
// 5. Enter the OTP to access your student panel

// The OTP will be valid for 5 minutes each time you request it.

// – Hostel Admin`
//     });

//     // Audit Log
//     await createAuditLog({

//       adminId:
//         req.admin?._id,

//       adminName:
//         req.admin?.adminId ||
//         "System",

//       actionType:
//         AuditActionTypes.STUDENT_REGISTERED,

//       description:
//         `Registered new student: ${firstName} ${lastName} (ID: ${studentId})`,

//       targetType:
//         "Student",

//       targetId:
//         studentId,

//       targetName:
//         `${firstName} ${lastName}`,

//       additionalData: {

//         email,

//         roomBedNumber,

//         admissionDate,

//         hasCollegeId,

//         documentsUploaded: {

//           aadharCard:
//             !!documents
//               .aadharCard
//               .filename,

//           panCard:
//             !!documents
//               .panCard
//               .filename,

//           studentIdCard:
//             !!documents
//               .studentIdCard
//               .filename,

//           feesReceipt:
//             !!documents
//               .feesReceipt
//               .filename
//         }
//       }
//     });

//     return res.json({

//       success: true,

//       message:
//         "Student registered and credentials emailed.",

//       student: {

//         firstName,

//         lastName,

//         studentId,

//         email,

//         password,

//         hasCollegeId,

//         documentsUploaded: {

//           aadharCard:
//             !!documents
//               .aadharCard
//               .filename,

//           panCard:
//             !!documents
//               .panCard
//               .filename,

//           studentIdCard:
//             !!documents
//               .studentIdCard
//               .filename,

//           feesReceipt:
//             !!documents
//               .feesReceipt
//               .filename
//         }
//       }
//     });

//   } catch (err) {

//     console.error(
//       "Error registering student:",
//       err
//     );

//     // Cleanup uploaded files
//     if (req.files) {

//       Object.values(req.files)
//         .flat()
//         .forEach((file) => {

//           if (
//             fs.existsSync(
//               file.path
//             )
//           ) {
//             fs.unlinkSync(
//               file.path
//             );
//           }
//         });
//     }

//     return res.status(500).json({

//       success: false,

//       message:
//         "Error registering student."
//     });
//   }
// };



// const registerParent = async (req, res) => {
//   const { firstName, lastName, email,relation, contactNumber, studentId } = req.body;

//   try {
//     // Check if the parent already exists
//     const existingParent = await Parent.findOne({ studentId });
//     if (existingParent) {
//       return res.status(409).json({ message: "Parent already exists with the same student ID." });
//     }

//     // Fetch the student details from the database using studentId
//     const student = await Student.findOne({ studentId });
//     if (!student) {
//       return res.status(404).json({ message: "Student not found with the provided studentId." });
//     }

//     // Handle document uploads
//     const documents = {
//       aadharCard: {},
//       panCard: {}
//     };

//     if (req.files) {
//       // Check if aadharCard was uploaded
//       if (req.files['aadharCard'] && req.files['aadharCard'][0]) {
//         const aadharFile = req.files['aadharCard'][0];
//         documents.aadharCard = {
//           filename: aadharFile.filename,
//           path: aadharFile.path,
//           uploadedAt: new Date()
//         };
//       }

//       // Check if panCard was uploaded
//       if (req.files['panCard'] && req.files['panCard'][0]) {
//         const panFile = req.files['panCard'][0];
//         documents.panCard = {
//           filename: panFile.filename,
//           path: panFile.path,
//           uploadedAt: new Date()
//         };
//       }
//     }

//     // Create new parent record (NO PASSWORD NEEDED for OTP login)
//     const newParent = new Parent({
//       firstName,
//       lastName,
//       email,
//       relation,
//       contactNumber,
//       studentId,
//       documents // Add documents to parent record
//     });

//     await newParent.save();

//     // Send welcome email with OTP login instructions
//     await transporter.sendMail({
//       from: `"Hostel Admin" <${process.env.MAIL_USER}>`,
//       to: email,
//       subject: 'Parent Account Created - Login Instructions',
//       text: `Hello ${firstName} ${lastName},

// Your parent account has been created successfully!

// Login Details:
// - Student ID: ${studentId}
// - Login Method: OTP (One-Time Password)

// How to Login:
// 1. Visit https://kokanglobal.org/parent
// 2. Enter your child's Student ID: ${studentId}
// 3. Click "Send OTP" button
// 4. Check your email for the 6-digit OTP code
// 5. Enter the OTP to access your parent panel

// The OTP will be valid for 5 minutes each time you request it.

// If you have any questions, please contact the hostel administration.

// – Hostel Admin`
//     });

//     // Create audit log
//     await createAuditLog({
//       adminId: req.admin?._id,
//       adminName: req.admin?.adminId || 'System',
//       actionType: AuditActionTypes.PARENT_REGISTERED,
//       description: `Registered new parent: ${firstName} ${lastName} for student ${studentId}`,
//       targetType: 'Parent',
//       targetId: email,
//       targetName: `${firstName} ${lastName}`,
//       additionalData: {
//         studentId,
//         email,
//         contactNumber,
//         documentsUploaded: {
//           aadharCard: !!documents.aadharCard.filename,
//           panCard: !!documents.panCard.filename
//         }
//       }
//     });

//     return res.json({
//       message: 'Parent registered successfully. Login instructions sent via email.',
//       parent: { 
//         firstName, 
//         lastName, 
//         email, 
//         relation,
//         studentId,
//         documentsUploaded: {
//           aadharCard: !!documents.aadharCard.filename,
//           panCard: !!documents.panCard.filename
//         }
//       }
//     });
//   } catch (err) {
//     console.error("Error registering parent:", err);
    
//     // Clean up uploaded files if registration fails
//     if (req.files) {
//       Object.values(req.files).flat().forEach(file => {
//         if (fs.existsSync(file.path)) {
//           fs.unlinkSync(file.path);
//         }
//       });
//     }
    
//     return res.status(500).json({ message: "Error registering parent." });
//   }
// };




// const registerWarden = async (req, res) => {
//      const { firstName,lastName, email, wardenId, contactNumber} = req.body;

//   try {
//     // Check if the warden already exists by email
//     const existingWarden = await Warden.findOne({ email });
//     if (existingWarden) {
//       return res.status(409).json({ message: "Warden already exists with the same email." });
//     }

//     // Generate a password for the warden (can be a combination of firstName, lastName, or something else)
//     const cleanName = firstName.replace(/\s+/g, '').toLowerCase(); // Remove spaces from first name
//     const wardenPassword = `${cleanName}${lastName}`; // Password will be a combination of firstName and lastName

//     // Create new warden record
//     const newWarden = new Warden({
//       firstName,
//       lastName,
//       email,
//       wardenId,
//       contactNumber,
//       password: wardenPassword
//    // Set the generated password
//     });

//     await newWarden.save();

//     // Send email with the login credentials
//     await transporter.sendMail({
//       from: `"Hostel Admin" <${process.env.MAIL_USER}>`,
//       to: email,
//       subject: 'Your Warden Panel Credentials',
//       text: `Hello ${firstName} ${lastName},

// Your warden account has been created.

// • Warden Name: ${firstName} ${lastName}
// • Warden ID: ${wardenId}
// • Your Login Password: ${wardenPassword}

// Please log in at https://www.KGF-HM.com and change your password after first login.

// – Hostel Admin`
//     });

//     return res.json({
//       message: 'Warden registered and login credentials emailed.',
//       warden: { firstName, lastName, email, wardenId, wardenPassword }
//     });
//   } catch (err) {
//     console.error("Error registering warden:", err);
//     return res.status(500).json({ message: "Error registering warden." });
//   }
// };

// // const getAllStudents = async (req, res) => {
// //   try {
// //     // Get all students with selected fields
// //     const students = await Student.find({})
// //       .select('-password') // Exclude password from response
// //       .sort({ createdAt: -1 }); // Sort by newest first

// //     // Transform data for frontend compatibility
// //     const transformedStudents = students.map(student => ({
// //       id: student.studentId,
// //       firstName: student.firstName,
// //       lastName: student.lastName,
// //       studentId: student.studentId,
// //       contactNumber: student.contactNumber,
// //       roomBedNumber: student.roomBedNumber,
// //       email: student.email,
// //       admissionDate: student.admissionDate,
// //       feeStatus: student.feeStatus,
// //       emergencyContactName: student.emergencyContactName,
// //       emergencyContactNumber: student.emergencyContactNumber,
// //       createdAt: student.createdAt,
// //       updatedAt: student.updatedAt
// //     }));

// //     return res.json({
// //       success: true,
// //       message: 'Students fetched successfully',
// //       students: transformedStudents,
// //       count: transformedStudents.length
// //     });
// //   } catch (err) {
// //     console.error('Error fetching students:', err);
// //     return res.status(500).json({ 
// //       success: false,
// //       message: 'Error fetching students.' 
// //     });
// //   }
// // };


// const getAllStudents = async (req, res) => {

//   try {

//     // Get all students
//     const students =
//       await Student.find({})
//         .select("-password")
//         .sort({ createdAt: -1 });

//     // Transform data
//     const transformedStudents =
//       students.map((student) => ({

//         id: student.studentId,

//         firstName:
//           student.firstName,

//         lastName:
//           student.lastName,

//         studentId:
//           student.studentId,

//         contactNumber:
//           student.contactNumber,

//         roomBedNumber:
//           student.roomBedNumber,

//         email:
//           student.email,

//         admissionDate:
//           student.admissionDate,

//         feeStatus:
//           student.feeStatus,

//         emergencyContactName:
//           student.emergencyContactName,

//         emergencyContactNumber:
//           student.emergencyContactNumber,

//         hasCollegeId:
//           student.hasCollegeId,

//         documents: {

//           aadharCard:
//             student.documents
//               ?.aadharCard || null,

//           panCard:
//             student.documents
//               ?.panCard || null,

//           studentIdCard:
//             student.documents
//               ?.studentIdCard || null,

//           feesReceipt:
//             student.documents
//               ?.feesReceipt || null,
//         },

//         createdAt:
//           student.createdAt,

//         updatedAt:
//           student.updatedAt,
//       }));

//     return res.json({

//       success: true,

//       message:
//         "Students fetched successfully",

//       students:
//         transformedStudents,

//       count:
//         transformedStudents.length
//     });

//   } catch (err) {

//     console.error(
//       "Error fetching students:",
//       err
//     );

//     return res.status(500).json({

//       success: false,

//       message:
//         "Error fetching students."
//     });
//   }
// };


// const getStudentsWithoutParents = async (req, res) => {
//   try {
//     // Get all student IDs that already have parents
//     const studentsWithParents = await Parent.find({}, { studentId: 1 });
//     const studentIdsWithParents = studentsWithParents.map(parent => parent.studentId);

//     // Get all students who don't have parents yet
//     const studentsWithoutParents = await Student.find({
//       studentId: { $nin: studentIdsWithParents }
//     }).select('studentId firstName lastName');

//     res.status(200).json({
//       success: true,
//       students: studentsWithoutParents
//     });
//   } catch (error) {
//     console.error('Error fetching students without parents:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Server error while fetching students without parents'
//     });
//   }
// };

// // PUT update student
// const updateStudent = async (req, res) => {
  
//   const { studentId } = req.params;
//   const {
//     firstName,
//     lastName,
//     contactNumber,
//     email,
//     roomBedNumber,
//     emergencyContactNumber,
//     admissionDate,
//     emergencyContactName,
//     feeStatus,
//   } = req.body;

//   try {
//     // Get the current student data to check previous bed assignment
//     const currentStudent = await Student.findOne({ studentId });
//     if (!currentStudent) {
//       return res.status(404).json({ message: 'Student not found.' });
//     }

//     const previousBedId = currentStudent.roomBedNumber;

//     // Update student record
//     const updatedStudent = await Student.findOneAndUpdate(
//       { studentId },
//       {
//         firstName,
//         lastName,
//         contactNumber,
//         email,
//         roomBedNumber,
//         emergencyContactNumber,
//         admissionDate,
//         emergencyContactName,
//         feeStatus,
//       },
//       { new: true }
//     );

//     // Handle bed status changes
//     const newBedId = roomBedNumber;

//     // Case 1: Student had a bed before and is being assigned to a different bed
//     if (previousBedId && previousBedId !== "Not Assigned" && previousBedId !== newBedId) {
//       // Mark previous bed as Available
//       await Inventory.findByIdAndUpdate(
//         previousBedId,
//         { status: "Available" },
//         { new: true }
//       );
//     }

//     // Case 2: Student is being assigned to a new bed (different from previous or first time assignment)
//     if (newBedId && newBedId !== "Not Assigned" && newBedId !== previousBedId) {
//       // Check if the new bed is actually available
//       const bedToAssign = await Inventory.findById(newBedId);
//       if (!bedToAssign) {
//         return res.status(404).json({ message: 'Selected bed not found.' });
//       }
      
//       if (bedToAssign.status === "In Use") {
//         return res.status(400).json({ message: 'Selected bed is already in use.' });
//       }

//       // Mark new bed as In Use
//       await Inventory.findByIdAndUpdate(
//         newBedId,
//         { status: "In Use" },
//         { new: true }
//       );
//     }

//     // Case 3: Student bed is being removed (set to "Not Assigned")
//     if (previousBedId && previousBedId !== "Not Assigned" && (!newBedId || newBedId === "Not Assigned")) {
//       // Mark previous bed as Available
//       await Inventory.findByIdAndUpdate(
//         previousBedId,
//         { status: "Available" },
//         { new: true }
//       );
//     }

//     // Create audit log for the update
//     await createAuditLog({
//       adminId: req.admin?._id,
//       adminName: req.admin?.adminId || 'System',
//       actionType: AuditActionTypes.STUDENT_UPDATED,
//       description: `Updated student: ${firstName} ${lastName} (ID: ${studentId})`,
//       targetType: 'Student',
//       targetId: studentId,
//       targetName: `${firstName} ${lastName}`,
//       additionalData: {
//         previousBed: previousBedId,
//         newBed: newBedId,
//         email,
//         feeStatus
//       }
//     });

//     return res.json({
//       message: 'Student updated successfully.',
//       student: updatedStudent
//     });
//   } catch (err) {
//     console.error('Error updating student:', err);
//     return res.status(500).json({ message: 'Error updating student.' });
//   }
// };

// // DELETE student
// const deleteStudent = async (req, res) => {
//   const { studentId } = req.params;

//   try {
//     // Check if student exists
//     const existingStudent = await Student.findOne({ studentId });
//     if (!existingStudent) {
//       return res.status(404).json({ 
//         success: false,
//         message: 'Student not found.' 
//       });
//     }

//     // Store student data for audit log before deletion
//     const studentData = {
//       firstName: existingStudent.firstName,
//       lastName: existingStudent.lastName,
//       email: existingStudent.email,
//       contactNumber: existingStudent.contactNumber,
//       roomBedNumber: existingStudent.roomBedNumber
//     };

//     // Delete student
//     await Student.deleteOne({ studentId });

//     // Create audit log
//     await createAuditLog({
//       adminId: req.admin?._id,
//       adminName: req.admin?.adminId || 'System',
//       actionType: AuditActionTypes.STUDENT_DELETED,
//       description: `Deleted student: ${studentData.firstName} ${studentData.lastName} (ID: ${studentId})`,
//       targetType: 'Student',
//       targetId: studentId,
//       targetName: `${studentData.firstName} ${studentData.lastName}`,
//       additionalData: {
//         deletedStudentData: studentData
//       }
//     });

//     return res.json({
//       success: true,
//       message: 'Student deleted successfully.',
//       deletedStudent: {
//         studentId,
//         name: `${studentData.firstName} ${studentData.lastName}`
//       }
//     });
//   } catch (err) {
//     console.error('Error deleting student:', err);
//     return res.status(500).json({ 
//       success: false,
//       message: 'Error deleting student.' 
//     });
//   }
// };

// // GET single student by ID
// const getStudentById = async (req, res) => {
//   const { studentId } = req.params;

//   try {
//     const student = await Student.findOne({ studentId }).select('-password');
    
//     if (!student) {
//       return res.status(404).json({ 
//         success: false,
//         message: 'Student not found.' 
//       });
//     }

//     return res.json({
//       success: true,
//       message: 'Student fetched successfully.',
//       student
//     });
//   } catch (err) {
//     console.error('Error fetching student:', err);
//     return res.status(500).json({ 
//       success: false,
//       message: 'Error fetching student.' 
//     });
//   }
// };



// export{
//     registerStudent,
//     registerParent,
//     registerWarden,
//      getAllStudents,
//      getStudentsWithoutParents,
//   getStudentById,
//   updateStudent,
//   deleteStudent,
// }



import 'dotenv/config';
import nodemailer from 'nodemailer';
import { Student } from '../../models/student.model.js';
import { Parent } from '../../models/parent.model.js';
import { Warden } from '../../models/warden.model.js';
import { Staff } from '../../models/staff.model.js';
import { Inventory } from '../../models/inventory.model.js';
import { StudentInvoice } from '../../models/studentInvoice.model.js';
import fs from 'fs';
import path from 'path'; // ✅ ADD THIS — getStudentDocument ke liye zaroori hai

import sendEmail from '../../utils/sendEmail.js';
import { createAuditLog, AuditActionTypes } from '../../utils/auditLogger.js';

// Removed local transporter - using centralized sendEmail utility instead

const registerStudent = async (req, res) => {

  console.log("req.admin =>", req.admin);
  console.log("req.user =>", req.user);

  const {
    firstName,
    lastName,
    contactNumber,
    roomBedNumber,
    email,
    admissionDate,
    feeStatus,
    emergencyContactName,
    emergencyContactNumber,
    hasCollegeId,
    isWorking,
    roomType
  } = req.body;

  try {


    const existingStudentByEmail = await Student.findOne({ email });
    if (existingStudentByEmail) {
      return res.status(409).json({
        success: false,
        message: `A student with email "${email}" is already registered (ID: ${existingStudentByEmail.studentId}). Please use a different email.`
      });
    }

    const generateStudentId = async () => {
      const count = await Student.countDocuments();
      const paddedNumber = String(count + 1).padStart(3, "0");
      const prefix = (isWorking === 'true' || isWorking === true) ? "STUW" : "STU";
      const studentId = `${prefix}-${paddedNumber}`;
      const existingStudent = await Student.findOne({ studentId });

      if (existingStudent) {
        const allStudents = await Student.find({}, { studentId: 1 }).sort({ studentId: -1 });
        let maxNumber = 0;
        allStudents.forEach((student) => {
          const match = student.studentId.match(/(?:STU|STUW)-(\d+)/);
          if (match) {
            const number = parseInt(match[1]);
            if (number > maxNumber) maxNumber = number;
          }
        });
        return `${prefix}-${String(maxNumber + 1).padStart(3, "0")}`;
      }
      return studentId;
    };

    const studentId = await generateStudentId();
    const cleanName = firstName.replace(/\s+/g, "").toLowerCase();
    const password = `${cleanName}${studentId}`;

    const documents = {
      aadharCard: {},
      panCard: {},
      studentIdCard: {},
      feesReceipt: {}
    };

    if (req.files) {
      if (req.files["aadharCard"] && req.files["aadharCard"][0]) {
        const aadharFile = req.files["aadharCard"][0];
        documents.aadharCard = {
          filename: aadharFile.filename,
          path: aadharFile.path,
          uploadedAt: new Date()
        };
      }
      if (req.files["panCard"] && req.files["panCard"][0]) {
        const panFile = req.files["panCard"][0];
        documents.panCard = {
          filename: panFile.filename,
          path: panFile.path,
          uploadedAt: new Date()
        };
      }
      if (req.files["studentIdCard"] && req.files["studentIdCard"][0]) {
        const studentIdFile = req.files["studentIdCard"][0];
        documents.studentIdCard = {
          filename: studentIdFile.filename,
          path: studentIdFile.path,
          uploadedAt: new Date()
        };
      }
      if (req.files["feesReceipt"] && req.files["feesReceipt"][0]) {
        const feesReceiptFile = req.files["feesReceipt"][0];
        documents.feesReceipt = {
          filename: feesReceiptFile.filename,
          path: feesReceiptFile.path,
          uploadedAt: new Date()
        };
      }
    }

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
      password,
      documents,
      hasCollegeId,
      isWorking,
      roomType
    });

    await newStudent.save();

    if (roomBedNumber && roomBedNumber !== "Not Assigned") {
      await Inventory.findByIdAndUpdate(roomBedNumber, { status: "In Use" }, { new: true });
    }

    // Send email using centralized utility
    const emailResult = await sendEmail({
      to: email,
      subject: "Your Student Panel Credentials",
      text: `Hello ${firstName} ${lastName},

Your student account has been created successfully!

Login Details:
- Student ID: ${studentId}
- Login Method: OTP (One-Time Password)

How to Login:
1. Visit https://kokanglobal.org/student
2. Enter your student ID: ${studentId}
3. Click "Send OTP" button
4. Check your Email or Whatsapp for the 6-digit OTP code
5. Enter the OTP to access your student panel

The OTP will be valid for 5 minutes each time you request it.

– Hostel Admin`
    });
    const emailSent = emailResult.success;

    // Audit log - also wrapped so it doesn't crash registration
    try {
      await createAuditLog({
        adminId: req.admin?._id,
        adminName: req.admin?.adminId || "System",
        actionType: AuditActionTypes.STUDENT_REGISTERED,
        description: `Registered new student: ${firstName} ${lastName} (ID: ${studentId})`,
        targetType: "Student",
        targetId: studentId,
        targetName: `${firstName} ${lastName}`,
        additionalData: {
          email,
          roomBedNumber,
          admissionDate,
          hasCollegeId,
          isWorking,
          documentsUploaded: {
            aadharCard: !!documents.aadharCard.filename,
            panCard: !!documents.panCard.filename,
            studentIdCard: !!documents.studentIdCard.filename,
            feesReceipt: !!documents.feesReceipt.filename
          }
        }
      });
    } catch (auditErr) {
      console.error("Audit log creation failed:", auditErr.message);
    }

    return res.json({
      success: true,
      message: emailSent
        ? "Student registered and credentials emailed."
        : "Student registered successfully. Email could not be sent - please share credentials manually.",
      student: {
        firstName,
        lastName,
        studentId,
        email,
        password,
        hasCollegeId,
        isWorking,
        emailSent,
        // ✅ Return full document objects so frontend can display them immediately
        documents: {
          aadharCard: documents.aadharCard.filename ? documents.aadharCard : null,
          panCard: documents.panCard.filename ? documents.panCard : null,
          studentIdCard: documents.studentIdCard.filename ? documents.studentIdCard : null,
          feesReceipt: documents.feesReceipt.filename ? documents.feesReceipt : null,
        }
      }
    });

  } catch (err) {
    console.error("Error registering student:", err);
    if (req.files) {
      Object.values(req.files).flat().forEach((file) => {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      });
    }
    return res.status(500).json({ success: false, message: "Error registering student." });
  }
};


const registerParent = async (req, res) => {
  const { firstName, lastName, email, relation, contactNumber, studentId } = req.body;

  try {
    const existingParent = await Parent.findOne({ studentId });
    if (existingParent) {
      return res.status(409).json({ message: "Parent already exists with the same student ID." });
    }

    const student = await Student.findOne({ studentId });
    if (!student) {
      return res.status(404).json({ message: "Student not found with the provided studentId." });
    }

    const documents = { aadharCard: {}, panCard: {} };

    if (req.files) {
      if (req.files['aadharCard'] && req.files['aadharCard'][0]) {
        const aadharFile = req.files['aadharCard'][0];
        documents.aadharCard = { filename: aadharFile.filename, path: aadharFile.path, uploadedAt: new Date() };
      }
      if (req.files['panCard'] && req.files['panCard'][0]) {
        const panFile = req.files['panCard'][0];
        documents.panCard = { filename: panFile.filename, path: panFile.path, uploadedAt: new Date() };
      }
    }

    const newParent = new Parent({ firstName, lastName, email, relation, contactNumber, studentId, documents });
    await newParent.save();

    // Send email using centralized utility
    const emailResult = await sendEmail({
      to: email,
      subject: 'Parent Account Created - Login Instructions',
      text: `Hello ${firstName} ${lastName},

Your parent account has been created successfully!

Login Details:
- Student ID: ${studentId}
- Login Method: OTP (One-Time Password)

How to Login:
1. Visit https://kokanglobal.org/parent
2. Enter your child's Student ID: ${studentId}
3. Click "Send OTP" button
4. Check your email for the 6-digit OTP code
5. Enter the OTP to access your parent panel

The OTP will be valid for 5 minutes each time you request it.

– Hostel Admin`
    });
    const emailSent = emailResult.success;

    await createAuditLog({
      adminId: req.admin?._id,
      adminName: req.admin?.adminId || 'System',
      actionType: AuditActionTypes.PARENT_REGISTERED,
      description: `Registered new parent: ${firstName} ${lastName} for student ${studentId}`,
      targetType: 'Parent',
      targetId: email,
      targetName: `${firstName} ${lastName}`,
      additionalData: {
        studentId,
        email,
        contactNumber,
        documentsUploaded: {
          aadharCard: !!documents.aadharCard.filename,
          panCard: !!documents.panCard.filename
        }
      }
    });

    return res.json({
      success: true,
      message: emailSent 
        ? 'Parent registered successfully. Login instructions sent via email.'
        : 'Parent registered successfully. Email could not be sent - please share credentials manually.',
      parent: { firstName, lastName, email, relation, studentId, emailSent }
    });
  } catch (err) {
    console.error("Error registering parent:", err);
    if (req.files) {
      Object.values(req.files).flat().forEach(file => {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      });
    }
    return res.status(500).json({ message: "Error registering parent." });
  }
};


const registerWarden = async (req, res) => {
  const { firstName, lastName, email, contactNumber, salary } = req.body;

  try {
    const existingWarden = await Warden.findOne({ email });
    if (existingWarden) {
      return res.status(409).json({ message: "Warden already exists with the same email." });
    }

    // Auto-generate Warden ID
    const lastWarden = await Warden.findOne().sort({ createdAt: -1 });
    let newWardenId = "W001";
    if (lastWarden && lastWarden.wardenId) {
      const match = lastWarden.wardenId.match(/^W(\d+)$/i);
      if (match) {
        newWardenId = `W${String(parseInt(match[1], 10) + 1).padStart(3, "0")}`;
      }
    }

    const cleanName = firstName.replace(/\s+/g, '').toLowerCase();
    const wardenPassword = `${cleanName}${lastName}`;

    const newWarden = new Warden({ firstName, lastName, email, wardenId: newWardenId, contactNumber, salary, password: wardenPassword });
    await newWarden.save();

    // Send email using centralized utility
    const emailResult = await sendEmail({
      to: email,
      subject: 'Your Warden Panel Credentials',
      text: `Hello ${firstName} ${lastName},

Your warden account has been created.

• Warden Name: ${firstName} ${lastName}
• Warden ID: ${newWardenId}
• Your Login Password: ${wardenPassword}

Please log in at https://www.KGF-HM.com and change your password after first login.

– Hostel Admin`
    });
    const emailSent = emailResult.success;

    // Create audit log for warden registration
    await createAuditLog({
      adminId: req.admin?._id,
      adminName: req.admin?.adminId || 'System',
      actionType: AuditActionTypes.WARDEN_REGISTERED,
      description: `Registered new warden: ${firstName} ${lastName} (ID: ${newWardenId})`,
      targetType: 'Warden',
      targetId: newWardenId,
      targetName: `${firstName} ${lastName}`,
      additionalData: {
        email,
        contactNumber,
        salary
      }
    });

    return res.json({
      success: true,
      message: emailSent
        ? 'Warden registered and login credentials emailed.'
        : 'Warden registered successfully. Email could not be sent - please share credentials manually.',
      warden: { firstName, lastName, email, wardenId: newWardenId, wardenPassword, emailSent }
    });
  } catch (err) {
    console.error("Error registering warden:", err);
    return res.status(500).json({ message: "Error registering warden." });
  }
};


const getAllStudents = async (req, res) => {
  try {
    const students = await Student.find({}).select("-password").populate('roomBedNumber', 'itemName barcodeId floor roomNo').sort({ createdAt: -1 });
    
    // Fetch all beds to calculate room capacities (room types)
    const allBedItems = await Inventory.find({
      $or: [
        { category: { $in: ['Furniture', 'BEDS'] } },
        { itemName: { $regex: /Bed|B\d+/i } }
      ]
    });
    const capacityMap = {};
    allBedItems.forEach(bed => {
      if (bed.roomNo) {
        capacityMap[bed.roomNo] = (capacityMap[bed.roomNo] || 0) + 1;
      }
    });

    // Fetch all pending invoices to calculate dues
    const pendingInvoices = await StudentInvoice.find({ status: 'pending' });
    const duesMap = {};
    pendingInvoices.forEach(inv => {
      const sId = inv.studentId.toString();
      duesMap[sId] = (duesMap[sId] || 0) + inv.amount;
    });

    const transformedStudents = students.map((student) => {
      // Infer roomType if not explicitly set but a room is assigned
      const inferredRoomType = student.roomType || (student.roomBedNumber?.roomNo ? String(capacityMap[student.roomBedNumber.roomNo]) : "");

      return {
        id: student.studentId,
        firstName: student.firstName,
        lastName: student.lastName,
        studentId: student.studentId,
        contactNumber: student.contactNumber,
        roomBedNumber: student.roomBedNumber || 'Not Assigned',
        _id: student._id,
        email: student.email,
        admissionDate: student.admissionDate,
        feeStatus: student.feeStatus,
        dues: duesMap[student._id.toString()] || 0,
        roomType: inferredRoomType,
        emergencyContactName: student.emergencyContactName,
        emergencyContactNumber: student.emergencyContactNumber,
        hasCollegeId: student.hasCollegeId,
        isWorking: student.isWorking,
        documents: {
          aadharCard: student.documents?.aadharCard || null,
          panCard: student.documents?.panCard || null,
          studentIdCard: student.documents?.studentIdCard || null,
          feesReceipt: student.documents?.feesReceipt || null,
        },
        createdAt: student.createdAt,
        updatedAt: student.updatedAt,
      };
    });

    return res.json({
      success: true,
      message: "Students fetched successfully",
      students: transformedStudents,
      count: transformedStudents.length
    });

  } catch (err) {
    console.error("Error fetching students:", err);
    return res.status(500).json({ success: false, message: "Error fetching students." });
  }
};


const getStudentsWithoutParents = async (req, res) => {
  try {
    const studentsWithParents = await Parent.find({}, { studentId: 1 });
    const studentIdsWithParents = studentsWithParents.map(parent => parent.studentId);

    const studentsWithoutParents = await Student.find({
      studentId: { $nin: studentIdsWithParents }
    }).select('studentId firstName lastName');

    res.status(200).json({ success: true, students: studentsWithoutParents });
  } catch (error) {
    console.error('Error fetching students without parents:', error);
    res.status(500).json({ success: false, message: 'Server error while fetching students without parents' });
  }
};


// const updateStudent = async (req, res) => {
//   const { studentId } = req.params;
//   const {
//     firstName, lastName, contactNumber, email, roomBedNumber,
//     emergencyContactNumber, admissionDate, emergencyContactName, feeStatus,
//   } = req.body;

//   try {
//     const currentStudent = await Student.findOne({ studentId });
//     if (!currentStudent) {
//       return res.status(404).json({ message: 'Student not found.' });
//     }

//     const previousBedId = currentStudent.roomBedNumber;

//     const updatedStudent = await Student.findOneAndUpdate(
//       { studentId },
//       { firstName, lastName, contactNumber, email, roomBedNumber, emergencyContactNumber, admissionDate, emergencyContactName, feeStatus },
//       { new: true }
//     );

//     const newBedId = roomBedNumber;

//     if (previousBedId && previousBedId !== "Not Assigned" && previousBedId !== newBedId) {
//       await Inventory.findByIdAndUpdate(previousBedId, { status: "Available" }, { new: true });
//     }

//     if (newBedId && newBedId !== "Not Assigned" && newBedId !== previousBedId) {
//       const bedToAssign = await Inventory.findById(newBedId);
//       if (!bedToAssign) return res.status(404).json({ message: 'Selected bed not found.' });
//       if (bedToAssign.status === "In Use") return res.status(400).json({ message: 'Selected bed is already in use.' });
//       await Inventory.findByIdAndUpdate(newBedId, { status: "In Use" }, { new: true });
//     }

//     if (previousBedId && previousBedId !== "Not Assigned" && (!newBedId || newBedId === "Not Assigned")) {
//       await Inventory.findByIdAndUpdate(previousBedId, { status: "Available" }, { new: true });
//     }

//     await createAuditLog({
//       adminId: req.admin?._id,
//       adminName: req.admin?.adminId || 'System',
//       actionType: AuditActionTypes.STUDENT_UPDATED,
//       description: `Updated student: ${firstName} ${lastName} (ID: ${studentId})`,
//       targetType: 'Student',
//       targetId: studentId,
//       targetName: `${firstName} ${lastName}`,
//       additionalData: { previousBed: previousBedId, newBed: newBedId, email, feeStatus }
//     });

//     return res.json({ message: 'Student updated successfully.', student: updatedStudent });
//   } catch (err) {
//     console.error('Error updating student:', err);
//     return res.status(500).json({ message: 'Error updating student.' });
//   }
// };

const updateStudent = async (req, res) => {
  const { studentId } = req.params;
  const {
    firstName, lastName, contactNumber, email, roomBedNumber,
    emergencyContactNumber, admissionDate, emergencyContactName, feeStatus, hasCollegeId, isWorking, roomType
  } = req.body;

  try {
    const currentStudent = await Student.findOne({ studentId });
    if (!currentStudent) {
      return res.status(404).json({ message: 'Student not found.' });
    }

    const previousBedId = currentStudent.roomBedNumber;

    // ✅ Build update object with text fields
    const updateData = {
      firstName, lastName, contactNumber, email, roomBedNumber,
      emergencyContactNumber, admissionDate, emergencyContactName, feeStatus, hasCollegeId, isWorking, roomType
    };

    // ✅ Add document updates only if new files uploaded
    if (req.files) {
      if (req.files["aadharCard"]?.[0]) {
        updateData["documents.aadharCard"] = {
          filename: req.files["aadharCard"][0].filename,
          path: req.files["aadharCard"][0].path,
          uploadedAt: new Date()
        };
      }
      if (req.files["panCard"]?.[0]) {
        updateData["documents.panCard"] = {
          filename: req.files["panCard"][0].filename,
          path: req.files["panCard"][0].path,
          uploadedAt: new Date()
        };
      }
      if (req.files["studentIdCard"]?.[0]) {
        updateData["documents.studentIdCard"] = {
          filename: req.files["studentIdCard"][0].filename,
          path: req.files["studentIdCard"][0].path,
          uploadedAt: new Date()
        };
      }
      if (req.files["feesReceipt"]?.[0]) {
        updateData["documents.feesReceipt"] = {
          filename: req.files["feesReceipt"][0].filename,
          path: req.files["feesReceipt"][0].path,
          uploadedAt: new Date()
        };
      }
    }

    const updatedStudent = await Student.findOneAndUpdate(
      { studentId },
      updateData,
      { new: true }
    );

    // bed inventory logic stays same
    const newBedId = roomBedNumber;
    if (previousBedId && previousBedId !== "Not Assigned" && previousBedId !== newBedId) {
      await Inventory.findByIdAndUpdate(previousBedId, { status: "Available" });
    }
    if (newBedId && newBedId !== "Not Assigned" && newBedId !== previousBedId) {
      await Inventory.findByIdAndUpdate(newBedId, { status: "In Use" });
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
        feeStatus,
        isWorking
      }
    });

    return res.json({ message: 'Student updated successfully.', student: updatedStudent });

  } catch (err) {
    console.error('Error updating student:', err);
    return res.status(500).json({ message: 'Error updating student.' });
  }
};

const deleteStudent = async (req, res) => {
  const { studentId } = req.params;

  try {
    const existingStudent = await Student.findOne({ studentId });
    if (!existingStudent) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }

    const studentData = {
      firstName: existingStudent.firstName,
      lastName: existingStudent.lastName,
      email: existingStudent.email,
      contactNumber: existingStudent.contactNumber,
      roomBedNumber: existingStudent.roomBedNumber
    };

    await Student.deleteOne({ studentId });

    await createAuditLog({
      adminId: req.admin?._id,
      adminName: req.admin?.adminId || 'System',
      actionType: AuditActionTypes.STUDENT_DELETED,
      description: `Deleted student: ${studentData.firstName} ${studentData.lastName} (ID: ${studentId})`,
      targetType: 'Student',
      targetId: studentId,
      targetName: `${studentData.firstName} ${studentData.lastName}`,
      additionalData: { deletedStudentData: studentData }
    });

    return res.json({
      success: true,
      message: 'Student deleted successfully.',
      deletedStudent: { studentId, name: `${studentData.firstName} ${studentData.lastName}` }
    });
  } catch (err) {
    console.error('Error deleting student:', err);
    return res.status(500).json({ success: false, message: 'Error deleting student.' });
  }
};


const getStudentById = async (req, res) => {
  const { studentId } = req.params;

  try {
    const student = await Student.findOne({ studentId }).select('-password');
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }
    return res.json({ success: true, message: 'Student fetched successfully.', student });
  } catch (err) {
    console.error('Error fetching student:', err);
    return res.status(500).json({ success: false, message: 'Error fetching student.' });
  }
};


// ✅ NEW: Serve student document files directly
 const getStudentDocument = async (req, res) => {
  try {
    const { studentId, docType } = req.params;

    const allowedDocs = [
      "aadharCard",
      "panCard",
      "studentIdCard",
      "feesReceipt",
    ];

    if (!allowedDocs.includes(docType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid document type",
      });
    }

    const student = await Student.findOne({ studentId });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    const document = student.documents?.[docType];

    if (!document || !document.path) {
      return res.status(404).json({
        success: false,
        message: "Document not found",
      });
    }

    const filePath = path.resolve(document.path);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: "File missing on server",
      });
    }

    return res.sendFile(filePath);

  } catch (error) {
    console.error("Document view error:", error);

    return res.status(500).json({
      success: false,
      message: "Error opening document",
    });
  }
};


const getAllWardens = async (req, res) => {
  try {
    const wardens = await Warden.find({}).select("-password").sort({ createdAt: -1 });
    const otherStaff = await Staff.find({}).select("-password").sort({ createdAt: -1 });

    // Normalize other staff to look like wardens for the frontend
    const normalizedStaff = otherStaff.map(s => ({
      ...s.toObject(),
      wardenId: s.staffId, // Map staffId to wardenId for frontend compatibility
      role: s.designation || 'Staff'
    }));

    const allStaff = [
      ...wardens.map(w => ({ ...w.toObject(), role: 'Warden' })),
      ...normalizedStaff
    ];

    return res.json({
      success: true,
      message: "Staff members fetched successfully",
      wardens: allStaff,
      count: allStaff.length
    });
  } catch (err) {
    console.error("Error fetching staff:", err);
    return res.status(500).json({ success: false, message: "Error fetching staff members." });
  }
};

const getAllParents = async (req, res) => {
  try {
    const parents = await Parent.find({}).sort({ createdAt: -1 });

    return res.json({
      success: true,
      message: "Parents fetched successfully",
      parents,
      count: parents.length
    });
  } catch (err) {
    console.error("Error fetching parents:", err);
    return res.status(500).json({ success: false, message: "Error fetching parents." });
  }
};


// const getAllParents = async (req, res) => {
//   try {
//     const parents = await Parent.find({}).sort({ createdAt: -1 });
//     return res.json({
//       success: true,
//       parents,
//     });
//   } catch (err) {
//     console.error("Error fetching parents:", err);
//     return res.status(500).json({ success: false, message: "Error fetching parents." });
//   }
// };

const deleteParent = async (req, res) => {
  const { id } = req.params;
  try {
    const parent = await Parent.findByIdAndDelete(id);
    if (!parent) return res.status(404).json({ success: false, message: "Parent not found." });
    return res.json({ success: true, message: "Parent deleted successfully." });
  } catch (err) {
    console.error("Error deleting parent:", err);
    return res.status(500).json({ success: false, message: "Error deleting parent." });
  }
};

const updateParent = async (req, res) => {
  const { id } = req.params;
  const { firstName, lastName, email, relation, contactNumber } = req.body;
  try {
    const parent = await Parent.findByIdAndUpdate(
      id,
      { firstName, lastName, email, relation, contactNumber },
      { new: true }
    );
    if (!parent) return res.status(404).json({ success: false, message: "Parent not found." });
    return res.json({ success: true, parent });
  } catch (err) {
    console.error("Error updating parent:", err);
    return res.status(500).json({ success: false, message: "Error updating parent." });
  }
};

export {
  registerStudent,
  registerParent,
  registerWarden,
  getAllWardens,
  getAllStudents,
  getAllParents,
  getStudentsWithoutParents,
  getStudentById,
  updateStudent,
  deleteStudent,
  getStudentDocument,

  deleteParent,
  updateParent,
}