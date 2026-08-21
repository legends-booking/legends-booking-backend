const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { query } = require('../db/pool');
const { signToken } = require('../utils/jwt');
const { asyncHandler } = require('../middleware/errorHandler');
const { transaction } = require('../utils/transaction');

const router = express.Router();
const SALT_ROUNDS = 12;

// ---------- Customer signup ----------
router.post(
  '/signup',
  asyncHandler(async (req, res) => {
    const { name, email, password, phone, role } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'name, email, and password are required' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const { rows } = await query(
      `INSERT INTO customers (name, email, phone, password_hash, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, email, phone, role`,
      [name, email, phone , passwordHash,role]
    );
    /** @type {import('../model/db').FreshUser} */
    const appUser = rows[0];
    const token = signToken({ id: appUser.id, role: appUser.role });
    res.status(201).json({ user: appUser, token });
  })
);

// ---------- Customer set password with invite token ----------
router.post(
  '/set-password',
  asyncHandler(async (req, res) =>{
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ error: 'token and password are required' });
    }
    /**
     * 1. check if invite token is valid.
     * 2. create password hash.
     * 3. update user password_hash.
     * 4. return succesful message.
     */
    
    const response = await transaction (async (clientConnection) =>{
      const inviteTokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const { rows } = await clientConnection.query(
        'SELECT FOR UPDATE token_hash, app_user FROM auth_token WHERE token_hash = $1 AND expires_at > now() AND used_at IS NULL',
        [inviteTokenHash]
      );
      if(rows.length === 0) {
        return null;
      }
      /** @type {import('../model/db').AuthokenInvite} */
      const authToken = rows[0];
      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
      await clientConnection.query('UPDATE app_user SET password_hash = $1 WHERE id = $2', [passwordHash, authToken.app_user]);
      await clientConnection.query('UPDATE auth_token SET used_at = now() WHERE token_hash = $1', [inviteTokenHash]);
      return 'Password set successfully';
    })
    if (!response) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    res.status(201).json({ message: response });
  })
);

// ---------- Customer login ----------
router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    const { rows } = await query(
      'SELECT id, name, email, phone, password_hash FROM app_user WHERE email = $1',
      [email]
    );
    /** @type {import('../model/db').AppUser} */
    const appUser = rows[0];
    if (!appUser || !(await bcrypt.compare(password, appUser.password_hash))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    delete appUser.password_hash;
    const token = signToken({ id: appUser.id, role: appUser.role });
    res.json({ user: appUser, token });
  })
);

module.exports = router;
