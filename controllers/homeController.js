const Course = require('../models/Course');
const Category = require('../models/Category');
const Comment = require('../models/Comment');
const User = require('../models/User');
const Order = require('../models/Order');
const ApiResponse = require('../utils/ApiResponse');

// GET /api/home
exports.getHome = async (req, res) => {
  try {
    // Get latest 8 courses
    const latestCourses = await Course.find({ status: 'available' })
      .populate('category', 'name')
      .populate('teacher', 'fullName')
      .sort({ createdAt: -1 })
      .limit(8);

    // Get all categories
    const allCategories = await Category.find().sort({ name: 1 });

    // Get comments for each course
    const courseIds = latestCourses.map(c => c._id);
    const allComments = await Comment.find({ course: { $in: courseIds } })
      .populate('user', 'fullName')
      .sort({ createdAt: -1 });

    const commentsByCourse = {};
    allComments.forEach(comment => {
      const courseId = comment.course.toString();
      if (!commentsByCourse[courseId]) commentsByCourse[courseId] = [];
      commentsByCourse[courseId].push(comment);
    });

    // Get stats
    const courseCount = await Course.countDocuments({ status: 'available' });
    const userCount = await User.countDocuments();
    const categoryCount = await Category.countDocuments();
    const orderCount = await Order.countDocuments();

    return ApiResponse.ok(res, 'تم جلب بيانات الصفحة الرئيسية بنجاح', {
      latestCourses,
      categories: allCategories,
      commentsByCourse,
      stats: {
        courses: courseCount,
        users: userCount,
        categories: categoryCount,
        orders: orderCount
      }
    });
  } catch (error) {
    console.error('Home route error:', error);
    return ApiResponse.serverError(res, 'حدث خطأ أثناء تحميل الصفحة الرئيسية');
  }
};
