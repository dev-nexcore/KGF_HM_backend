import cron from "node-cron";
import { Notice } from "../models/notice.model.js";
import { issueNoticeHelper } from "../utils/noticeHelper.js";

// Run once a day at midnight
const startNoticeSchedulerCron = () => {
  cron.schedule("0 0 * * *", async () => {
    try {
      console.log("🕒 Running Notice Scheduler Cron...");

      const now = new Date();

      // 1. Issue Scheduled Notices
      const scheduledNotices = await Notice.find({
        isIssued: false,
        issueDate: { $lte: now },
        status: "Active"
      });

      if (scheduledNotices.length > 0) {
        console.log(`Found ${scheduledNotices.length} scheduled notices to issue.`);
        for (const notice of scheduledNotices) {
          const success = await issueNoticeHelper(notice);
          if (success) {
            notice.isIssued = true;
            await notice.save();
            console.log(`Successfully issued notice: ${notice._id}`);
          }
        }
      }

      // 2. Archive Expired Notices
      const expiredNotices = await Notice.find({
        status: "Active",
        expiryDate: { $lt: now }
      });

      if (expiredNotices.length > 0) {
        console.log(`Found ${expiredNotices.length} expired notices to archive.`);
        for (const notice of expiredNotices) {
          notice.status = "Archived";
          await notice.save();
          console.log(`Archived notice: ${notice._id}`);
        }
      }

      console.log("✅ Notice Scheduler Cron Completed.");
    } catch (error) {
      console.error("❌ Error in Notice Scheduler Cron:", error);
    }
  });
};

export default startNoticeSchedulerCron;
