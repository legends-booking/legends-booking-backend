require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { query }= require('./src/db/pool')
const { errorHandler } = require('./src/middleware/errorHandler');
const authRoutes = require('./src/routes/auth.routes');
const membersRoutes = require('./src/routes/members.routes');
const membershipPlansRoutes = require('./src/routes/membershipPlans.routes');
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');
const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/auth', authRoutes);
app.use('/members', membersRoutes);
app.use('/membership-plans', membershipPlansRoutes);

fs.mkdirSync(UPLOAD_DIR, { recursive: true });
app.use('/uploads', express.static(UPLOAD_DIR, {
  maxAge: '7d',
  index: false,
  setHeaders: (res) => res.set('X-Content-Type-Options', 'nosniff'),
}));

app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use(errorHandler);

(async()=>{
  try{
    await query('select 1',[]);
    console.log("Connected to DB")
  }catch(err){
    console.log("Error in connecting to db: ",err.message)
    process.exit(1)
  }
})();
app.listen(PORT, () => {
  console.log(`Legends booking backend listening on port ${PORT}`);
});
