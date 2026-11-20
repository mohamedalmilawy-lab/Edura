const Cart = require('../models/Cart');
const Course = require('../models/Course');
const ApiResponse = require('../utils/ApiResponse');

// GET /api/cart
exports.getCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user.id })
      .populate({
        path: 'courses',
        populate: { path: 'category', select: 'name' }
      });

    const courses = cart ? cart.courses : [];
    const total = courses.reduce((sum, course) => sum + course.effectivePrice, 0);

    return ApiResponse.ok(res, 'تم جلب السلة بنجاح', {
      courses,
      total,
      count: courses.length
    });
  } catch (error) {
    console.error('Get cart error:', error);
    return ApiResponse.serverError(res, 'حدث خطأ أثناء تحميل السلة');
  }
};

// POST /api/cart/add/:courseId
exports.addToCart = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user.id;

    const course = await Course.findById(courseId);
    if (!course || course.status !== 'available') {
      return ApiResponse.notFound(res, 'الكورس غير متاح');
    }

    let cart = await Cart.findOne({ user: userId });
    if (!cart) {
      cart = new Cart({ user: userId, courses: [] });
    }

    if (cart.courses.includes(courseId)) {
      return ApiResponse.badRequest(res, 'الكورس موجود في السلة مسبقاً', {
        cartCount: cart.courses.length
      });
    }

    cart.courses.push(courseId);
    await cart.save();

    return ApiResponse.ok(res, 'تم إضافة الكورس إلى السلة', {
      cartCount: cart.courses.length
    });
  } catch (error) {
    console.error('Add to cart error:', error);
    return ApiResponse.serverError(res, 'حدث خطأ أثناء الإضافة إلى السلة');
  }
};

// DELETE /api/cart/remove/:courseId
exports.removeFromCart = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user.id;

    const cart = await Cart.findOne({ user: userId });
    if (cart.courses.includes(courseId)) {
      cart.courses = cart.courses.filter(c => c.toString() !== courseId);
      await cart.save();
    }
    else {
      return ApiResponse.notFound(res, 'الكورس غير موجود في السلة');
    }
    
    const updatedCart = await Cart.findOne({ user: userId }).populate('courses');
    const total = updatedCart ? updatedCart.courses.reduce((sum, c) => sum + c.effectivePrice, 0) : 0;

    return ApiResponse.ok(res, 'تم إزالة الكورس من السلة', {
      total,
      cartCount: updatedCart ? updatedCart.courses.length : 0
    });
  } catch (error) {
    console.error('Remove from cart error:', error);
    return ApiResponse.serverError(res, 'حدث خطأ أثناء الإزالة من السلة');
  }
};
