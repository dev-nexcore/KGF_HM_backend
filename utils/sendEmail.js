//KGF_HM_backend\utils\sendEmail.js

import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.MAIL_USER || process.env.SMTP_EMAIL,
    pass: (process.env.MAIL_PASS || process.env.SMTP_PASS)?.trim().replace(/\s+/g, ''),
  },
  tls: {
    rejectUnauthorized: false // Helps in some environments
  }
});

export default async function sendEmail({ to, subject, text, fromName = "Hostel Admin" }) {
  try {
    const info = await transporter.sendMail({
      from: `"${fromName}" <${process.env.MAIL_USER || process.env.SMTP_EMAIL}>`,
      to,
      subject,
      text,
    });
    console.log(`📧 Email sent to ${to}: ${info.messageId}`);
    return { success: true, info };
  } catch (error) {
    console.error(`❌ Email failed to ${to}:`, error.message);
    return { success: false, error };
  }
}
