
import multer from "multer";
import path from "path";
import fs from "fs";

// Ensure uploads directory exists
const ensureUploadsDir = () => {
  const dirs = [
    'uploads/', 
    'uploads/wardens/', 
    'uploads/students/', 
    'uploads/parents/',
    'uploads/complaints/',
    'uploads/student-documents/',  // Add this
    'uploads/parent-documents/'     // Add this
  ];
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
};

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

const studentDocumentStorage = multer.diskStorage({
  destination: "uploads/student-documents/",
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `${req.body.email || 'temp'}-${file.fieldname}-${uniqueSuffix}${ext}`);
  }
});



// Parent storage engine
const parentStorage = multer.diskStorage({
  destination: "uploads/parents/",
  filename: (req, file, cb) => {
    // Get studentId from the authenticated parent (from middleware)
    const studentId = req.studentId || 'unknown';
    cb(null, `parent_${studentId}_${Date.now()}${path.extname(file.originalname)}`);
  },
});

const parentDocumentStorage = multer.diskStorage({
  destination: "uploads/parent-documents/",
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `${req.body.email || 'temp'}-${file.fieldname}-${uniqueSuffix}${ext}`);
  }
});

const documentFileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.'));
  }
};

// Complaint storage engine
const complaintStorage = multer.diskStorage({
  destination: "uploads/complaints/",
  filename: (req, file, cb) => {
    // Use a generic timestamp since req.body.studentId might not be available yet
    // The studentId will be available in the controller via req.studentId from auth middleware
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    cb(null, `complaint_${timestamp}_${randomStr}${path.extname(file.originalname)}`);
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

// File filter for images and videos (for complaints)
const mediaFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|gif|mp4|mov|avi|webm/;
  const ext = allowed.test(path.extname(file.originalname).toLowerCase());
  const mimeAllowed = /image\/(jpeg|jpg|png|gif)|video\/(mp4|quicktime|x-msvideo|webm)/;
  const mime = mimeAllowed.test(file.mimetype);
     
  if (ext && mime) {
    return cb(null, true);
  }
  cb(new Error("Only image files (.jpg, .jpeg, .png, .gif) and video files (.mp4, .mov, .avi, .webm) are allowed"));
};

// Create multer instances
export const uploadWarden = multer({ 
  storage: wardenStorage,
  fileFilter: imageFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  }
});

export const uploadStudentDocuments = multer({
  storage: studentDocumentStorage,
  fileFilter: documentFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

export const uploadParentDocuments = multer({
  storage: parentDocumentStorage,
  fileFilter: documentFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

export const uploadStudent = multer({ 
  storage: studentStorage,
  fileFilter: imageFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  }
});

export const uploadParent = multer({ 
  storage: parentStorage,
  fileFilter: imageFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  }
});

// New upload for complaints (supports images and videos)
export const uploadComplaint = multer({ 
  storage: complaintStorage,
  fileFilter: mediaFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit for videos
  }
});

// Keep existing export for backward compatibility
export const upload = uploadWarden;