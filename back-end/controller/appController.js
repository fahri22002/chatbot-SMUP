const { Chat } = require('../models/chatModel');
const { Message } = require('../models/messageModel');
const { Admin } = require('../models/adminModel');
const axios = require('axios');
// const { admin } = require("../auth/middleware.js");




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
        message: 'Chat harus dibuat terlebih dahulu.'
      });
    }

    const { msg, attachment } = req.body;

    // Validasi minimal isi pesan
    if (!msg) {
      return res.status(400).json({
        error: true,
        message: 'Pesan harus diisi.'
      });
    }

    // Buat pesan baru
    const newMessage = new Message({
      chatId: req.session.chatId,
      msg,
      attachment,
      sender: "USER"
    });

    // Simpan ke database
    await newMessage.save();

    
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
    
    await newReply.save();
    
    res.status(201).json({
      error: false,
      status: 'Pesan berhasil dikirim.',
      message: msg,
      reply: replyText
    });
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
    const status  = "ACTIVE";

    // Buat dan simpan chat
    const newChat = new Chat({ status });
    await newChat.save();
    req.session.chatId = newChat._id;

    res.status(201).json({
      message: 'Chat berhasil dibuat',
      data: newChat
    });
  } catch (error) {
    console.error('Error saat membuat chat:', error);
    res.status(500).json({ error: 'Gagal membuat chat' });
  }
};

const nonactiveChat = async (req, res) => {
  try {

    if (!req.session.chatId) {
      return res.status(400).json({ error: true, message: 'Chat belum dibuat' });
    }

    // update chat berdasarkan req.session.chatId
    const updatedChat = await Chat.findByIdAndUpdate(
      req.session.chatId,
      { status: "NONACTIVE" },
      { new: true } // return data chat setelah diupdate
    );

    if (!updatedChat) {
      return res.status(404).json({ error: true, message: 'Chat tidak ditemukan' });
    }
    delete req.session.chatId;


    res.status(200).json({
      message: 'Status chat berhasil diubah menjadi NONACTIVE',
      data: updatedChat
    });
  } catch (error) {
    console.error('Error saat mengubah status chat:', error);
    res.status(500).json({ error: 'Gagal mengubah status chat' });
  }
};




module.exports = { getChat, createChat, nonactiveChat, postMsg };