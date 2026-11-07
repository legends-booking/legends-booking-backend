const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { query } = require('../db/pool');
const { signToken, refreshToken, hash } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { transaction } = require('../utils/transaction');
const { sendInvitationEmail } = require('../password_reset/invitation_email');
const { validateForPasswordReset } = require('../validations/resetpassword');

const router = express.Router();
const SALT_ROUNDS = 12;
const REFRESH_TOKEN_MAX_AGE = 30 * 24 * 60 * 60 * 1000;
const COOL_DOWN_TIME = 60; // 60 seconds


// // ---------- Customer signup ----------
// router.post(
//   '/signup',
//   asyncHandler(async (req, res) => {
//     const { name, email, password, phone, role } = req.body;
//     if (!name || !email || !password) {
//       return res.status(400).json({ error: 'name, email, and password are required' });
//     }

//     const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
//     const { rows } = await query(
//       `INSERT INTO customers (name, email, phone, password_hash, role)
//        VALUES ($1, $2, $3, $4, $5)
//        RETURNING id, name, email, phone, role`,
//       [name, email, phone , passwordHash,role]
//     );
//     /** @type {import('../model/db').FreshUser} */
//     const appUser = rows[0];
//     const token = signToken(appUser);
//     res.status(201).json({ user: appUser, token });
//   })
// );

// // ---------- Customer set password with invite token ----------
// router.post(
//   '/set-password',
//   asyncHandler(async (req, res) =>{
//     const { token, password } = req.body;
//     if (!token || !password) {
//       return res.status(400).json({ error: 'token and password are required' });
//     }
//     /**
//      * 1. check if invite token is valid.
//      * 2. create password hash.
//      * 3. update user password_hash.
//      * 4. return succesful message.
//      */
    
//     const response = await transaction (async (clientConnection) =>{
//       const inviteTokenHash = hash(token);
//       const { rows } = await clientConnection.query(
//         'SELECT token_hash, app_user FROM auth_token WHERE token_hash = $1 AND expires_at > now() AND used_at IS NULL FOR UPDATE',
//         [inviteTokenHash]
//       );
//       if(rows.length === 0) {
//         return null;
//       }
//       /** @type {import('../model/db').AuthokenInvite} */
//       const authToken = rows[0];
//       const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
//       await clientConnection.query('UPDATE app_user SET password_hash = $1 WHERE id = $2', [passwordHash, authToken.app_user]);
//       await clientConnection.query('UPDATE auth_token SET used_at = now() WHERE token_hash = $1', [inviteTokenHash]);
//       return 'Password set successfully';
//     })
//     if (!response) {
//       return res.status(401).json({ error: 'Invalid or expired token' });
//     }
//     res.status(201).json({ message: response });
//   })
// );

// ---------- Customer login ----------
router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    const { rows: [appUser] } = await query(
      'SELECT id, name, email, mobile, password_hash, role FROM app_user WHERE email = $1',
      [email]
    );
    const passwordHash = hash(password);
    if (!appUser || (appUser.password_hash !== passwordHash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    delete appUser.password_hash;
    const token = signToken(String(appUser.id), appUser.role); 
    const refresh = refreshToken();
    await query(
        'INSERT INTO refresh_token '+
        '(app_user, refresh_token_hash,expires_at, family_id) VALUES ($1, $2, $3, $4)',
        [appUser.id, hash(refresh), new Date(Date.now() + 30*24*60*60*1000),crypto.randomUUID()]
      );
    const result = {
      user: appUser,
      token:{
        accessToken: token,
        refreshToken: refresh
      }
    };
    res.cookie('refresh_token', refresh, {
      httpOnly: true,
      secure: process.env.SSL === 'true',          
      sameSite: 'lax',
      path: '/auth',
      maxAge: REFRESH_TOKEN_MAX_AGE,
    });
    res.status(200).json(result);
    
  }
));

router.post('/refresh', asyncHandler(async (req, res) => {
  const payloadToken = req.cookies.refresh_token;
  if (!payloadToken) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
 
  const result =await transaction(async (db) => {
      const {rows:[validTokenQuery]} = await db.query(
      'UPDATE refresh_token SET revoked = true'+
      ' WHERE refresh_token_hash = $1  AND revoked = false AND  expires_at > now()'+
      ' RETURNING app_user, refresh_token_hash, family_id, expires_at, revoked',
      [hash(payloadToken)]
    );
    if (validTokenQuery) {
      const newRefreshToken = refreshToken();
      await db.query(
        'INSERT INTO refresh_token (app_user, refresh_token_hash, expires_at, family_id) VALUES ($1, $2, $3, $4)',
        [validTokenQuery.app_user, hash(newRefreshToken), new Date(Date.now() + 30*24*60*60*1000), validTokenQuery.family_id]
      );
      const { rows: [user] } = await db.query(
        'SELECT id, name, email, mobile, role FROM app_user WHERE id = $1',
        [validTokenQuery.app_user]
      );
      return {
        accessToken: signToken(user.id, user.role),
        refreshToken: newRefreshToken,
        user,
      };
    }else{
      const {rows: [revokedToken]}=await db.query(
        'SELECT * FROM refresh_token'+ 
        ' WHERE refresh_token_hash = $1 AND revoked = true AND expires_at > now()',
        [hash(payloadToken)]
      );
        if(revokedToken){
          console.log("Usage of a revoked token. Revoking all tokens in the family");
          // ALREADY REVOKED TOKEN, REVOKE ALL TOKENS IN THE FAMILY
        await db.query(
        'UPDATE refresh_token SET revoked = true'+
        ' WHERE family_id = (SELECT family_id FROM refresh_token WHERE refresh_token_hash = $1)',
        [hash(payloadToken)]
      ); 
        }
      return null;
    }
     
  })
  if(!result){
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  res.cookie('refresh_token', result.refreshToken, {
      httpOnly: true,
      secure: process.env.SSL === 'true',
      sameSite: 'lax',
      path: '/auth',
      maxAge: REFRESH_TOKEN_MAX_AGE,
    });
  res.status(200).json({ user: result.user, accessToken: result.accessToken });

}));

router.post('/forgot-password', asyncHandler(async(req, res) =>{
  const {email} = req.body;
  if(!email){
    return res.status(400).json({ error: 'email is required' });
  }
  const {rows: [appUser]} = await query(
    'SELECT id, name, email, mobile, role FROM app_user WHERE email = $1',
    [email]
  );
  if (appUser){
    const {rows: [recent]} = await query(
      'SELECT 1 FROM auth_token WHERE app_user = $1 AND purpose = $2 AND created_at > now() - make_interval(secs => $3) LIMIT 1',
      [appUser.id, 'password_reset', COOL_DOWN_TIME]
    );
    if (!recent){
      await query('UPDATE auth_token SET used_at = now() WHERE app_user = $1 AND purpose = $2 AND used_at IS NULL', [appUser.id, 'password_reset']);
      await sendInvitationEmail(appUser, 'password_reset');
    }
  }
  res.sendStatus(204);
}));


router.post('/reset-password', asyncHandler(validateForPasswordReset), asyncHandler(async(req, res)=>{
  const {token, password, purpose} = req.body;
  const tokenHash = hash(token);
  const passwordHash = hash(password);
  
  const claimed = await transaction (async (clientConnection)=>{
    const {rows: [t]} = await clientConnection.query(
      'UPDATE auth_token SET used_at = now() WHERE '+
      'token_hash = $1 AND expires_at > now() AND purpose = $2 AND used_at IS NULL'+
      ' RETURNING app_user',
      [tokenHash, purpose]
    )
    if (!t) return false;
    await clientConnection.query(
      'UPDATE app_user SET password_hash = $1 WHERE id = $2', 
      [passwordHash, t.app_user]);
      //mark any previously issued tokens as used.
      await clientConnection.query('UPDATE auth_token SET used_at = now() WHERE app_user = $1 AND used_at IS NULL', [t.app_user]);
      if (purpose === 'password_reset'){
        await clientConnection.query('UPDATE refresh_token SET revoked = true WHERE app_user = $1', [t.app_user]);
      }
      return true;
  })
  if (!claimed) return res.status(410).json({ error: 'Invalid or expired token' });
  return res.status(200).json({ message: 'Password set successfully' });
}));


module.exports = router;
