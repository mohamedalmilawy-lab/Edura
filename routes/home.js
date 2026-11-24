const express = require('express');
const router = express.Router();
const homeController = require('../controllers/homeController');
const { optionalAuth } = require('../middleware/apiAuth');

router.get('/', optionalAuth, homeController.getHome);

module.exports = router;
