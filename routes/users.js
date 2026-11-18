const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/apiAuth');
const userController = require('../controllers/userController');
const { validateUserProfile, validatePasswordChange } = require('../validators/userValidator');

router.get('/profile', protect, userController.getProfile);
router.put('/profile', protect, validateUserProfile, userController.updateProfile);
router.put('/profile/password', protect, validatePasswordChange, userController.changePassword);
router.get('/wallet', protect, userController.getWallet);

module.exports = router;
