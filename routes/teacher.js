const express = require('express');
const router = express.Router();
const { isTeacher } = require('../middleware/auth');
const upload = require('../middleware/upload');
const courseController = require('../controllers/courseController');
const categoryController = require('../controllers/categoryController');
const { validateTeacherCourse } = require('../validators/courseValidator');
const { validateCategory } = require('../validators/categoryValidator');

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

module.exports = router;
