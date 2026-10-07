const { query } = require('../db/pool');
function validateUserSignup(req, res, next) {
    const {name, email, mobile, startDate, endDate} = req.body;
    if (!name || !email || !mobile || !startDate || !endDate) {
        return res.status(400).json({ error: 'Name, Email, Phone and Dates are required' });
    }
    if(! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        return res.status(400).json({ error: 'Invalid email address' });
    if(!isValidEmail(email))
        return res.status(400).json({ error: 'Email already in use' });
    if(! /^\+[1-9][0-9]{7,14}$/.test(mobile)) 
        return res.status(400).json({ error: 'Invalid phone number' });
    if(!isValidPhone(mobile))
        return res.status(400).json({ error: 'Phone number already in use' });
    if (new Date(endDate) < new Date(startDate))
        return res.status(400).json({ error: 'End date must be after start date' });
    next();
}

async function isValidEmail(email) {
    const {rows} = await query('SELECT * FROM app_user WHERE email = $1', [email]);
    return rows.length == 0;
}

async function isValidPhone(phone) {
    
    const {rows} = await query('SELECT * FROM app_user WHERE phone = $1', [phone]);
    return rows.length === 0;
}

module.exports = validateUserSignup;