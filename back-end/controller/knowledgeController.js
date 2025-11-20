// controller/knowledgeController.js
const { KnowledgeBase } = require('../models/knowledgeModel');

// GET /api/knowledge
exports.getAllKnowledge = async (req, res) => {
  try {
    const allData = await KnowledgeBase.find({}).sort({ updatedAt: -1 });
    res.status(200).json({ error: false, data: allData });
  } catch (error) {
    res.status(500).json({ error: true, message: error.message });
  }
};

// POST /api/knowledge
exports.createKnowledge = async (req, res) => {
  try {
    // --- UBAH DI SINI ---
    const { topic, content, category } = req.body;
    if (!topic || !content || !category) {
      return res.status(400).json({ error: true, message: 'Topik, Konten, dan Kategori diperlukan' });
    }
    // 'status' tidak perlu ditambahkan di sini, karena model sudah menanganinya secara default
    const newData = new KnowledgeBase({ topic, content, category });
    await newData.save();
    res.status(201).json({ error: false, message: 'Data berhasil dibuat', data: newData });
  } catch (error) {
    res.status(500).json({ error: true, message: error.message });
  }
};

// PUT /api/knowledge/:id
exports.updateKnowledge = async (req, res) => {
  try {
    const { id } = req.params;
    // --- UBAH DI SINI ---
    const { topic, content, category } = req.body; // Status tidak diubah di sini
    
    const updatedData = await KnowledgeBase.findByIdAndUpdate(
      id, 
      { topic, content, category }, // Tambahkan category ke update
      { new: true, runValidators: true }
    );
    
    if (!updatedData) {
      return res.status(404).json({ error: true, message: 'Data tidak ditemukan' });
    }
    res.status(200).json({ error: false, message: 'Data berhasil diupdate', data: updatedData });
  } catch (error) {
    res.status(500).json({ error: true, message: error.message });
  }
};

// --- FUNGSI BARU DI SINI ---
/**
 * @description Mengubah status (ACTIVE <-> INACTIVE)
 */
exports.toggleKnowledgeStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const knowledgeItem = await KnowledgeBase.findById(id);

    if (!knowledgeItem) {
      return res.status(404).json({ error: true, message: 'Data tidak ditemukan' });
    }

    // Logika toggle: jika ACTIVE jadi INACTIVE, dan sebaliknya
    const newStatus = knowledgeItem.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

    const updatedItem = await KnowledgeBase.findByIdAndUpdate(
      id,
      { status: newStatus },
      { new: true }
    );

    res.status(200).json({ 
      error: false, 
      message: `Status berhasil diubah menjadi ${newStatus}`, 
      data: updatedItem 
    });

  } catch (error) {
    res.status(500).json({ error: true, message: error.message });
  }
};


// DELETE /api/knowledge/:id
exports.deleteKnowledge = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedData = await KnowledgeBase.findByIdAndDelete(id);
    
    if (!deletedData) {
      return res.status(404).json({ error: true, message: 'Data tidak ditemukan' });
    }
    res.status(200).json({ error: false, message: 'Data berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ error: true, message: error.message });
  }
};