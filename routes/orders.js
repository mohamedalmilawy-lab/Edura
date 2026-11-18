const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/apiAuth');
const orderController = require('../controllers/orderController');

router.get('/', protect, orderController.getOrders);
router.post('/confirm', protect, orderController.confirmOrder);
router.get('/:id', protect, orderController.getCourseById);

module.exports = router;
