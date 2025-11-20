const { Chat } = require('../models/chatModel');
const { Message } = require('../models/messageModel');
const { Admin } = require('../models/adminModel');
const axios = require('axios');
// const { admin } = require("../auth/middleware.js");

console.log("🔥 appController loaded — siap jalan!");


const getChat = async (req, res) => {
  // if(!req.session._id){
  //   return res.status(404).json({ error: true, message: "login required" });
  // }
    try {
        const chatId = req.session.chatId;

        const messages = await Message.find({ chatId: req.session.chatId }).sort({ createdAt: -1 });


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

/**
 * save message to db
 */
const postMsg = async (req, res) => {
  try {
    // Pastikan chat sudah dibuat
    if (!req.session.chatId) {
      return res.status(400).json({ 
        error: true,
        refresh: true,
        message: 'Chat harus dibuat terlebih dahulu.'
      });
    }
    // Cek apakah chat dengan chatId ini masih aktif
    const chat = await Chat.findById(req.session.chatId);

    if (!chat) {
      return res.status(404).json({
        error: true,
        refresh: true,
        message: 'Chat tidak ditemukan.'
      });
    }

    if (chat.status !== "ACTIVE") {
      return res.status(400).json({
        error: true,
        refresh: true,
        message: 'Chat sudah tidak aktif. Silakan buat chat baru.'
      });
    }

    const { msg, attachment } = req.body;

    

    // Buat pesan baru
    const newMessage = new Message({
      chatId: req.session.chatId,
      msg,
      attachment,
      sender: "USER"
    });

    

    
    const response = await axios.post('http://127.0.0.1:8080/reply', {
      message: msg
    });
    const replyText = response.data.Reply;
    const newReply = new Message({
      chatId: req.session.chatId,
      msg: replyText,
      attachment: null,
      sender: "SELF"
    });
    
    
    res.status(201).json({
      error: false,
      status: 'Pesan berhasil dikirim.',
      message: msg,
      reply: replyText
    });
    
    // Simpan ke database
    await newMessage.save();
    await newReply.save();
  } catch (error) {
    console.error('Error saat mengirim pesan:', error);
    res.status(500).json({
      error: true,
      message: error.message
    });
  }
};


const createChat = async (req, res) => {
  try {
    // --- (MULAI PERBAIKAN CAPTCHA & CONSENT) ---

    // 1. Ambil token CAPTCHA dan CONSENT dari body
    const { captchaToken, consent } = req.body; // <-- PERUBAHAN DI SINI

    if (!captchaToken) {
      return res.status(400).json({ error: true, message: 'Verifikasi CAPTCHA diperlukan.' });
    }

    // 2. Ambil Kunci Rahasia Anda dari file .env
    const secretKey = process.env.RECAPTCHA_SECRET_KEY;
    if (!secretKey) {
        console.error("RECAPTCHA_SECRET_KEY tidak ditemukan di file .env");
        return res.status(500).json({ error: true, message: 'Konfigurasi server error.' });
    }

    // 3. Siapkan data untuk dikirim di BODY permintaan POST
    const verificationUrl = 'https://www.google.com/recaptcha/api/siteverify';
    
    // Gunakan URLSearchParams untuk memformat data sebagai x-www-form-urlencoded
    const params = new URLSearchParams();
    params.append('secret', secretKey);
    params.append('response', captchaToken);
    // Anda juga bisa menambahkan IP pengguna jika perlu:
    // params.append('remoteip', req.ip);

    // 4. Kirim permintaan verifikasi ke Google
    const verificationResponse = await axios.post(verificationUrl, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    const { success, 'error-codes': errorCodes } = verificationResponse.data;

    // 5. Periksa apakah verifikasi gagal
    if (!success) {
      // Log error-codes untuk debugging
      console.warn('Verifikasi CAPTCHA gagal:', errorCodes);
      return res.status(401).json({ error: true, message: 'Verifikasi CAPTCHA gagal. Silakan coba lagi.' });
    }

    // --- (SELESAI VERIFIKASI CAPTCHA) ---


    // 6. (Logika Asli Anda) - Hanya berjalan jika CAPTCHA berhasil
    if (req.session.chatId){
      setChatNonActive(req.session.chatId, req.session.consent);
      delete req.session.chatId;
      delete req.session.consent; // Hapus juga session consent lama
    }
    const status  = "ACTIVE";

    // Buat dan simpan chat
    const newChat = new Chat({ status });
    await newChat.save();
    
    // --- (PERBAIKAN: Simpan chatID DAN consent ke session) ---
    req.session.chatId = newChat._id;
    req.session.consent = consent || 'false'; // <-- PERUBAHAN DI SINI

    console.log(`Sesi chat ${newChat._id} dibuat dengan consent=${req.session.consent}`);

    res.status(201).json({
      message: 'Chat berhasil dibuat',
      data: newChat
    });
  } catch (error) {
    console.error('Error saat membuat chat:', error);
    // (BARU) Berikan detail error jika dari axios
    if (error.response) {
      console.error('Error data from Google:', error.response.data);
    }
    res.status(500).json({ error: 'Gagal membuat chat' });
  }
};

const setChatNonActive = async (chatId, consent) => {
  try {
    // Cek apakah chat dengan chatId ini masih aktif
    const chat = await Chat.findById(chatId);

    if (!chat) {
      console.log('Chat tidak ditemukan.')
      return null;
    }

    if (chat.status !== "ACTIVE") {
      console.log('Chat sudah tidak aktif.');
      return null;
    }
    const updatedChat = await Chat.findByIdAndUpdate(
      chatId,
      { status: "NONACTIVE" },
      { new: true }
    );

    if (!updatedChat) {
      console.log(`⚠️ Chat ${chatId} tidak ditemukan`);
      return null;
    }
    // Hapus dari Map
    lastHeartbeat.delete(chatId);
    // Validasi minimal isi pesan
    console.log(consent);
    console.log(consent=='true');
    console.log(consent=='false');
    if (consent=='false') {
      const result = await Message.deleteMany({ chatId: chatId });
      const result1 = await Chat.findByIdAndDelete(chatId);
    }
    

    console.log(`✅ Chat ${chatId} berhasil diubah menjadi NONACTIVE dan karena consen = ${consent}, maka chat ${(consent)?'tidak dihapus':'dihapus'}`);
    return updatedChat;
  } catch (error) {
    console.error(`❌ Gagal mengubah status chat ${chatId}:`, error);
    throw error;
  }
};


const nonactiveChat = async (req, res) => {
  try {
    if (!req.session.chatId) {
      return res.status(400).json({ error: true, message: 'Chat belum dibuat' });
    }

    // Panggil fungsi logic
    const updatedChat = await setChatNonActive(req.session.chatId, req.session.consent);

    if (!updatedChat) {
      return res.status(404).json({ error: true, message: 'Chat tidak ditemukan' });
    }
    // Hapus session setelah di-nonaktifkan
    delete req.session.chatId;

    return res.status(200).json({
      message: 'Status chat berhasil diubah menjadi NONACTIVE',
      data: updatedChat
    });
  } catch (error) {
    console.error('Error saat mengubah status chat:', error);
    return res.status(500).json({ error: 'Gagal mengubah status chat' });
  }
};



// Menyimpan waktu terakhir heartbeat untuk setiap chat
const lastHeartbeat = new Map();

// Endpoint heartbeat
const postHeartbeat = async (req, res) => {

  // Simpan waktu terakhir heartbeat (timestamp sekarang)
  lastHeartbeat.set(req.session.chatId, Date.now());
  console.log(`💓 Heartbeat diterima dari chatId ${req.session.chatId} pada ${new Date().toLocaleTimeString()}`);

  res.status(200).json({ message: "Heartbeat diterima" });
};

// Interval pengecekan tiap 1 menit
setInterval(async () => {
  const now = Date.now();
  const TIMEOUT = 5 * 60 * 1000; // 5 menit

  for (const [chatId, lastTime] of lastHeartbeat.entries()) {
    if (now - lastTime > TIMEOUT) {
      console.log(`⚠️ Chat ${chatId} tidak aktif selama >5 menit. Menonaktifkan...`);

      try {
        setChatNonActive(chatId, 'true');//sementara
      } catch (err) {
        console.error(`❌ Gagal menonaktifkan chat ${chatId}:`, err.message);
      }
    }
  }
}, 2 * 60 * 1000); // periksa setiap 1 menit

// const postConsent = async (req, res) => {
//   if (!req.session.chatId) {
//     return res.status(400).json({ 
//       error: true,
//       refresh: true,
//       message: 'Chat harus dibuat terlebih dahulu.'
//     });
//   }
//   // Cek apakah chat dengan chatId ini masih aktif
//   const chat = await Chat.findById(req.session.chatId);

//   if (!chat) {
//     return res.status(404).json({
//       error: true,
//       refresh: true,
//       message: 'Chat tidak ditemukan.'
//     });
//   }

//   if (chat.status !== "ACTIVE") {
//     return res.status(400).json({
//       error: true,
//       refresh: true,
//       message: 'Chat sudah tidak aktif. Silakan buat chat baru.'
//     });
//   }

//   const { consent } = req.body;

//   req.session.consent = consent;
//   return res.status(200).json({
//       error: false,
//       message: 'berhasil consent'
//     });
// };
module.exports = { getChat, createChat, nonactiveChat, postMsg, setInterval, postHeartbeat };