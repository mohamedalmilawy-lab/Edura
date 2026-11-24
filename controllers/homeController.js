const Course = require('../models/Course');
const Category = require('../models/Category');
const Comment = require('../models/Comment');
const User = require('../models/User');
const Order = require('../models/Order');
const Wishlist = require('../models/Wishlist');
const Cart = require('../models/Cart');
const ApiResponse = require('../utils/ApiResponse');

// GET /api/home
exports.getHome = async (req, res) => {
  try {
    // Get latest 8 courses
    const latestCourses = await Course.find({ status: 'available' })
      .populate('category', 'name')
      .populate('teacher', 'fullName bio profileImage')
      .sort({ createdAt: -1 })
      .limit(8);

    // Get the 8 most popular available courses by enrolled student count
    const popularCourses = await Course.find({ status: 'available' })
      .populate('category', 'name')
      .populate('teacher', 'fullName bio profileImage')
      .sort({ enrolledCount: -1, createdAt: -1 })
      .limit(8);

    const excludedCourseIds = [];
    const preferredCategories = [];
    const preferredTeachers = [];

    if (req.user) {
      const [orders, wishlist, cart] = await Promise.all([
        Order.find({ user: req.user.id, status: 'confirmed' }).select('courses'),
        Wishlist.findOne({ user: req.user.id }).select('courses'),
        Cart.findOne({ user: req.user.id }).select('courses')
      ]);

      orders.forEach(order => excludedCourseIds.push(...order.courses));
      if (wishlist) excludedCourseIds.push(...wishlist.courses);
      if (cart) excludedCourseIds.push(...cart.courses);

      if (excludedCourseIds.length > 0) {
        const profileCourses = await Course.find({ _id: { $in: excludedCourseIds } })
          .select('category teacher');
        profileCourses.forEach(course => {
          preferredCategories.push(course.category);
          preferredTeachers.push(course.teacher);
        });
      }
    }

    const recommendationQuery = { status: 'available' };
    if (excludedCourseIds.length > 0) {
      recommendationQuery._id = { $nin: excludedCourseIds };
    }

    const preferenceFilters = [];
    if (preferredCategories.length > 0) {
      preferenceFilters.push({ category: { $in: preferredCategories } });
    }
    if (preferredTeachers.length > 0) {
      preferenceFilters.push({ teacher: { $in: preferredTeachers } });
    }
    if (preferenceFilters.length > 0) {
      recommendationQuery.$or = preferenceFilters;
    }

    let recommendedCourses = await Course.find(recommendationQuery)
      .populate('category', 'name')
      .populate('teacher', 'fullName bio profileImage')
      .sort({ enrolledCount: -1, createdAt: -1 })
      .limit(8);

    if (recommendedCourses.length < 8) {
      const existingIds = [
        ...excludedCourseIds,
        ...recommendedCourses.map(course => course._id)
      ];
      const fallbackCourses = await Course.find({
        status: 'available',
        _id: { $nin: existingIds }
      })
        .populate('category', 'name')
        .populate('teacher', 'fullName bio profileImage')
        .sort({ enrolledCount: -1, createdAt: -1 })
        .limit(8 - recommendedCourses.length);
      recommendedCourses.push(...fallbackCourses);
    }

    // Get all categories
    const allCategories = await Category.find().sort({ name: 1 });

    // Get comments for latest and popular courses
    const courseIds = [...new Map(
      [...latestCourses, ...popularCourses, ...recommendedCourses].map(course => [course._id.toString(), course._id])
    ).values()];
    const allComments = await Comment.find({ course: { $in: courseIds } })
      .populate('user', 'fullName')
      .sort({ createdAt: -1 });

    const commentsByCourse = {};
    allComments.forEach(comment => {
      const courseId = comment.course.toString();
      if (!commentsByCourse[courseId]) commentsByCourse[courseId] = [];
      commentsByCourse[courseId].push(comment);
    });
    const ratingSummaries = await Comment.getRatingSummaries(courseIds);

    // Get stats
    const courseCount = await Course.countDocuments({ status: 'available' });
    const userCount = await User.countDocuments();
    const categoryCount = await Category.countDocuments();
    const orderCount = await Order.countDocuments();

    return ApiResponse.ok(res, 'تم جلب بيانات الصفحة الرئيسية بنجاح', {
      latestCourses,
      popularCourses,
      recommendedCourses,
      categories: allCategories,
      commentsByCourse,
      ratingSummaries,
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
