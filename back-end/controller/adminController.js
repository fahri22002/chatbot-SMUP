const bcrypt = require('bcrypt');
const { Admin } = require('../models/adminModel');
// Impor ini diperlukan untuk getChatHistory dan deleteOldChats
const { Chat } = require('../models/chatModel');
const { Message } = require('../models/messageModel');

/**
 * @description Membuat akun admin baru (Hanya bisa oleh admin lain yang sudah login)
 */
const createAccount = async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: true, message: 'Username dan password diperlukan' });
  }

  try {
    const existingAdmin = await Admin.findOne({ username });
    if (existingAdmin) {
      return res.status(409).json({ error: true, message: 'Username sudah digunakan' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newAdmin = new Admin({
      username,
      password: hashedPassword,
    });

    await newAdmin.save();

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
    const admin = await Admin.findOne({ username });
    if (!admin) {
      return res.status(401).json({ error: true, message: 'Username atau password salah' });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(401).json({ error: true, message: 'Username atau password salah' });
    }

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

/**
 * @description Logout admin
 */
const logout = (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({ error: true, message: 'Gagal logout' });
    }
    
    res.clearCookie('connect.sid'); 
    res.status(200).json({ error: false, message: 'Berhasil logout' });
  });
};

const getAllChats = async (req, res) => {
  try {
    // Cari semua chat, pilih field yang penting, dan urutkan dari yang terbaru
    const chats = await Chat.find({})
      .select('_id status createdAt') // Ambil ID, status, dan waktu dibuat
      .sort({ createdAt: -1 }); // Urutkan dari yang paling baru

    res.status(200).json({ error: false, data: chats });
  } catch (error) {
    res.status(500).json({ error: true, message: error.message });
  }
};

const deleteChatById = async (req, res) => {
  try {
    const { id } = req.params; // Mengambil ID dari parameter URL

    // 1. Hapus dokumen chat dari koleksi 'chat'
    const deletedChat = await Chat.findByIdAndDelete(id);

    if (!deletedChat) {
      return res.status(404).json({ error: true, message: 'Chat tidak ditemukan' });
    }

    // 2. Hapus semua pesan yang terkait dengan chat tersebut dari koleksi 'message'
    await Message.deleteMany({ chatId: id.toString() });

    res.status(200).json({ error: false, message: `Chat ID ${id} dan semua pesannya berhasil dihapus.` });
  } catch (error) {
    console.error(`Error saat menghapus chat ${req.params.id}:`, error);
    res.status(500).json({ error: true, message: error.message });
  }
};

/**
 * @description Mendapatkan riwayat chat berdasarkan chatId
 */
const getChatHistory = async (req, res) => {
    // Fungsi ini SUDAH SESUAI dan tidak perlu diubah.
    try {
        const { chatId } = req.query; 

        if (!chatId) {
          return res.status(400).json({ error: true, message: "Parameter 'chatId' diperlukan" });
        }

        const messages = await Message.aggregate([
          {
            $match: { chatId: chatId } // Mencocokkan String
          },
          {
            $lookup: {
              from: "chat", 
              let: { chatIdString: "$chatId" },
              pipeline: [
                {
                  $addFields: {
                    _idStr: { $toString: "$_id" } // Mengubah ObjectId -> String
                  }
                },
                {
                  $match: {
                    $expr: { $eq: ["$_idStr", "$$chatIdString"] } // Membandingkan String vs String
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
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Ambil semua chat yang memenuhi kondisi untuk dihapus
    const oldChats = await Chat.find({
      status: "NONACTIVE",
      updatedAt: { $lte: sevenDaysAgo }
    });

    if (oldChats.length === 0) {
      return res.status(200).json({
        message: 'Tidak ada chat lama yang perlu dihapus.'
      });
    }

    // Buat array berisi ObjectId untuk menghapus dari koleksi 'chat'
    const chatObjectIds = oldChats.map(chat => chat._id);

    // Buat array berisi String untuk menghapus dari koleksi 'message'
    const chatStringIds = oldChats.map(chat => chat._id.toString());

    // Hapus semua message yang memiliki chatId (String)
    await Message.deleteMany({ chatId: { $in: chatStringIds } });

    // Hapus chat yang memenuhi kondisi (menggunakan ObjectId)
    await Chat.deleteMany({ _id: { $in: chatObjectIds } });
    
    res.status(200).json({
      message: `Berhasil menghapus ${chatObjectIds.length} chat lama dan pesan terkait.`,
      deletedChatIds: chatStringIds
    });
  } catch (error) {
    console.error('Error saat menghapus chat lama:', error);
    res.status(500).json({ error: 'Gagal menghapus chat lama' });
  }
};

module.exports = { 
  login, 
  logout,
  createAccount, 
  getChatHistory, 
  deleteOldChats,
  getAllChats,
  deleteChatById 
};