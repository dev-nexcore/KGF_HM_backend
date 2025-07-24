import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_PASS,
  },
});

export default async function sendEmail({ to, subject, text }) {
  await transporter.sendMail({
    from: `"KGF Hostel" <${process.env.SMTP_EMAIL}>`,
    to,
    subject,
    text,
  });
}
