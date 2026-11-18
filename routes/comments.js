const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/apiAuth');
const commentController = require('../controllers/commentController');
const { validateComment } = require('../validators/commentValidator');

router.get('/:courseId', commentController.getComments);
router.post('/:courseId', protect, validateComment, commentController.addComment);

module.exports = router;
