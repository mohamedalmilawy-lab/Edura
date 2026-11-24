const express = require('express');
const router = express.Router();
const courseController = require('../controllers/courseController');
const { optionalAuth, protect } = require('../middleware/apiAuth');

// Public routes (optional auth enriches the response with cart/wishlist flags)
router.get('/', optionalAuth, courseController.getAllCourses);
router.get('/popular', courseController.getPopularCourses);
router.get('/recommended', protect, courseController.getRecommendedCourses);
router.get('/search', courseController.searchCourses);
router.get('/:id', optionalAuth, courseController.getCourseDetail);

module.exports = router;
