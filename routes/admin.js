const express = require('express');
const router = express.Router();
const { isAdmin } = require('../middleware/auth');
const upload = require('../middleware/upload');
const adminController = require('../controllers/adminController');
const courseController = require('../controllers/courseController');
const categoryController = require('../controllers/categoryController');
const orderController = require('../controllers/orderController');
const userController = require('../controllers/userController');
const commentController = require('../controllers/commentController');
const contactController = require('../controllers/contactController');
const bannerController = require('../controllers/bannerController');
const discountCodeController = require('../controllers/discountCodeController');
const { validateAdminCourse } = require('../validators/courseValidator');
const { validateCreateUser } = require('../validators/userValidator');
const { validateCategory } = require('../validators/categoryValidator');
const { validateDiscountCode } = require('../validators/discountCodeValidator');
const courseUpload = upload.pdfUpload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'pdfs', maxCount: 10 }
]);

// Dashboard
router.get('/dashboard', isAdmin, adminController.getDashboard);

// Admin profile
router.get('/profile', isAdmin, userController.getAdminProfile);
router.put('/profile', isAdmin, upload.single('profileImage'), userController.updateAdminProfile);

// Courses CRUD
router.get('/courses', isAdmin, courseController.getAdminCourses);
router.post('/courses', isAdmin, courseUpload, validateAdminCourse, courseController.createCourse);
router.put('/courses/:id', isAdmin, courseUpload, validateAdminCourse, courseController.updateCourse);
router.delete('/courses/:id', isAdmin, courseController.deleteCourse);

// Categories CRUD
router.get('/categories', isAdmin, categoryController.getAdminCategories);
router.post('/categories', isAdmin, validateCategory, categoryController.createCategory);
router.put('/categories/:id', isAdmin, validateCategory, categoryController.updateCategory);
router.delete('/categories/:id', isAdmin, categoryController.deleteCategory);

// Orders
router.get('/orders', isAdmin, orderController.getAdminOrders);
router.get('/orders/:id', isAdmin, orderController.getAdminOrderDetail);
router.put('/orders/:id', isAdmin, orderController.updateOrderStatus);
router.delete('/orders/:id', isAdmin, orderController.deleteOrder);

// Users
router.get('/users', isAdmin, userController.getAdminUsers);
router.post('/users', isAdmin, validateCreateUser, userController.createUser);
router.put('/users/:id/profile', isAdmin, upload.single('profileImage'), userController.updateAdminUserProfile);
router.put('/users/:id/role', isAdmin, userController.updateUserRole);
router.post('/users/:id/recharge', isAdmin, userController.rechargeWallet);
router.delete('/users/:id', isAdmin, userController.deleteUser);

// Comments
router.get('/comments', isAdmin, commentController.getAdminComments);
router.delete('/comments/:id', isAdmin, commentController.deleteComment);

// Banners
router.get('/banners', isAdmin, bannerController.getAdminBanners);
router.post('/banners', isAdmin, upload.single('image'), bannerController.createBanner);
router.put('/banners/:id', isAdmin, upload.single('image'), bannerController.updateBanner);
router.delete('/banners/:id', isAdmin, bannerController.deleteBanner);

// Discount codes
router.get('/discount-codes', isAdmin, discountCodeController.getAdminDiscountCodes);
router.post('/discount-codes', isAdmin, validateDiscountCode, discountCodeController.createAdminDiscountCode);
router.put('/discount-codes/:id', isAdmin, validateDiscountCode, discountCodeController.updateAdminDiscountCode);
router.delete('/discount-codes/:id', isAdmin, discountCodeController.deleteAdminDiscountCode);

// Contacts
router.get('/contacts', isAdmin, contactController.getAdminContacts);
router.delete('/contacts/:id', isAdmin, contactController.deleteContact);

module.exports = router;
