const express = require("express");
const { register, login, handleGoogleAuth, resetPassword, signOutUser, checkSession } = require("../controller/authController.js");
const { postReply, getReplies ,editProfile, profile, saveSuicidePrediction, newsUpdate, getSuicidePredictions, getHealthArticles, articleById, postComments, getComments, postCardioPredict, postImageProfile, getCardioHistory } = require("../controller/appController.js");
const { authUser } = require("../auth/middleware.js")
const { getTotalMedics, getTotalNews, getTotalUsers, getAllMedics, getAllUsers, searchUser, promoteToMedic, deleteUser, changeToUser } = require("../controller/adminController.js")


const router = express.Router();

// auth
router.post('/googleAuth', handleGoogleAuth);
router.post('/register', register);
router.post('/login', login);
router.post('/logout', signOutUser);
router.post('/resetPassword', resetPassword);

// admin

router.get('/admin/users', getTotalUsers);
router.get('/admin/medics', getTotalMedics);
router.get('/admin/news', getTotalNews);
router.get('/admin/usersDetail', getAllUsers);
router.get('/admin/medicsDetail', getAllMedics);
router.get('/admin/search-user/', searchUser);
router.put('/admin/promote-to-medic', promoteToMedic);
router.put('/admin/changeToUser', changeToUser);
router.delete('/admin/delete-user', deleteUser);




// app
router.put('/profile', editProfile);
router.get('/profile', profile);
router.post('/suicideHistory', saveSuicidePrediction);
router.get('/suicideHistory', getSuicidePredictions);
router.put('/updateImage',postImageProfile);
router.get('/news/update', newsUpdate);
router.get('/news', getHealthArticles); 
router.get('/comments/:newsId', getComments); //gw ubah dlu buat komen
router.get('/riwayatCardio/', getCardioHistory); 
router.get('/news/:id', articleById)
router.post("/comments", postComments);
router.post("/reply", postReply);
router.get("/reply/:commentId", getReplies);
router.get("/check-session", checkSession);
router.post("/postcardiohistory", postCardioPredict);
router.get('/img/:url', async (req, res) => {
  const encodedUrl = req.params.url;

  try {
    const imageUrl = decodeURIComponent(encodedUrl);

    if (!imageUrl.startsWith('http')) {
      return res.status(400).send('Invalid image URL');
    }

    const response = await fetch(imageUrl);
    if (!response.ok) {
      return res.status(500).send('Failed to fetch image');
    }

    const contentType = response.headers.get('content-type');
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);


    res.set('Content-Type', contentType);
    res.send(buffer);
  } catch (error) {
    console.error('Image fetch error:', error);
    res.status(500).send('Error fetching image');
  }
});



module.exports = router;