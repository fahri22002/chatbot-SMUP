// routes/knowledgeRoutes.js
const express = require("express");
const { isAdmin } = require("../middleware/authAdmin.js");
const { 
  getAllKnowledge, 
  createKnowledge, 
  updateKnowledge, 
  deleteKnowledge,
  toggleKnowledgeStatus // <-- 1. Impor fungsi baru
} = require("../controller/knowledgeController.js");

const knowledgeRouter = express.Router();

knowledgeRouter.use(isAdmin);

knowledgeRouter.get('/', getAllKnowledge);
knowledgeRouter.post('/', createKnowledge);

// --- RUTE BARU DI SINI ---
// Gunakan PUT atau PATCH untuk mengubah status
knowledgeRouter.put('/:id/status', toggleKnowledgeStatus); // <-- 2. Tambahkan rute baru

knowledgeRouter.put('/:id', updateKnowledge);
knowledgeRouter.delete('/:id', deleteKnowledge);

module.exports = knowledgeRouter;