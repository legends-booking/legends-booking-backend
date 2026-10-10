const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { query } = require('../db/pool');
const { signToken, refreshToken, hash } = require('../utils/jwr');
const { asyncHandler } = require('../middleware/errorHandler');
const { transaction } = require('../utils/transaction');

const router = express.Router();
const SALT_ROUNDS = 12;

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
    if (!appUser || !(await bcrypt.compare(password, appUser.password_hash))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    delete appUser.password_hash;
    const token = signToken(String(appUser.id), appUser.role); 
    const refresh = refreshToken();
    console.log(`Refresh Token: ${refresh}`);
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
      secure: false,          // may need false for plain http://localhost in dev
      sameSite: 'lax',
      path: '/auth',
      maxAge: 30 * 24 * 60 * 60 * 1000,
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
      const {rows:[{role}]} = await db.query(
        'SELECT role FROM app_user WHERE id = $1',
        [validTokenQuery.app_user]
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
      secure: false,          // may need false for plain http://localhost in dev
      sameSite: 'lax',
      path: '/auth',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
  res.status(200).json({ user: result.user, accessToken: result.accessToken });

}));

module.exports = router;
