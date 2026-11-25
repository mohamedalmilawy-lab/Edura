const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/apiAuth');
const userController = require('../controllers/userController');
const { validateUserProfile, validatePasswordChange } = require('../validators/userValidator');
const upload = require('../middleware/upload');

router.get('/teachers', userController.getTeachers);
router.get('/profile', protect, userController.getProfile);
router.put('/profile', protect,
  upload.fields([
    { name: 'profileImage', maxCount: 1 },
    { name: 'avatar', maxCount: 1 },
    { name: 'image', maxCount: 1 }
  ]),
  validateUserProfile,
  userController.updateProfile
);
router.put('/profile/password', protect, validatePasswordChange, userController.changePassword);
router.get('/wallet', protect, userController.getWallet);

module.exports = router;
