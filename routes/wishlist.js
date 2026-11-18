const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/apiAuth');
const wishlistController = require('../controllers/wishlistController');

router.get('/', protect, wishlistController.getWishlist);
router.post('/toggle/:courseId', protect, wishlistController.toggleWishlist);

module.exports = router;
