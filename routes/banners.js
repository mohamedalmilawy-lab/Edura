const express = require('express');
const router = express.Router();
const bannerController = require('../controllers/bannerController');

router.get('/', bannerController.listActiveBanners);
router.get('/:id', bannerController.getBanner);

module.exports = router;
