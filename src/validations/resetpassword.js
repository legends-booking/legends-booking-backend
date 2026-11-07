const { hash } = require("../middleware/auth");
const { query } = require("../db/pool");

const validateForPasswordReset = async(req, res , next) => {
    const {token, password, purpose} = req.body;
    if(!token || !password || !purpose){
        return res.status(400).json({ error: 'token, password, and purpose are required' });
    }
    if (password.length < 8) {
        return res.status(422).json({ error: 'Password must be at least 8 characters.' })
    }
    const tokenHash = hash(token);
    const passwordHash = hash(password);
    const {rows: [validToken]} = await query(
      'SELECT app_user, purpose, expires_at, used_at FROM auth_token WHERE token_hash = $1 AND expires_at > now() AND purpose = $2 AND used_at IS NULL',
      [tokenHash, purpose]
    );
    if(!validToken){
        return res.status(410).json({ error: 'Invalid or expired token' });
    }
    const {rows: [appUser]} = await query(
      'SELECT * FROM app_user WHERE id = $1',
      [validToken.app_user]
    )
    if(appUser.password_hash === passwordHash){
        return res.status(422).json({ error: 'New password cannot be the same as the old password' });
    }
    next();
}

module.exports = {validateForPasswordReset};