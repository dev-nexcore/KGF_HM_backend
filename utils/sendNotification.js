import {Notification} from '../models/notification.model.js';

export const sendNotification = async ({ studentId, message, type, link }) => {
  try {
    await Notification.create({ studentId, message, type, link });
  } catch (err) {
    console.error("Error sending notification:", err);
  }
};

export const sendBulkNotifications = async (students, message, type, link) => {
  const notifications = students.map((s) => ({
    studentId: s._id,
    message,
    type,
    link,
  }));
  await Notification.insertMany(notifications);
};