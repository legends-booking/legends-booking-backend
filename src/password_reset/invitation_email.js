const { generateRandomToken, hash } = require('../middleware/auth');
const nodemailer = require('nodemailer');
const {query} = require('../db/pool');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

/** @type {import('nodemailer').Transporter | null} */
let transport = null;


function getTransport() {
    if (transport) {
        return transport;
    }
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) ,
        auth: {
          user: process.env.SMTP_USER ,
          pass: process.env.SMTP_PASS 
        }
      });
}

  
  
/**
 * 
 * @param {import('../model/db').AppUser} appUser 
 * @param {string} purpose 
 */
const sendInvitationEmail = async (appUser, purpose) => {
    const token = generateRandomToken();
    const tokenHash = hash(token);
    const expiresAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);   // 2 days
    let stage = 1;
    try{
      await query(
        `INSERT INTO auth_token (app_user, token_hash, purpose, expires_at)
         VALUES ($1, $2, $3, $4)`,
        [appUser.id, tokenHash, purpose, expiresAt]
      );
      stage = 2;
      const { subject, text, html, link } = constructEmail(token, purpose);
      await sendEmail(appUser.email, subject, text, html);
    }catch(error){
      console.error('Invite email failed' , {
        userId: appUser.id,
        purpose,
        stage,
        err: error
      });
    }
    

}

/**
 *
 * @param {string} token 
 * @param {string} purpose 
 * @returns 
 */
function constructEmail (token, purpose) {
    const base = (process.env.FRONTEND_URL || '').replace(/\/$/, '');
  const path = purpose === 'password_reset' ? '/reset-password' : '/invite';
  const link = `${base}${path}?token=${encodeURIComponent(token)}`;
  const isReset = purpose === 'password_reset';
  const subject = isReset
    ? 'Reset your Legends password'
    : 'You’re invited to Legends';
  const headline = isReset
    ? 'Reset your password'
    : 'Welcome — set up your account';
  const intro = isReset
    ? 'We received a request to reset the password for your Legends account.'
    : 'An account was created for you at Legends. Choose a password to get started.';
  const cta = isReset ? 'Reset password' : 'Set up password';
  const text = [
    headline,
    '',
    intro,
    '',
    `${cta}: ${link}`,
    '',
    `This link expires in two day(s).`,
    '',
    'If you didn’t expect this email, you can safely ignore it.',
  ].join('\n');
  const html = `
<!DOCTYPE html>
<html>
<body style="font-family: system-ui, -apple-system, sans-serif; line-height: 1.5; color: #111; max-width: 480px;">
  <h1 style="font-size: 20px; font-weight: 600;">${headline}</h1>
  <p>${intro}</p>
  <p style="margin: 24px 0;">
    <a href="${link}" style="display: inline-block; padding: 12px 20px; background: #111; color: #fff; text-decoration: none; border-radius: 6px;">
      ${cta}
    </a>
  </p>
  <p style="font-size: 14px; color: #555;">
    Or copy and paste this link into your browser:<br/>
    <a href="${link}" style="word-break: break-all;">${link}</a>
  </p>
  <p style="font-size: 13px; color: #777;">
    This link expires in 2 days. If you didn’t expect this email, you can ignore it.
  </p>
</body>
</html>`.trim();
  return { subject, text, html, link };
}
/**
 * 
 * @param {string} email 
 * @param {string} subject 
 * @param {string} text 
 * @param {string} html 
 * @returns {Promise<import('nodemailer/lib/mailer').SentMessageInfo>}
 */
const sendEmail = async (email, subject, text, html) => {
    const from = process.env.MAIL_FROM;
    if (!from) {
        throw new Error('MAIL_FROM is not set');
    }
    
    const info = await getTransport().sendMail({
        from: process.env.MAIL_FROM,
        to: email,
        subject,
        text,
        html,
      });
    console.log('Email sent: %s', info.messageId);
    return info;
}

module.exports = { sendInvitationEmail};