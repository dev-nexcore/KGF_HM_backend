
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

    const student = await Student.findById(decoded.sub).select('-password');
    if (!student) {
      return res.status(401).json({ message: 'Invalid token - student not found' });
    }

    req.student = student;
    req.studentId = student.studentId;
    req.jwt = decoded;
    req.user = {
      _id: student._id,
      role: 'student',
      email: student.email,
      studentId: student.studentId,
    };

    return next();
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error("JWT Error:", error);
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    return res.status(401).json({ message: 'Invalid token' });
  }
};

const verifyStudentOrParentToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    console.log('🔍 Token decoded:', decoded);
    
    // 🔧 UPDATED LOGIC based on your actual token structure
    if (decoded.studentId && decoded.email && !decoded.role && !decoded.sub) {
      // Parent token logic - has studentId and email, but no role or sub
      console.log('🔍 Detected parent token (studentId + email)');
      
      const parent = await Parent.findOne({ studentId: decoded.studentId });
      if (!parent) {
        console.log('❌ Parent not found for studentId:', decoded.studentId);
        return res.status(401).json({ message: 'Invalid parent token - parent not found' });
      }
      
      console.log('✅ Parent found:', parent.firstName, parent.lastName);
      
      req.parent = parent;
      req.studentId = decoded.studentId;
      req.userType = 'parent';
      req.user = {
        _id: parent._id,
        role: 'parent',
        email: decoded.email,
        studentId: decoded.studentId,
      };
      
    } else if (decoded.role === 'student' && decoded.sub) {
      // Student token logic - has role=student and sub
      console.log('🔍 Detected student token (role + sub)');
      
      const student = await Student.findById(decoded.sub).select('-password');
      if (!student) {
        console.log('❌ Student not found for sub:', decoded.sub);
        return res.status(401).json({ message: 'Invalid student token - student not found' });
      }
      
      console.log('✅ Student found:', student.firstName, student.lastName);
      
      req.student = student;
      req.studentId = student.studentId;
      req.userType = 'student';
      req.user = {
        _id: student._id,
        role: 'student',
        email: student.email,
        studentId: student.studentId,
      };
      
    } else {
      console.log('❌ Invalid token format. Token contents:', decoded);
      console.log('Token keys:', Object.keys(decoded));
      return res.status(401).json({ 
        message: 'Invalid token format',
        debug: {
          hasStudentId: !!decoded.studentId,
          hasEmail: !!decoded.email,
          hasRole: !!decoded.role,
          hasSub: !!decoded.sub
        }
      });
    }
    
    console.log('✅ Authentication successful for:', req.userType);
    next();
    
  } catch (error) {
    console.error('❌ Authentication error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token' });
    } else if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    
    return res.status(500).json({ message: 'Server error during authentication' });
  }
};

export {
    verifyAdminToken,
    verifyWardenToken,
    authenticateParent,
    verifyStudentToken,
    verifyStudentOrParentToken,
};