const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { protect } = require('../middleware/apiAuth');
const { validateRegister, validateLogin, validateForgot, validateReset } = require('../validators/authValidator');

// Public authentication API
router.post('/register', validateRegister, authController.apiRegister);
router.post('/login', validateLogin, authController.apiLogin);
router.post('/logout', protect, authController.apiLogout);
router.post('/forgot-password', validateForgot, authController.apiForgotPassword);
router.post('/reset-password/:id/:token', validateReset, authController.apiResetPassword);

// Current authenticated user
router.get('/me', protect, authController.getMe);

module.exports = router;
