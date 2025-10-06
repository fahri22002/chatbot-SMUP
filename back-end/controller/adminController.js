
const { Admin } = require('../models/adminModel');
// const { admin } = require("../auth/middleware.js");



const login = async (req, res) => {
  const { username, password } = req.body;
  try {
    

    // Set session
    req.session.adminId = admin.adminId;
    req.session.username = user.username;

    // Simpan session dan kirim response
    req.session.save(err => {
      if (err) {
        console.error('Session save error:', err);
        return res.status(500).json({ error: 'Session save failed' });
      }

      // Set cookie header
      res.setHeader('Set-Cookie', [
        `cm_auth=${req.sessionID}; Domain=.railway.app; Path=/; Secure; SameSite=None; HttpOnly; Max-Age=${14 * 24 * 60 * 60}`
      ]);

      // Hanya satu response
      res.json({
        error: false,
        message: 'Berhasil Sign In',
        uid: firebaseUser.uid,
        userId: user.userId,
        userToken: idToken,
        status: user.status,
        displayName: user.displayName,
        profileImage: user.profileImage
      });
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(401).json({
      error: true,
      message: 'Email atau password salah',
      firebaseError: error.message
    });
  }
};





module.exports = { login };