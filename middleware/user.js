import jwt from 'jsonwebtoken';

export const verifyTokenUser = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ 
        error: 'Token missing' 
    });
  }

  const token = authHeader?.split(' ')[1];
  try {
    // console.log("token", token)
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    // console.log("line 15", req.user.id)
    next();
  } catch {
    return res.status(403).json({ 
        error: 'Invalid or expired token' 
    });
  }
};



export const parseUserToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
    } catch {
      req.user = null; // token invalid
    }
  } else {
    req.user = null; // token missing
  }
  next();
};
