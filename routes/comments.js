const express = require('express');
const router = express.Router();
const { protect, optionalAuth } = require('../middleware/apiAuth');
const commentController = require('../controllers/commentController');
const { validateComment } = require('../validators/commentValidator');

router.get('/:courseId', optionalAuth, commentController.getComments);
router.post('/:courseId', protect, validateComment, commentController.addComment);

module.exports = router;
