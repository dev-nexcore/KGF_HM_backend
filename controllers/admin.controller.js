import 'dotenv/config';
import nodemailer from 'nodemailer';

// simple in-memory stores
const otpStore = {};               // { [email]: { code, expires, verified } }
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

export const login = (req, res) => {
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

export const forgotPassword = async (req, res) => {
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
    from: process.env.MAIL_USER,
    to: email,
    subject: 'Admin Password Reset OTP',
    text: `Your OTP is ${otp}. Expires in 10 minutes.`
  });

  return res.json({ message: 'OTP sent' });
};

export const verifyOtp = (req, res) => {
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

export const resetPassword = (req, res) => {
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
