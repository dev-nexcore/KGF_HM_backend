import multer from "multer";
import path from "path";

// Set storage engine
const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    cb(null, `warden_${Date.now()}${path.extname(file.originalname)}`);
  },
}); 

// File filter
const fileFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png/;
  const ext = allowed.test(path.extname(file.originalname).toLowerCase());
  const mime = allowed.test(file.mimetype);
  if (ext && mime) return cb(null, true);
  cb("Only .jpg, .jpeg, .png files allowed");
};

export const upload = multer({ storage, fileFilter });
