const express = require('express');
const router = express.Router();
const courseController = require('../controllers/courseController');
const { optionalAuth } = require('../middleware/apiAuth');

// Public routes (optional auth enriches the response with cart/wishlist flags)
router.get('/', optionalAuth, courseController.getAllCourses);
router.get('/:id', optionalAuth, courseController.getCourseDetail);

module.exports = router;
