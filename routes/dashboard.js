const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { validateLogin } = require('../validators/authValidator');

// Session based authentication used exclusively by the admin/teacher dashboards
router.get('/login', authController.getLogin);
router.post('/login', validateLogin, authController.postLogin);
router.get('/logout', authController.logout);

module.exports = router;
