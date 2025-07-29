import jwt from 'jsonwebtoken';

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




export{
    verifyAdminToken,
    verifyWardenToken,
};
