import jwt from 'jsonwebtoken';

export const verifyTokenAdmin = (req, res, next) => {
  const adminHeader = req?.headers?.authorization;
  if (!adminHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ 
        error: 'Token missing' 
    });
  }

  const token = adminHeader?.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET_ADMIN);
    req.admin = decoded;
    next();
  } catch {
    return res.status(403).json({ 
        error: 'Invalid or expired token' 
    });
  }
};
