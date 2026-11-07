const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { query } = require('../db/pool');
const { requireAuth, requireRole } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const {transaction} = require('../utils/transaction');
const {validateUserSignup} = require('../validations/usersignup');
const {sendInvitationEmail} = require('../password_reset/invitation_email');

const router = express.Router();
const SALT_ROUNDS = 12;
const appUserFilters ={
  "userRole": "role"
}



// ---------- List members ----------
router.get(
  '/', requireAuth, requireRole('admin'),
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
    const { rows } = await query(
      `SELECT id, name, email, mobile FROM app_user ${whereClause} ORDER BY created_at DESC`,parms
    );
    res.json(rows);
  })
);

// ---------- Add a new member directly (front-desk sign-up on behalf of a customer) ----------
router.post(
  '/', 
  requireAuth, requireRole('admin'),
  asyncHandler(validateUserSignup),
  asyncHandler(async (req, res) => {
    const { name, email, mobile , role,plan, startDate, endDate} = req.body;
    const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), SALT_ROUNDS);
    const user_created = await transaction(async (clientConnection) => {
      const { rows: [created] } = await clientConnection.query(
        `INSERT INTO app_user (name, email, mobile, role, password_hash)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, name, email, mobile, created_at`,
        [name, email, mobile, role, passwordHash]
      );
      if (role == 'customer'){
        const {rows:[credits]} = await clientConnection.query(
          `SELECT class_credits FROM membership_plan WHERE id = $1`,
          [parseInt(plan)]
        );
        const {rows:[app_user_membership]} = await clientConnection.query(
          `INSERT INTO customer_membership (app_user, plan_id, start_date, 
          end_date, credits_remaining) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          [created.id, plan, startDate, endDate, credits.class_credits]
        );
      }
      return created;
    });
    sendInvitationEmail(user_created, 'invite');
    res.status(201).json({ "user":{
      "id": user_created.id,
      "name": user_created.name,
      "email": user_created.email,
      "mobile": user_created.mobile,
      "plan": plan
    }});
  })
);

module.exports = router;
