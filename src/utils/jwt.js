const jwt = require('jsonwebtoken');
/**
 * 
 * @param {object} payload 
 * @returns JSON Web Token string
 */
function signToken(payload) {
  /** @type {import('jsonwebtoken').SignOptions} */
  const options = {

     expiresIn: /** @type {import('ms').StringValue} */(process.env.JWT_EXPIRES_IN||'7d')
  }
  return jwt.sign(payload, process.env.JWT_SECRET, options);
}

/**
 * 
 * @param {String} token 
 * @returns Decoded payload
*/
function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

module.exports = { signToken, verifyToken };
