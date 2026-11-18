const express = require('express');
const router = express.Router();
const contactController = require('../controllers/contactController');
const { validateContact } = require('../validators/contactValidator');
const { optionalAuth } = require('../middleware/apiAuth');

router.post('/', optionalAuth, validateContact, contactController.postContact);

module.exports = router;
