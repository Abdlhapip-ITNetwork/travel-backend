const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Hardcode fallback URI jika process.env.MONGO_URI di Vercel tidak terbaca
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://muhafif_db_user:ag0mnNdzLOcWgljU@cluster0.hvhmebd.mongodb.net/travel_db?retryWrites=true&w=majority";
const JWT_SECRET = process.env.JWT_SECRET || "rahasia_binus_travel_2026";

// Singleton Database Connection Handler
let cachedConnection = null;

async function connectToDatabase() {
  if (cachedConnection && mongoose.connection.readyState === 1) {
    return cachedConnection;
  }

  // Koneksi langsung tanpa buffering
  cachedConnection = await mongoose.connect(MONGO_URI, {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 10000,
  });
  
  return cachedConnection;
}

// User Model
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true }
});

const User = mongoose.models.User || mongoose.model('User', userSchema);

// Destinations Model
const destSchema = new mongoose.Schema({
  title: String,
  category: String,
  location: String,
  rating: Number,
  price: String,
  image: String,
  description: String
});

const Destination = mongoose.models.Destination || mongoose.model('Destination', destSchema);

// Root Check
app.get('/', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'API Travel Guide Online',
    dbState: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
  });
});

// Endpoint: Register
app.post('/api/auth/register', async (req, res) => {
  try {
    await connectToDatabase();
    
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Semua field wajib diisi' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email sudah terdaftar!' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      name,
      email,
      password: hashedPassword
    });

    await newUser.save();
    return res.status(201).json({ message: 'Registrasi berhasil! Silakan login.' });
  } catch (error) {
    console.error('Register Error:', error);
    return res.status(500).json({ error: error.message || 'Gagal registrasi' });
  }
});

// Endpoint: Login
app.post('/api/auth/login', async (req, res) => {
  try {
    await connectToDatabase();
    
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email dan password wajib diisi' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'Email tidak terdaftar' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Password salah' });
    }

    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '1d' });
    return res.json({
      token,
      user: { name: user.name, email: user.email }
    });
  } catch (error) {
    console.error('Login Error:', error);
    return res.status(500).json({ error: error.message || 'Gagal login' });
  }
});

// Endpoint: Get Destinations
app.get('/api/destinations', async (req, res) => {
  try {
    await connectToDatabase();
    const destinations = await Destination.find();
    return res.json(destinations);
  } catch (error) {
    console.error('Destinations Error:', error);
    return res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 5000;
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;