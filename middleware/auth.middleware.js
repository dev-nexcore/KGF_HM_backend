// middleware/auth.middleware.js (ADD STUDENT AUTH)
import jwt from 'jsonwebtoken';
import { Parent } from '../models/parent.model.js';
import { Student } from '../models/student.model.js'

const verifyAdminToken = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: "Unauthorized access" });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Add the missing _id field
        req.admin = {
            _id: decoded.adminId, // Map adminId to _id for audit logs
            adminId: decoded.adminId,
            email: decoded.email
        };
        
        next();
    } catch (err) {
        return res.status(401).json({ message: "Invalid token" });
    }
};

const verifyWardenToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  // Check if Authorization header is present and starts with Bearer
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Access denied. No token provided." });
  }

  const token = authHeader.split(" ")[1];

  try {
    // Verify the token using your secret key
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Attach the decoded user to the request for use in controllers
    req.user = decoded;

    next(); // Proceed to the route/controller
  } catch (err) {
    res.status(403).json({ message: "Invalid or expired token." });
  }
};

const authenticateParent = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    // Verify the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Find the parent
    const parent = await Parent.findOne({ studentId: decoded.studentId });
    if (!parent) {
      return res.status(401).json({ message: 'Invalid token - parent not found' });
    }

    // Add parent info to request object
    req.parent = parent;
    req.studentId = decoded.studentId;
    
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token' });
    } else if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    
    return res.status(500).json({ message: 'Server error during authentication' });
  }
};


 const verifyStudentToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role !== 'student') {
      return res.status(403).json({ message: 'Forbidden: role mismatch' });
    }

    // Prefer sub for canonical user id
    const student = await Student.findById(decoded.sub).select('-password');
    if (!student) {
      return res.status(401).json({ message: 'Invalid token - student not found' });
    }

    req.student = student;
    req.studentId = student.studentId;
    
    req.user = { _id: student._id, role: 'student', email: student.email, studentId: student.studentId };

    return next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    return res.status(403).json({ message: 'Invalid token' });
  }
};





export{
    verifyAdminToken,
    verifyWardenToken,
    authenticateParent,
    verifyStudentToken,
};