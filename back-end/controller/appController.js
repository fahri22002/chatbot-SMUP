const { Chat } = require('../models/chatModel');
const { Message } = require('../models/messageModel');
const { Admin } = require('../models/adminModel');
const axios = require('axios');
// const { admin } = require("../auth/middleware.js");




const getChat = async (req, res) => {
    try {
        const chatId = req.params.chatId;

        const messages = await Message.aggregate([
            {
                $match: { chatId: chatId } 
            },
            {
                $lookup: {
                    from: "chat", 
                    localField: "chatId",
                    foreignField: "_id",
                    as: "userData"
                }
            },
            {
                $unwind: "$userData" 
            },
            {
                $sort: { createdAt: -1 } 
            },
            {
                $project: {
                    msg: 1,
                    createdAt: 1,
                    chatId: 1,
                    sender: 1,
                    chatAt:"$userData.createdAt"
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


const postChat = async (req, res) => {
    try {
        const chatId = req.params.chatId;

        const messages = await Message.aggregate([
            {
                $match: { chatId: chatId } 
            },
            {
                $lookup: {
                    from: "chat", 
                    localField: "chatId",
                    foreignField: "_id",
                    as: "userData"
                }
            },
            {
                $unwind: "$userData" 
            },
            {
                $sort: { createdAt: -1 } 
            },
            {
                $project: {
                    msg: 1,
                    createdAt: 1,
                    chatId: 1,
                    sender: 1,
                    chatAt:"$userData.createdAt"
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

const getReply = async (req, res) => {
    try{
        // Panggil endpoint FastAPI
        const response = await axios.get('http://127.0.0.1:8080/');
        // Kirim hasilnya ke client
        res.json(response.data);
    } catch (error) {
    console.error('Error fetching data from FastAPI:', error.message);
    res.status(500).json({ error: 'Failed to fetch data from FastAPI' });
  }
}

const postReply = async (req, res) => {
    try{
        // Panggil endpoint FastAPI
        const response = await axios.get('http://127.0.0.1:8080/');
        // Kirim hasilnya ke client
        res.json(response.data);
    } catch (error) {
    console.error('Error fetching data from FastAPI:', error.message);
    res.status(500).json({ error: 'Failed to fetch data from FastAPI' });
  }
}

const createChat = async (req, res) => {
  try {
    const status  = "ACTIVE";

    // Buat dan simpan chat
    const newChat = new Chat({ status });
    await newChat.save();

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
    const { _id } = req.body; // ambil _id dari body request

    if (!_id) {
      return res.status(400).json({ error: true, message: 'Parameter _id wajib dikirim' });
    }

    // update chat berdasarkan _id
    const updatedChat = await Chat.findByIdAndUpdate(
      _id,
      { status: "NONACTIVE" },
      { new: true } // return data chat setelah diupdate
    );

    if (!updatedChat) {
      return res.status(404).json({ error: true, message: 'Chat tidak ditemukan' });
    }

    res.status(200).json({
      message: 'Status chat berhasil diubah menjadi NONACTIVE',
      data: updatedChat
    });
  } catch (error) {
    console.error('Error saat mengubah status chat:', error);
    res.status(500).json({ error: 'Gagal mengubah status chat' });
  }
};

module.exports = { getChat, getReply, createChat, nonactiveChat };