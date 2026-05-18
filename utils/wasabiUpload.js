import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import dotenv from "dotenv";
dotenv.config();

export const getDistanceKm = (lat1, lon1, lat2, lon2) => {
  const toRad = (x) => (x * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const uploadSelfie = async (base64, fileName) => {
  try {
    // Ensure the uploads/selfies directory exists
    const uploadDir = path.join(process.cwd(), 'uploads', 'selfies');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const buffer = Buffer.from(base64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
    const filePath = path.join(uploadDir, fileName);

    fs.writeFileSync(filePath, buffer);

    // Construct the URL
    // Use BACKEND_URL from .env or fallback to relative path
    const backendUrl = process.env.BACKEND_URL || '';
    return `${backendUrl}/uploads/selfies/${fileName}`;
  } catch (err) {
    console.error("❌ Local selfie upload failed:", err);
    throw new Error("Failed to save selfie to server storage");
  }
};
