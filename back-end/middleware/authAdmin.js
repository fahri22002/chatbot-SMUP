// middleware/authAdmin.js

const isAdmin = (req, res, next) => {
  // Cek apakah session ada DAN session tersebut menyimpan adminId
  if (req.session && req.session.adminId) {
    // Jika ya, izinkan request lanjut ke controller (fungsi 'next()')
    next();
  } else {
    // Jika tidak, tolak request dengan status 401 (Unauthorized)
    res.status(401).json({ error: true, message: 'Akses ditolak. Silakan login terlebih dahulu.' });
  }
};

module.exports = { isAdmin };