const express = require("express");

// 1. Impor semua fungsi dari controller
const { 
  createAccount, 
  login, 
  logout, // Pastikan 'logout' diimpor
  getChatHistory, 
  deleteOldChats,
  getAllChats,
  deleteChatById 
} = require("../controller/adminController.js");

// 2. Impor middleware keamanan Anda
const { isAdmin } = require("../middleware/authAdmin.js");

const adminRouter = express.Router();

// ===================================
// === RUTE PUBLIK (Tidak Perlu Login)
// ===================================

// Hanya login yang boleh diakses publik
adminRouter.post('/login', login);


// ===================================
// === RUTE TERPROTEKSI (Wajib Login)
// ===================================
// Middleware 'isAdmin' akan berjalan terlebih dahulu.
// Jika user belum login, controller tidak akan pernah dijalankan.

// Rute untuk membuat admin baru (diproteksi)
adminRouter.post('/create-account', isAdmin, createAccount);

// Rute untuk logout (diproteksi)
adminRouter.post('/logout', isAdmin, logout);

// Rute untuk mengambil riwayat chat berdasarkan query ?chatId=... (diproteksi)
adminRouter.get('/chats/history', isAdmin, getChatHistory);

// Rute untuk menghapus chat lama (diproteksi)
adminRouter.delete('/chats/delete-old', isAdmin, deleteOldChats);

adminRouter.get('/chats/all', isAdmin, getAllChats);
adminRouter.delete('/chats/:id', isAdmin, deleteChatById);


module.exports = adminRouter;