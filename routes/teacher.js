const express = require('express');
const router = express.Router();
const { isTeacher, isInstructor } = require('../middleware/auth');
const upload = require('../middleware/upload');
const courseController = require('../controllers/courseController');
const categoryController = require('../controllers/categoryController');
const discountCodeController = require('../controllers/discountCodeController');
const { validateTeacherCourse } = require('../validators/courseValidator');
const { validateCategory } = require('../validators/categoryValidator');
const { validateDiscountCode } = require('../validators/discountCodeValidator');

// Teacher Dashboard
router.get('/dashboard', isTeacher, (req, res) => {
  res.render('pages/teacher/dashboard', {
    title: 'لوحة المدرس',
    layouts: 'teacher'
  });
});

// Teacher Courses CRUD
router.get('/courses', isTeacher, courseController.getTeacherCourses);
router.post('/courses', isTeacher, upload.single('image'), validateTeacherCourse, courseController.createTeacherCourse);
router.put('/courses/:id', isTeacher, upload.single('image'), validateTeacherCourse, courseController.updateTeacherCourse);
router.delete('/courses/:id', isTeacher, courseController.deleteTeacherCourse);

// Teacher Categories
router.get('/categories', isTeacher, categoryController.getTeacherCategories);
router.post('/categories', isTeacher, validateCategory, categoryController.createTeacherCategory);
// router.put('/categories/:id', isTeacher, categoryController.updateTeacherCategory);
// router.delete('/categories/:id', isTeacher, categoryController.deleteTeacherCategory);

// Teacher Discount Codes
router.get('/discount-codes', isInstructor, discountCodeController.getTeacherDiscountCodes);
router.post('/discount-codes', isInstructor, validateDiscountCode, discountCodeController.createTeacherDiscountCode);
router.put('/discount-codes/:id', isInstructor, validateDiscountCode, discountCodeController.updateTeacherDiscountCode);
router.delete('/discount-codes/:id', isInstructor, discountCodeController.deleteTeacherDiscountCode);

module.exports = router;
