// models/knowledgeModel.js
const mongoose = require('mongoose');

const knowledgeSchema = new mongoose.Schema({
  topic: { type: String, required: true },
  content: { type: String, required: true },
  // --- PERUBAHAN DI SINI ---
  category: { type: String, required: true }, // <-- TAMBAHKAN CATEGORY
  status: {                                   // <-- TAMBAHKAN STATUS
    type: String,
    enum: ['ACTIVE', 'INACTIVE'], // Hanya izinkan dua nilai ini
    default: 'ACTIVE'             // Otomatis 'ACTIVE' saat dibuat
  }
}, { timestamps: true });

const KnowledgeBase = mongoose.model('KnowledgeBase', knowledgeSchema, 'knowledgebase');

module.exports = { KnowledgeBase };