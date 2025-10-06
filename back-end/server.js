const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');

// Import routes
// const adminRoutes = require('./routes/adminRoutes');
const routes = require('./routes/routes');

const app = express();

// Middleware dasar
app.use(cors({
  origin: true, // atau ['http://localhost:3000'] kalau frontend ada
  credentials: true
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Koneksi ke MongoDB lokal
// mongoose.connect('mongodb://127.0.0.1:27017/chatdb', {
//   useNewUrlParser: true,
//   useUnifiedTopology: true
// }).then(() => console.log('✅ MongoDB connected'))
//   .catch(err => console.error('❌ MongoDB connection error:', err));

// Konfigurasi session
app.use(session({
  secret: 'supersecretkey', // ubah ke env variable untuk produksi
  resave: false,
  saveUninitialized: false,
//   store: MongoStore.create({
//     mongoUrl: 'mongodb://127.0.0.1:27017/chatdb',
//     collectionName: 'sessions',
//   }),
  cookie: {
    maxAge: 14 * 24 * 60 * 60 * 1000, // 14 hari
    secure: false, // true kalau pakai HTTPS
    httpOnly: true,
    sameSite: 'lax'
  }
}));

// Routes
// app.use('/api/admin', adminRoutes);
app.use('/api', routes);

// Root
app.get('/', (req, res) => {
  res.send('Server running...');
});

// Endpoint di Express yang memanggil FastAPI
app.get('/get-message', async (req, res) => {
  try {
    const response = await axios.get('http://127.0.0.1:8080/');
    
    // Kirimkan hasil dari FastAPI ke client
    res.json({
      from: 'FastAPI',
      data: response.data
    });
  } catch (error) {
    console.error('Error fetching from FastAPI:', error.message);
    res.status(500).json({ error: 'Failed to fetch data from FastAPI' });
  }
});

// Jalankan server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port http://localhost:${PORT}`));
