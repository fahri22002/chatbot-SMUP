const express = require("express");
const rateLimit = require('express-rate-limit'); // <--- 1. Import library

// 1. Impor semua fungsi dari controller
const { 
  createAccount, 
  login, 
  logout, // Pastikan 'logout' diimpor
  getAllAdmins,
  updateAdminPassword,
  deleteAdmin,
  changeOwnPassword,
  getChatHistory, 
  deleteOldChats,
  getAllChats,
  deleteChatById 
} = require("../controller/adminController.js");

// 2. Impor middleware keamanan Anda
const { isAdmin, isSuperAdmin } = require("../middleware/authAdmin.js");

const adminRouter = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 5, // Maksimal 5 kali percobaan gagal
  message: { 
    error: true, 
    message: "Terlalu banyak percobaan login. Silakan coba lagi dalam 15 menit." 
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

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

adminRouter.post('/create-account', isSuperAdmin, createAccount); // Create
adminRouter.get('/list', isSuperAdmin, getAllAdmins);             // Read
adminRouter.put('/:id/password', isSuperAdmin, updateAdminPassword); // Update
adminRouter.delete('/:id', isSuperAdmin, deleteAdmin);

// Rute untuk logout (diproteksi)
adminRouter.post('/logout', isAdmin, logout);

// Rute untuk mengambil riwayat chat berdasarkan query ?chatId=... (diproteksi)
adminRouter.get('/chats/history', isAdmin, getChatHistory);

// Rute untuk menghapus chat lama (diproteksi)
adminRouter.delete('/chats/delete-old', isAdmin, deleteOldChats);

adminRouter.get('/chats/all', isAdmin, getAllChats);
adminRouter.delete('/chats/:id', isAdmin, deleteChatById);
adminRouter.put('/change-password', isAdmin, changeOwnPassword);


module.exports = adminRouter;