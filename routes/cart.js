const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/apiAuth');
const cartController = require('../controllers/cartController');

router.get('/', protect, cartController.getCart);
router.post('/add/:courseId', protect, cartController.addToCart);
router.delete('/remove/:courseId', protect, cartController.removeFromCart);
router.post('/apply-discount', protect, cartController.applyDiscount);
router.delete('/remove-discount', protect, cartController.removeDiscount);

module.exports = router;
