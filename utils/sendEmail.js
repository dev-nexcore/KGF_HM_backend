//KGF_HM_backend\utils\sendEmail.js

import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';

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

export const generateEmailLayout = (title, content) => {
  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
  </head>
  <body style="margin: 0; padding: 0; background-color: #f4f7fb; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; -webkit-font-smoothing: antialiased;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4f7fb; padding: 20px 10px;">
      <tr>
        <td align="center">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);">
            <!-- Header -->
            <tr>
              <td align="center" style="background-color: #0f172a; padding: 40px 20px; border-bottom: 1px solid #1e293b;">
                <img src="cid:kgflogo" alt="KGF Logo" style="width: 80px; height: auto; margin-bottom: 15px; border-radius: 8px; background-color: #ffffff; padding: 4px; display: inline-block; box-shadow: 0 2px 4px rgba(0,0,0,0.1);" />
                
                <p style="margin: 0; font-size: 10px; font-weight: 700; letter-spacing: 2px; color: #94a3b8; text-transform: uppercase;">Kokan Global Foundation</p>
                <h1 style="margin: 10px 0 10px; font-size: 28px; font-weight: 800; letter-spacing: -0.5px; mso-line-height-rule: exactly; line-height: 1.2;">
                  <span style="color: #0066cc;">K</span><span style="color: #00a651;">G</span><span style="color: #0066cc;">F</span> 
                  <span style="color: #ffffff;">Boys Hostel</span>
                </h1>
                <p style="margin: 0; font-size: 13px; color: #94a3b8; font-weight: 600;">Hostel Management System</p>
              </td>
            </tr>
            <!-- Body -->
            <tr>
              <td style="padding: 40px 30px;">
                ${content}
              </td>
            </tr>
          </table>
          <!-- Footer -->
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px;">
            <tr>
              <td align="center" style="padding-top: 30px;">
                <p style="font-size: 12px; color: #94a3b8; margin: 0;">&copy; ${new Date().getFullYear()} Kokan Global Foundation. All rights reserved.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
  `;
};

const originalSendMail = transporter.sendMail.bind(transporter);

transporter.sendMail = async (mailOptions) => {
  // Always use KGF layout unless explicitly set to false
  if (mailOptions.useKGFLayout !== false) {
    // Prevent double wrapping if the HTML already has the KGF layout
    const isAlreadyWrapped = mailOptions.html && typeof mailOptions.html === 'string' && mailOptions.html.includes('cid:kgflogo');
    
    if (!isAlreadyWrapped) {
      let content = mailOptions.html;
      if (!content && mailOptions.text) {
        content = `<p style="margin: 0 0 15px; font-size: 15px; color: #475569; line-height: 1.6; white-space: pre-wrap;">${mailOptions.text}</p>`;
      }
      
      if (content) {
        mailOptions.html = generateEmailLayout(mailOptions.subject || 'Notification', content);
        
        const defaultAttachments = [{
          filename: 'logo.png',
          path: path.join(process.cwd(), 'assets', 'logo.png'),
          cid: 'kgflogo'
        }];
        mailOptions.attachments = mailOptions.attachments ? [...defaultAttachments, ...mailOptions.attachments] : defaultAttachments;
      }
    }
  }

  return await originalSendMail(mailOptions);
};

export default async function sendEmail(options) {
  try {
    const mailOptions = {
      from: `"${options.fromName || "Hostel Admin"}" <${process.env.MAIL_USER || process.env.SMTP_EMAIL}>`,
      to: options.to,
      subject: options.subject,
    };

    if (options.text) mailOptions.text = options.text;
    if (options.html) mailOptions.html = options.html;
    if (options.attachments) mailOptions.attachments = options.attachments;
    if (options.useKGFLayout !== undefined) mailOptions.useKGFLayout = options.useKGFLayout;

    const info = await transporter.sendMail(mailOptions);
    console.log(`📧 Email sent to ${options.to}: ${info.messageId}`);
    return { success: true, info };
  } catch (error) {
    console.error(`❌ Email failed to ${options.to}:`, error.message);
    return { success: false, error };
  }
}

export { transporter };
