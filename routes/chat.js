const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { optionalAuth } = require('../middleware/apiAuth');

router.post('/', optionalAuth, chatController.createChat);

module.exports = router;
