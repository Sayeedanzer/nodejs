import jwt from 'jsonwebtoken';


export const verifyTokenInstructor = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ 
      error: 'Token missing' 
    });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.instructor = decoded;
    // console.log("Instructor ID:", req.instructor.id);
    next();
  } catch {
    return res.status(403).json({ 
      error: 'Invalid or expired token' 
    });
  }
};
