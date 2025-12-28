const { Chat } = require('../models/chatModel');
const { Message } = require('../models/messageModel');
const { Admin } = require('../models/adminModel');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

// const { admin } = require("../auth/middleware.js");

console.log('🔥 appController loaded — siap jalan!');
const consentList = new Map();

const getChat = async (req, res) => {
  try {
    const chatId = req.session.chatId;

    const messages = await Message.find({ chatId: req.session.chatId }).sort({
      createdAt: -1,
    });

    if (messages.length === 0) {
      return res
        .status(404)
        .json({ error: true, message: 'Chat history tidak ditemukan' });
    }
    // Proses lampiran (attachment)
    const processedMessages = messages.map((msg) => {
      if (!msg.attachment) {
        return {
          ...msg.toObject(),
          attachmentUrl: null,
        };
      }

      const filePath = path.join(__dirname, '../public/upload', msg.attachment);

      if (fs.existsSync(filePath)) {
        return {
          ...msg.toObject(),
          attachmentUrl: `http://localhost:5000/upload/${msg.attachment}`,
        };
      } else {
        return {
          ...msg.toObject(),
          attachmentUrl: null,
        };
      }
    });

    res.status(200).json({ error: false, data: processedMessages });
  } catch (error) {
    res.status(500).json({
      error: true,
      message: error.message,
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
        message: 'Chat harus dibuat terlebih dahulu.',
      });
    }
    // Cek apakah chat dengan chatId ini masih aktif
    const chat = await Chat.findById(req.session.chatId);

    if (!chat) {
      return res.status(404).json({
        error: true,
        refresh: true,
        message: 'Chat tidak ditemukan.',
      });
    }

    if (chat.status !== 'ACTIVE') {
      return res.status(400).json({
        error: true,
        refresh: true,
        message: 'Chat sudah tidak aktif. Silakan buat chat baru.',
      });
    }

    // Ambil data text + file
    const { msg } = req.body;
    const file = req.file;

    // Buat pesan baru
    const newMessage = new Message({
      chatId: req.session.chatId,
      msg,
      attachment: null,
      sender: 'USER',
    });

    await newMessage.save(); // butuh id untuk rename file
    const messageId = newMessage._id.toString();

    if (file) {
      const ext = path.extname(file.originalname);
      const newFilename = `${messageId}${ext}`;
      const oldPath = file.path;
      const newPath = path.join('public/upload/', newFilename);

      fs.renameSync(oldPath, newPath);

      // Update message dengan filename final
      newMessage.attachment = newFilename;
      await newMessage.save();
    }

    const response = await axios.post('http://127.0.0.1:8080/reply', {
      message: msg,
    });
    const replyText = response.data.Reply;

    const newReply = new Message({
      chatId: req.session.chatId,
      msg: replyText,
      attachment: null,
      sender: 'SELF',
    });

    await newReply.save();

    // 5. Response ke FE
    res.status(201).json({
      error: false,
      status: 'Pesan berhasil dikirim.',
      messageId: messageId,
      message: msg,
      attachment: newMessage.attachment || null,
      reply: replyText,
    });
  } catch (error) {
    console.error('Error saat mengirim pesan:', error);
    res.status(500).json({
      error: true,
      message: error.message,
    });
  }
};

const createChatwithConsent = async (req, res) => {
  try {
    const { captchaToken, consent } = req.body;

    if (!captchaToken) {
      return res
        .status(400)
        .json({ error: true, message: 'Verifikasi CAPTCHA diperlukan.' });
    }

    const secretKey = process.env.RECAPTCHA_SECRET_KEY;
    if (!secretKey) {
      console.error('RECAPTCHA_SECRET_KEY tidak ditemukan di file .env');
      return res
        .status(500)
        .json({ error: true, message: 'Konfigurasi server error.' });
    }

    const verificationUrl = 'https://www.google.com/recaptcha/api/siteverify';

    const params = new URLSearchParams();
    params.append('secret', secretKey);
    params.append('response', captchaToken);
    const verificationResponse = await axios.post(verificationUrl, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    const { success, 'error-codes': errorCodes } = verificationResponse.data;

    if (!success) {
      console.warn('Verifikasi CAPTCHA gagal:', errorCodes);
      return res
        .status(401)
        .json({
          error: true,
          message: 'Verifikasi CAPTCHA gagal. Silakan coba lagi.',
        });
    }
    if (req.session.chatId) {
      setChatNonActive(req.session.chatId, req.session.consent);
      delete req.session.chatId;
      delete req.session.consent;
    }
    const status = 'ACTIVE';

    // Buat dan simpan chat
    const newChat = new Chat({ status });
    await newChat.save();

    req.session.chatId = newChat._id;
    req.session.consent = consent || 'false';

    consentList.set(req.session.chatId, req.session.consent);
    console.log(
      `Sesi chat ${newChat._id} dibuat dengan consent=${req.session.consent}`
    );

    res.status(201).json({
      message: 'Chat berhasil dibuat',
      data: newChat,
    });
  } catch (error) {
    console.error('Error saat membuat chat:', error);
    if (error.response) {
      console.error('Error data from Google:', error.response.data);
    }
    res.status(500).json({ error: 'Gagal membuat chat' });
  }
};

const createChat = async (req, res) => {
  try {
    if (req.session.chatId) {
      setChatNonActive(req.session.chatId);
      delete req.session.chatId;
    }
    const status = 'ACTIVE';

    // Buat dan simpan chat
    const newChat = new Chat({ status });
    await newChat.save();
    req.session.chatId = newChat._id;

    res.status(201).json({
      message: 'Chat berhasil dibuat',
      data: newChat,
    });
  } catch (error) {
    console.error('Error saat membuat chat:', error);
    res.status(500).json({ error: 'Gagal membuat chat' });
  }
};

const deleteChatAndAttachments = async (chatId) => {
  try {
    // Ambil semua pesan untuk chat ini
    const messages = await Message.find({ chatId });

    for (const msg of messages) {
      if (msg.attachment) {
        // Path file di disk
        const filePath = path.join(
          __dirname,
          '..',
          'public',
          'upload',
          msg.attachment
        );

        // Jika file ada, hapus
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`File dihapus: ${filePath}`);
        } else {
          console.log(`File tidak ditemukan, skip: ${filePath}`);
        }
      }
    }

    // Hapus semua message dari DB
    await Message.deleteMany({ chatId });

    // Hapus chat
    await Chat.findByIdAndDelete(chatId);

    console.log(`Chat ${chatId} berhasil dihapus beserta semua attachment.`);
    return true;
  } catch (err) {
    console.error('Gagal menghapus chat:', err);
    return false;
  }
};

const setChatNonActive = async (chatId, consent) => {
  try {
    // Cek apakah chat dengan chatId ini masih aktif
    const chat = await Chat.findById(chatId);

    if (!chat) {
      lastHeartbeat.delete(chatId);
      console.log('Chat tidak ditemukan.');
      return null;
    }

    if (chat.status !== 'ACTIVE') {
      console.log('Chat sudah tidak aktif.');
      return null;
    }
    console.log(`[LOG]: NONACTIVE : ${chatId}`);
    const updatedChat = await Chat.findByIdAndUpdate(
      chatId,
      { status: 'NONACTIVE' },
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
    console.log(consent == 'true');
    console.log(consent == 'false');
    if (consent != 'true') {
      await deleteChatAndAttachments(chatId);
    }

    return updatedChat;
  } catch (error) {
    console.error(`❌ Gagal mengubah status chat ${chatId}:`, error);
    throw error;
  }
};

const nonactiveChat = async (req, res) => {
  try {
    if (!req.session.chatId) {
      return res
        .status(400)
        .json({ error: true, message: 'Chat belum dibuat' });
    }

    // Panggil fungsi logic
    const updatedChat = await setChatNonActive(
      req.session.chatId,
      req.session.consent
    );

    if (!updatedChat) {
      return res
        .status(404)
        .json({ error: true, message: 'Chat tidak ditemukan' });
    }
    // Hapus session setelah di-nonaktifkan
    delete req.session.chatId;

    return res.status(200).json({
      message: 'Status chat berhasil diubah menjadi NONACTIVE',
      data: updatedChat,
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
  console.log(
    `💓 Heartbeat diterima dari chatId ${
      req.session.chatId
    } pada ${new Date().toLocaleTimeString()}`
  );

  res.status(200).json({ message: 'Heartbeat diterima' });
};

// Interval pengecekan tiap 1 menit
setInterval(async () => {
  const now = Date.now();
  const TIMEOUT = 5 * 60 * 1000; // 5 menit
  console.log('[LOG]: Cek heartbeat!');
  console.log('[LOG]: online ' + [...lastHeartbeat.keys()]);

  for (const [chatId, lastTime] of lastHeartbeat.entries()) {
    if (now - lastTime > TIMEOUT) {
      console.log(
        `⚠️ Chat ${chatId} tidak aktif selama >5 menit dengan consent=${consentList.get(
          chatId
        )}. Menonaktifkan...`
      );

      try {
        setChatNonActive(chatId, consentList.get(chatId)); //sementara
      } catch (err) {
        console.error(`❌ Gagal menonaktifkan chat ${chatId}:`, err.message);
      }
    }
  }
}, 2 * 60 * 1000); // periksa setiap 2 menit

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
module.exports = {
  getChat,
  createChat,
  nonactiveChat,
  postMsg,
  setInterval,
  postHeartbeat,
  createChatwithConsent,
};
