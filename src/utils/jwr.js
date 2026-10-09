const jwt = require('jsonwebtoken');
const crypto = require('crypto');


const SIGN_SECRET = process.env.JWT_SECRET;

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

module.exports = { hash, signToken, verifyToken, refreshToken };

