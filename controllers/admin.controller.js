import 'dotenv/config';
import nodemailer from 'nodemailer';

// simple in-memory stores
const otpStore = {};       
const studentStore = [];  // { [email]: { code, expires, verified } }
let adminPassword = process.env.ADMIN_PASSWORD;

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

const login = (req, res) => {
  const { adminId, password } = req.body;
  if (
    adminId !== process.env.ADMIN_ID ||
    password !== adminPassword
  ) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }
  // TODO: issue JWT or session here
  return res.json({ message: 'Login successful' });
};

const forgotPassword = async (req, res) => {
  const { email } = req.body;
  if (email !== process.env.ADMIN_EMAIL) {
    return res.status(400).json({ message: 'Email not recognized' });
  }

  const otp = String(Math.floor(100000 + Math.random() * 900000));
  otpStore[email] = {
    code: otp,
    expires: Date.now() + 10 * 60 * 1000,
    verified: false
  };

  await transporter.sendMail({
    from:`"Hostel Admin" <${process.env.MAIL_USER}>`,
    to: email,
    subject: 'Admin Password Reset OTP',
    text: `Your OTP is ${otp}. Expires in 10 minutes.`
  });

  return res.json({ message: 'OTP sent' });
};

const verifyOtp = (req, res) => {
  const { email, otp } = req.body;
  const record = otpStore[email];
  if (
    !record ||
    record.code !== otp ||
    record.expires < Date.now()
  ) {
    return res.status(400).json({ message: 'Invalid or expired OTP' });
  }
  record.verified = true;
  return res.json({ message: 'OTP verified' });
};

const resetPassword = (req, res) => {
  const { email, otp, newPassword } = req.body;
  const record = otpStore[email];
  if (
    !record ||
    record.code !== otp ||
    !record.verified
  ) {
    return res.status(400).json({ message: 'OTP not verified' });
  }

  adminPassword = newPassword;
  delete otpStore[email];
  return res.json({ message: 'Password has been reset' });
};

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
  const password  = `${cleanName}${studentId}`;

  // Store student record (in-memory demo)
  const studentRecord = {
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
  };
  studentStore.push(studentRecord);

  // Email credentials to student
  try {
    await transporter.sendMail({
      from:    `"Hostel Admin" <${process.env.MAIL_USER}>`,
      to:       email,
      subject: 'Your Student Panel Credentials',
      text:    `Hello ${studentName},

Your student account has been created.

• Student ID: ${studentId}
• Password:   ${password}

Please log in at https://www.KGF-HM.com and change your password after first login.

– Hostel Admin`
    });
  } catch (err) {
    console.error('Error sending student credentials:', err);
    return res
      .status(500)
      .json({ message: 'Student registered but failed to send email.' });
  }

  return res.json({
    message: 'Student registered and credentials emailed.',
    student: { studentName, studentId, email }
  });
};

export {
    resetPassword,
    verifyOtp,
    forgotPassword,
    login,
    registerStudent
};
