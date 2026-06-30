require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const todoRoutes = require('./routes/todos');

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/tododb';

app.use(cors());
app.use(express.json());

app.use('/api/todos', todoRoutes);

// Health check endpoint - used by Docker/ALB/EC2 monitoring
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log('MongoDB connected');
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  });
