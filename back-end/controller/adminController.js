const { Admin } = require('../models/adminModel');

const login = async (req, res) => {
  const { username, password } = req.body;

  try {
    // Cari admin berdasarkan username
    const admin = await Admin.findOne({ username });

    if (!admin) {
      return res.status(401).json({ error: true, message: 'Username tidak ditemukan' });
    }

    // Cek password (kalau plain text)
    if (password !== admin.password) {
      return res.status(401).json({ error: true, message: 'Password salah' });
    }

    // Set session
    req.session.adminId = admin._id;
    req.session.username = admin.username;

    // Simpan session
    req.session.save(err => {
      if (err) {
        console.error('Session save error:', err);
        return res.status(500).json({ error: 'Gagal menyimpan session' });
      }

      // Set cookie untuk Railway deployment
      // res.setHeader('Set-Cookie', [
      //   `cm_auth=${req.sessionID}; Domain=.railway.app; Path=/; Secure; SameSite=None; HttpOnly; Max-Age=${14 * 24 * 60 * 60}`
      // ]);

      // Kirim respons sukses
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
      message: 'Terjadi kesalahan saat login',
      details: error.message
    });
  }
};

module.exports = { login };
