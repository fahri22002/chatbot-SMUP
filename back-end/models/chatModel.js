const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
},{ timestamps: true });
const Chat = mongoose.model('Chat', chatSchema, 'chat');

module.exports = { Chat };