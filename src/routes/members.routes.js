const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { query } = require('../db/pool');
const { requireAuth, requireRole } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const {transaction} = require('../utils/transaction');
const validateUserSignup = require('../validations/usersignup');
const router = express.Router();
const SALT_ROUNDS = 12;
const appUserFilters ={
  "userRole": "role"
}

// All routes here require an authenticated admin
//TODO: Uncomment this when we have a proper authentication system
//router.use(requireAuth, requireRole('admin'));

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
    while(i<=conditions.length){
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
  validateUserSignup,
  asyncHandler(async (req, res) => {
    const { name, email, mobile , role,plan, startDate, endDate} = req.body;
    const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), SALT_ROUNDS);
    const inviteToken = crypto.randomBytes(32).toString('hex');
    const inviteTokenHash = crypto.createHash('sha256').update(inviteToken).digest('hex');
    const user_created = await transaction(async (clientConnection) => {
      const { rows: [created] } = await clientConnection.query(
        `INSERT INTO app_user (name, email, mobile, role, password_hash)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, name, email, mobile, created_at`,
        [name, email, mobile, role, passwordHash]
      );
      const {rows:[credits]} = await clientConnection.query(
        `SELECT class_credits FROM membership_plan WHERE id = $1`,
        [plan]
      );
      const {rows:[app_user_membership]} = await clientConnection.query(
        `INSERT INTO customer_membership (app_user, plan_id, start_date, 
        end_date, credits_remaining) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [created.id, plan, startDate, endDate, credits.class_credits]
      );

      await clientConnection.query(
        `INSERT INTO auth_token (app_user, token_hash, purpose, expires_at)
         VALUES ($1, $2, 'invite', now() + INTERVAL '1 day')`,
        [created.id, inviteTokenHash]
      );
      return created;
    });
    
    res.status(201).json({ "user":{
      "id": user_created.id,
      "name": user_created.name,
      "email": user_created.email,
      "mobile": user_created.mobile,
      "plan": plan
    }, token: inviteToken });
  })
);

module.exports = router;
