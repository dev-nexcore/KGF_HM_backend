import cron from 'node-cron';
import { StudentInvoice } from '../models/studentInvoice.model.js';
import { Parent } from '../models/parent.model.js';
import { Student } from '../models/student.model.js';
import sendEmail from '../utils/sendEmail.js';

// Schedule the task to run every day at 8:00 AM
const startFeeReminderCron = () => {
  cron.schedule('0 8 * * *', async () => {
    console.log('Running Fee Reminder Cron Job...');
    
    try {
      const today = new Date();
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();
      const dayOfMonth = today.getDate();
      const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

      // Only run the logic on 20th, 25th, or the last day of the month
      if (dayOfMonth !== 20 && dayOfMonth !== 25 && dayOfMonth !== lastDayOfMonth) {
        return; // Not a reminder day
      }

      // Find all pending or overdue invoices for hostel fees
      const pendingInvoices = await StudentInvoice.find({
        status: { $in: ['pending', 'overdue'] },
        invoiceType: 'hostel_fee'
      }).populate('studentId');

      for (const invoice of pendingInvoices) {
        if (!invoice.studentId || !invoice.dueDate) continue;

        const dueDate = new Date(invoice.dueDate);
        
        // Check if the due date falls in the current month and year
        if (dueDate.getMonth() === currentMonth && dueDate.getFullYear() === currentYear) {
          const student = invoice.studentId;
          const parent = await Parent.findOne({ studentId: student.studentId });
          
          if (!parent) continue; // No parent registered

          const formattedDueDate = dueDate.toLocaleDateString('en-GB');
          const amountDue = invoice.amount;
          
          let reminderType = '';
          if (dayOfMonth === 20) reminderType = 'First Reminder';
          else if (dayOfMonth === 25) reminderType = 'Second Reminder';
          else reminderType = 'Final Reminder';

          const emailSubject = `${reminderType}: Hostel Fee Due for ${student.firstName} ${student.lastName}`;
          
          const emailHtml = `
            <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
              <h2 style="color: #4F8DCF;">KGF Hostel Management</h2>
              <p>Dear ${parent.firstName} ${parent.lastName},</p>
              <p>This is a <strong>${reminderType.toLowerCase()}</strong> that the hostel fee for your ward, <strong>${student.firstName} ${student.lastName}</strong>, is due this month.</p>
              
              <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #4F8DCF;">
                <p><strong>Invoice Details:</strong></p>
                <ul>
                  <li><strong>Invoice Number:</strong> ${invoice.invoiceNumber}</li>
                  <li><strong>Amount Due:</strong> Rs. ${amountDue.toLocaleString()}</li>
                  <li><strong>Due Date:</strong> ${formattedDueDate}</li>
                </ul>
              </div>
              
              <p>Please log in to the Parent Portal to complete the payment via online channels, QR Code, or cash deposit at the earliest to avoid any late fees.</p>
              
              <p>Best Regards,<br/><strong>KGF Hostel Administration</strong></p>
            </div>
          `;

          // Send email to parent
          await sendEmail({
            to: parent.email,
            subject: emailSubject,
            html: emailHtml,
            fromName: 'KGF Hostel Admin'
          });
          
          console.log(`Sent ${reminderType} to parent ${parent.email} for student ${student.studentId}`);
        }
      }
    } catch (error) {
      console.error('Error in Fee Reminder Cron Job:', error);
    }
  });
  
  console.log('Fee Reminder Cron Job Scheduled (Runs at 8:00 AM daily).');
};

export default startFeeReminderCron;
