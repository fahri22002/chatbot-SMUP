const multer = require('multer');
const path = require('path');

// Simpan file sementara dulu dengan nama random
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/upload/');
  },
  filename: function (req, file, cb) {
    // nama sementara (nanti akan diubah jadi messageId)
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  fileFilter(req, file, cb) {
    const allowed = ['image/png','image/jpeg','image/jpg','image/webp'];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Format file tidak didukung.'));
    }
    cb(null, true);
  }
});

module.exports = {upload, storage};
