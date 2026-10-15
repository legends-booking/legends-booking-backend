const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const SIGN_SECRET = process.env.JWT_SECRET;
/**
 * Verifies the Bearer token and attaches { id, role } to req.user.
 */
const requireAuth = (req, res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }

  try {
    const payload = verifyToken(token);
    req.userInfo = {id: payload.sub, role: payload.role}; // { sub, role }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Use after requireAuth. Restricts a route to one or more roles, e.g. requireRole('admin').
 */
const requireRole = (...allowedRoles) => {
  
  return (req, res, next) => {
    console.log(req.userInfo);
    if (!req.userInfo || !allowedRoles.includes(req.userInfo.role)) {
      return res.status(403).json({ error: 'Forbidden: insufficient permissions' });
    }
    next();
  };
}

/**
 * 
 * @param {string} s 
 * @returns 
 */
const hash = (s) => {return crypto.createHash('sha256').update(s).digest('hex')};

/**
 * 
 * @param {string} id 
 * @param {string} role 
 * @returns 
 */
const signToken = (id, role) => {
 return jwt.sign({role: role}, SIGN_SECRET, 
  { subject: String(id),
    expiresIn: '1h',
    algorithm: 'HS256'
  });
  
}

/**
 * 
 * @param {string} token 
 * @returns 
 */
const verifyToken = (token) =>  {
  return jwt.verify(token, SIGN_SECRET);
}


const refreshToken =() =>{return crypto.randomBytes(32).toString('base64')}

module.exports = { requireAuth, requireRole, signToken, verifyToken, refreshToken, hash };
