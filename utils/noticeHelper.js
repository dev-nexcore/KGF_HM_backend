import { Student } from "../models/student.model.js";
import { Parent } from "../models/parent.model.js";
import { Warden } from "../models/warden.model.js";
import { Staff } from "../models/staff.model.js";
import { Notice } from "../models/notice.model.js";
import sendEmail from "./sendEmail.js";
import { sendBulkNotifications } from "./sendNotification.js";

export const issueNoticeHelper = async (notice) => {
  try {
    const { title, message, issueDate, recipientType, individualRecipient } = notice;

    // ---------------- RECIPIENT LOGIC ----------------
    let recipients = [];
    let studentRecipients = [];

    if (recipientType === "All") {
      const students = await Student.find({}, "_id email");
      const parents = await Parent.find({}, "email");
      const wardens = await Warden.find({}, "email");
      const staffList = await Staff.find({}, "email");

      studentRecipients = students;

      recipients = [
        ...students.map(s => s.email),
        ...parents.map(p => p.email),
        ...wardens.map(w => w.email),
        ...staffList.map(s => s.email)
      ].filter(Boolean);

    } else if (recipientType === "Student") {
      if (!individualRecipient) {
        const students = await Student.find({ studentId: { $not: /^STUW/ } }, "_id email");
        studentRecipients = students;
        recipients = students.map(s => s.email).filter(Boolean);
      } else {
        const student = await Student.findOne(
          { studentId: individualRecipient },
          "_id email"
        );
        if (student?.email) recipients.push(student.email);
        if (student) studentRecipients.push(student);
      }

    } else if (recipientType === "Parent") {
      if (!individualRecipient) {
        const parents = await Parent.find({}, "email");
        recipients = parents.map(p => p.email).filter(Boolean);
      } else {
        const parent = await Parent.findOne({ studentId: individualRecipient });
        if (parent?.email) recipients.push(parent.email);
      }

    } else if (recipientType === "Warden") {
      if (!individualRecipient) {
        const wardens = await Warden.find({}, "email");
        recipients = wardens.map(w => w.email).filter(Boolean);
      } else {
        const warden = await Warden.findOne({ wardenId: individualRecipient });
        if (warden?.email) recipients.push(warden.email);
      }
    } else if (recipientType === "Worker") {
      if (!individualRecipient) {
        const staffList = await Student.find({ studentId: { $regex: /^STUW/ } }, "_id email");
        studentRecipients = staffList;
        recipients = staffList.map(s => s.email).filter(Boolean);
      } else {
        const staff = await Student.findOne({ studentId: individualRecipient }, "_id email");
        if (staff?.email) recipients.push(staff.email);
        if (staff) studentRecipients.push(staff);
      }
    }

    if (recipients.length === 0) {
      console.log(`No recipients found for notice ${notice._id}`);
      return false;
    }

    // ---------------- EMAIL CONTENT ----------------
    const subject = `Hostel Notice: ${title}`;
    const istDateTime = new Date(issueDate).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata"
    });

    const emailHtml = `
      <p style="margin: 0 0 10px; font-size: 11px; font-weight: 700; color: #0066cc; text-transform: uppercase; letter-spacing: 1px;">Hostel Notice</p>
      <h2 style="margin: 0 0 20px; font-size: 24px; color: #0f172a; font-weight: 700;">${title}</h2>
      
      <p style="margin: 0 0 25px; font-size: 15px; color: #475569; line-height: 1.6;">
        Dear Resident/Staff,<br/><br/>
        <span style="white-space: pre-wrap;">${message}</span>
      </p>

      <div style="border: 1px solid #e2e8f0; border-left: 4px solid #0066cc; border-radius: 6px; padding: 25px; margin-bottom: 25px; background-color: #f8fafc;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0">
          <tr>
            <td style="padding: 0 0 0; font-size: 14px; color: #64748b; width: 40%;">Issued On</td>
            <td style="padding: 0 0 0; font-size: 14px; font-weight: 600; text-align: right; width: 60%;">${istDateTime}</td>
          </tr>
        </table>
      </div>
      <p style="margin: 0; font-size: 15px; color: #475569;">Please ensure you follow all hostel guidelines. If you have any questions, please contact the hostel administration.</p>
    `;

    // ---------------- SEND EMAILS ----------------
    await Promise.all(
      recipients.map(email =>
        sendEmail({
          to: email,
          subject,
          html: emailHtml,
          useKGFLayout: true
        }).catch(err => console.error(`Failed to send notice email to ${email}:`, err))
      )
    );

    // ---------------- PUSH NOTIFICATIONS ----------------
    if (studentRecipients.length > 0) {
      try {
        await sendBulkNotifications(
          studentRecipients,
          `New notice: ${title}`,
          "notice",
          "/notices"
        );
      } catch (notificationError) {
        console.error("Failed to send push notifications:", notificationError);
      }
    }

    return true;
  } catch (error) {
    console.error("Error in issueNoticeHelper:", error);
    return false;
  }
};
