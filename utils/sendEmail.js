//KGF_HM_backend\utils\sendEmail.js

import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST || 'smtp.gmail.com',
  port: +process.env.MAIL_PORT || 465,
  secure: process.env.MAIL_SECURE === "true" || process.env.MAIL_PORT == 465,
  auth: {
    user: process.env.MAIL_USER || process.env.SMTP_EMAIL,
    pass: (process.env.MAIL_PASS || process.env.SMTP_PASS)?.trim().replace(/\s+/g, ''),
  },
  tls: {
    rejectUnauthorized: false
  }
});

export default async function sendEmail({ to, subject, text, html, fromName = "Hostel Admin" }) {
  try {
    const mailOptions = {
      from: `"${fromName}" <${process.env.MAIL_USER || process.env.SMTP_EMAIL}>`,
      to,
      subject,
    };

    if (text) mailOptions.text = text;
    if (html) mailOptions.html = html;

    const info = await transporter.sendMail(mailOptions);
    console.log(`📧 Email sent to ${to}: ${info.messageId}`);
    return { success: true, info };
  } catch (error) {
    console.error(`❌ Email failed to ${to}:`, error.message);
    return { success: false, error };
  }
}

export { transporter };
