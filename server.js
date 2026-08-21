require('dotenv').config();
const express = require('express');
const cors = require('cors');

const { errorHandler } = require('./src/middleware/errorHandler');
const authRoutes = require('./src/routes/auth.routes');
const membersRoutes = require('./src/routes/members.routes');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/auth', authRoutes);
app.use('/members', membersRoutes);


app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use(errorHandler);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Legends booking backend listening on port ${PORT}`);
});
