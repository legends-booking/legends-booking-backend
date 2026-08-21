const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { query } = require('../db/pool');
const { requireAuth, requireRole } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const {transaction} = require('../utils/transaction');

const router = express.Router();
const SALT_ROUNDS = 12;
const appUserFilters ={
  "userRole": "role"
}

// All routes here require an authenticated admin
router.use(requireAuth, requireRole('admin'));

// ---------- List members ----------
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const conditions = [];
    const parms = [];
    for (const [filterName, columName] of Object.entries(appUserFilters)) {
      const filterValue = req.query[filterName];
      if (filterValue){
        conditions.push (`${columName} = $${parms.length + 1}`);
        parms.push(filterValue);
      }
    }
    let whereClause = conditions.length > 0 ? `WHERE `:'';
    let i =1;
    while(true){
      whereClause += conditions[i-1]+' ';
      if (i === conditions.length) break;
      whereClause += 'AND ';
      i++;
    }
    console.log(whereClause);
    console.log(parms);
    console.log(conditions);
    const { rows } = await query(
      `SELECT id, name, email, phone FROM app_user ${whereClause} ORDER BY created_at DESC`,parms
    );
    res.json(rows);
  })
);

// ---------- Add a new member directly (front-desk sign-up on behalf of a customer) ----------
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { name, email, phone } = req.body;
    if (!name || !email || !phone) {
      return res.status(400).json({ error: 'name, email, and phone are required' });
    }
    const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), SALT_ROUNDS);
    const inviteToken = crypto.randomBytes(32).toString('hex');
    const inviteTokenHash = crypto.createHash('sha256').update(inviteToken).digest('hex');
    const user = await transaction(async (clientConnection) => {
      const { rows: [created] } = await clientConnection.query(
        `INSERT INTO app_user (name, email, phone, password_hash)
         VALUES ($1, $2, $3, $4)
         RETURNING id, name, email, phone, created_at`,
        [name, email, phone, passwordHash]
      );
      await clientConnection.query(
        `INSERT INTO auth_token (customer_id, token_hash, purpose, expires_at)
         VALUES ($1, $2, 'invite', now() + INTERVAL '1 day')`,
        [created.id, inviteTokenHash]
      );
      return created;
    });
    
    res.status(201).json({ user, token: inviteToken });
  })
);

module.exports = router;
