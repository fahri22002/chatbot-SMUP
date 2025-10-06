const bcrypt = require('bcrypt');
const { Admin } = require('../models/adminModel');

const login = async (req, res) => {
  const { username, password } = req.body;

  try {
    // Cari admin berdasarkan username
    const admin = await Admin.findOne({ username });
    if (!admin) {
      return res.status(401).json({ error: true, message: 'Username atau password salah' });
    }

    // Bandingkan password yang dikirim dengan yang di-hash di DB
    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(401).json({ error: true, message: 'Username atau password salah' });
    }

    // Set session
    req.session.adminId = admin._id;
    req.session.username = admin.username;

    req.session.save(err => {
      if (err) {
        console.error('Session save error:', err);
        return res.status(500).json({ error: 'Session save failed' });
      }

      // res.setHeader('Set-Cookie', [
      //   `cm_auth=${req.sessionID}; Domain=.railway.app; Path=/; Secure; SameSite=None; HttpOnly; Max-Age=${14 * 24 * 60 * 60}`
      // ]);

      res.json({
        error: false,
        message: 'Berhasil Sign In',
        adminId: admin._id,
        username: admin.username
      });
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      error: true,
      message: 'Terjadi kesalahan server',
      detail: error.message
    });
  }
};

module.exports = { login };
