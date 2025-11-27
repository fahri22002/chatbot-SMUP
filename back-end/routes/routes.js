const express = require("express");
const { 
  getChat, 
  createChat, 
  nonactiveChat, 
  postMsg, 
  postHeartbeat,
  createChatwithConsent,
  // postConsent,
} = require("../controller/appController.js");

const adminRouter = require('./adminroutes.js');
const { upload, storage } = require("../middleware/upload.js");

const router = express.Router();

// Admin routes
// This is correct. It ensures all routes from adminRouter are prefixed with '/admin'.
router.use('/admin', adminRouter); 

// App routes
router.get('/chat', getChat);
// router.post('/create-chat', createChat);
router.post('/create-chat', createChatwithConsent);
// router.post('/consent', postConsent);
router.get('/nonactive', nonactiveChat);
router.post('/send-msg', upload.single('attachment'), postMsg);
router.post('/heartbeat', postHeartbeat);


module.exports = router;