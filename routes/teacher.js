const express = require('express');
const router = express.Router();
const { isTeacher, isInstructor } = require('../middleware/auth');
const upload = require('../middleware/upload');
const courseController = require('../controllers/courseController');
const categoryController = require('../controllers/categoryController');
const discountCodeController = require('../controllers/discountCodeController');
const userController = require('../controllers/userController');
const { validateTeacherCourse } = require('../validators/courseValidator');
const { validateCategory } = require('../validators/categoryValidator');
const { validateDiscountCode } = require('../validators/discountCodeValidator');
const courseUpload = upload.pdfUpload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'pdfs', maxCount: 10 }
]);

const Course = require('../models/Course');
const DiscountCode = require('../models/DiscountCode');
const User = require('../models/User');

// Teacher Dashboard
router.get('/dashboard', isTeacher, async (req, res) => {
  try {
    const teacher = await User.findById(req.session.userId).select('-password');
    const [totalCourses, availableCourses, discountCodes] = await Promise.all([
      Course.countDocuments({ teacher: req.session.userId }),
      Course.countDocuments({ teacher: req.session.userId, status: 'available' }),
      DiscountCode.countDocuments({ createdBy: req.session.userId })
    ]);

    res.render('pages/teacher/dashboard', {
      title: 'لوحة المدرس',
      layouts: 'teacher',
      teacher,
      stats: { totalCourses, availableCourses, discountCodes }
    });
  } catch (error) {
    console.error('Teacher dashboard error:', error);
    req.session.error_msg = 'حدث خطأ أثناء تحميل لوحة المدرس';
    res.redirect('/teacher/profile');
  }
});

// Teacher Profile
router.get('/profile', isTeacher, userController.getTeacherProfile);
router.put('/profile', isTeacher, upload.single('profileImage'), userController.updateTeacherProfile);

// Teacher Courses CRUD
router.get('/courses', isTeacher, courseController.getTeacherCourses);
router.post('/courses', isTeacher, courseUpload, validateTeacherCourse, courseController.createTeacherCourse);
router.put('/courses/:id', isTeacher, courseUpload, validateTeacherCourse, courseController.updateTeacherCourse);
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
