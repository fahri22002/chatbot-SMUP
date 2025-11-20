const express = require("express");
const { 
  getChat, 
  createChat, 
  nonactiveChat, 
  postMsg, 
  postHeartbeat,
  // postConsent,
} = require("../controller/appController.js");

const adminRouter = require('./adminroutes.js');

const router = express.Router();

// Admin routes
// This is correct. It ensures all routes from adminRouter are prefixed with '/admin'.
router.use('/admin', adminRouter); 

// App routes
router.get('/chat', getChat);
router.post('/create-chat', createChat);
// router.post('/consent', postConsent);
router.get('/nonactive', nonactiveChat);
router.post('/send-msg', postMsg);
router.post('/heartbeat', postHeartbeat);

module.exports = router;