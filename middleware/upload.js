// ============================================
// UPDATED middleware/upload.js
// ============================================
import multer from "multer";
import path from "path";
import fs from "fs";

// Ensure uploads directory exists
const ensureUploadsDir = () => {
  const dirs = ['uploads/', 'uploads/wardens/', 'uploads/students/'];
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
};

// Call this when the module loads
ensureUploadsDir();

// Warden storage engine
const wardenStorage = multer.diskStorage({
  destination: "uploads/wardens/",
  filename: (req, file, cb) => {
    cb(null, `warden_${Date.now()}${path.extname(file.originalname)}`);
  },
});

// Student storage engine
const studentStorage = multer.diskStorage({
  destination: "uploads/students/",
  filename: (req, file, cb) => {
    const { studentId } = req.params;
    cb(null, `student_${studentId}_${Date.now()}${path.extname(file.originalname)}`);
  },
});

// File filter for images
const imageFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|gif/;
  const ext = allowed.test(path.extname(file.originalname).toLowerCase());
  const mime = allowed.test(file.mimetype);
  
  if (ext && mime) {
    return cb(null, true);
  }
  cb(new Error("Only .jpg, .jpeg, .png, .gif files are allowed"));
};

// Create multer instances
export const uploadWarden = multer({ 
  storage: wardenStorage, 
  fileFilter: imageFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  }
});

export const uploadStudent = multer({ 
  storage: studentStorage, 
  fileFilter: imageFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  }
});

// Keep existing export for backward compatibility
export const upload = uploadWarden;