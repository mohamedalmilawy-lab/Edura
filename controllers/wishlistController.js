const Wishlist = require('../models/Wishlist');
const Course = require('../models/Course');
const ApiResponse = require('../utils/ApiResponse');

// GET /api/wishlist
exports.getWishlist = async (req, res) => {
  try {
    const wishlist = await Wishlist.findOne({ user: req.user.id })
      .populate({
        path: 'courses',
        populate: [
          { path: 'category', select: 'name' },
          { path: 'teacher', select: 'fullName bio profileImage' }
        ]
      });

    const courses = wishlist ? wishlist.courses : [];

    return ApiResponse.ok(res, 'تم جلب المفضلة بنجاح', {
      courses,
      count: courses.length
    });
  } catch (error) {
    console.error('Get wishlist error:', error);
    return ApiResponse.serverError(res, 'حدث خطأ أثناء تحميل المفضلة');
  }
};

// POST /api/wishlist/toggle/:courseId
exports.toggleWishlist = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user.id;

    const course = await Course.findById(courseId);
    if (!course) {
      return ApiResponse.notFound(res, 'الكورس غير موجود');
    }

    let wishlist = await Wishlist.findOne({ user: userId });
    if (!wishlist) {
      wishlist = new Wishlist({ user: userId, courses: [] });
    }

    const courseIndex = wishlist.courses.indexOf(courseId);
    let added = false;

    if (courseIndex > -1) {
      wishlist.courses.splice(courseIndex, 1);
    } else {
      wishlist.courses.push(courseId);
      added = true;
    }

    await wishlist.save();

    return ApiResponse.ok(
      res,
      added ? 'تم إضافة الكورس إلى المفضلة' : 'تم إزالة الكورس من المفضلة',
      { added, wishlistCount: wishlist.courses.length }
    );
  } catch (error) {
    console.error('Toggle wishlist error:', error);
    return ApiResponse.serverError(res, 'حدث خطأ أثناء تحديث المفضلة');
  }
};
