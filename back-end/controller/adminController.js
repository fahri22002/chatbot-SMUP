const bcrypt = require('bcrypt');
const { Admin } = require('../models/adminModel');

/**
 * @description Membuat akun admin baru
 */
const createAccount = async (req, res) => {
  const { username, password } = req.body;

  // Validasi input dasar
  if (!username || !password) {
    return res.status(400).json({ error: true, message: 'Username dan password diperlukan' });
  }

  try {
    // 1. Cek apakah username sudah ada
    const existingAdmin = await Admin.findOne({ username });
    if (existingAdmin) {
      return res.status(409).json({ error: true, message: 'Username sudah digunakan' });
    }

    // 2. Hash password sebelum disimpan
    const salt = await bcrypt.genSalt(10); // Angka 10 adalah "salt rounds", standar yang baik
    const hashedPassword = await bcrypt.hash(password, salt);

    // 3. Buat admin baru dengan password yang sudah di-hash
    const newAdmin = new Admin({
      username,
      password: hashedPassword, // Simpan password yang sudah di-hash
    });

    // 4. Simpan ke database
    await newAdmin.save();

    // 5. Kirim respons sukses
    res.status(201).json({
      error: false,
      message: 'Akun berhasil dibuat',
      admin: {
        _id: newAdmin._id,
        username: newAdmin.username,
      }
    });

  } catch (error) {
    console.error("Create account error:", error);
    res.status(500).json({
      error: true,
      message: 'Terjadi kesalahan server saat membuat akun',
      detail: error.message
    });
  }
};


/**
 * @description Login untuk admin yang sudah ada
 */
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

const getChatHistory = async (req, res) => {
  if(!req.session.adminId){
    return res.status(404).json({ error: true, message: "login required" });
  }
    try {
        const chatId = req.body.chatId;

        const messages = await Message.aggregate([
          {
            $match: { chatId: chatId }
          },
          {
            $lookup: {
              from: "chat",
              let: { chatIdString: "$chatId" },
              pipeline: [
                {
                  $addFields: {
                    _idStr: { $toString: "$_id" }
                  }
                },
                {
                  $match: {
                    $expr: { $eq: ["$_idStr", "$$chatIdString"] }
                  }
                }
              ],
              as: "chatHistory"
            }
          },
          { $unwind: "$chatHistory" },
          { $sort: { createdAt: -1 } },
          {
            $project: {
              msg: 1,
              createdAt: 1,
              chatId: 1,
              sender: 1,
              chatAt: "$chatHistory.createdAt"
            }
          }
        ]);


        if (messages.length === 0) {
            return res.status(404).json({ error: true, message: "Chat history tidak ditemukan" });
        }

        res.status(200).json({ error: false, data: messages });
    } catch (error) {
        res.status(500).json({
            error: true,
            message: error.message
        });
    }
};

const deleteOldChats = async (req, res) => {
  try {
    // Hitung tanggal 7 hari yang lalu
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Ambil semua chat yang memenuhi kondisi
    const oldChats = await Chat.find({
      status: "NONACTIVE",
      updatedAt: { $lte: sevenDaysAgo }
    });

    if (oldChats.length === 0) {
      return res.status(200).json({
        message: 'Tidak ada chat yang perlu dihapus.'
      });
    }

    // Ambil semua _id chat
    const chatIds = oldChats.map(chat => chat._id);

    // Hapus semua message yang memiliki chatId dari chat yang dihapus
    await Message.deleteMany({ chatId: { $in: chatIds } });

    // Hapus chat yang memenuhi kondisi
    await Chat.deleteMany({ _id: { $in: chatIds } });

    res.status(200).json({
      message: `Berhasil menghapus ${chatIds.length} chat dan pesan terkait.`,
      deletedChatIds: chatIds
    });
  } catch (error) {
    console.error('Error saat menghapus chat:', error);
    res.status(500).json({ error: 'Gagal menghapus chat lama' });
  }
};
module.exports = { login, createAccount };