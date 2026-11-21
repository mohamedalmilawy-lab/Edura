const Cart = require('../models/Cart');
const Course = require('../models/Course');
const ApiResponse = require('../utils/ApiResponse');
const DiscountCode = require('../models/DiscountCode');
const { calculateDiscount, isCodeUsable } = require('./discountCodeController');

const buildCartSummary = async (cart) => {
  const populatedCart = cart
    ? await Cart.findById(cart._id).populate('courses').populate('discountCode')
    : null;
  const courses = populatedCart ? populatedCart.courses : [];
  const subtotal = courses.reduce((sum, course) => sum + Number(course.effectivePrice || course.price || 0), 0);
  const code = populatedCart && populatedCart.discountCode ? populatedCart.discountCode : null;

  let discountAmount = 0;
  if (code && isCodeUsable(code)) {
    discountAmount = calculateDiscount(code, courses).discountAmount;
  }

  return {
    courses,
    subtotal: Math.round(subtotal * 100) / 100,
    discountAmount,
    total: Math.round((subtotal - discountAmount) * 100) / 100,
    count: courses.length,
    discountCode: code && isCodeUsable(code) ? code.code : null
  };
};

// GET /api/cart
exports.getCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user.id })
      .populate({
        path: 'courses',
        populate: { path: 'category', select: 'name' }
      });
    const summary = await buildCartSummary(cart);
    return ApiResponse.ok(res, 'تم جلب السلة بنجاح', summary);
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
    if (!cart) {
      return ApiResponse.notFound(res, 'السلة غير موجودة');
    }
    if (cart.courses.includes(courseId)) {
      cart.courses = cart.courses.filter(c => c.toString() !== courseId);
      await cart.save();
    }
    else {
      return ApiResponse.notFound(res, 'الكورس غير موجود في السلة');
    }
    
    const summary = await buildCartSummary(cart);
    return ApiResponse.ok(res, 'تم إزالة الكورس من السلة', summary);
  } catch (error) {
    console.error('Remove from cart error:', error);
    return ApiResponse.serverError(res, 'حدث خطأ أثناء الإزالة من السلة');
  }
};

// POST /api/cart/apply-discount
exports.applyDiscount = async (req, res) => {
  try {
    const codeValue = (req.body.code || '').toString().trim().toUpperCase();
    if (!codeValue) {
      return ApiResponse.badRequest(res, 'كود الخصم مطلوب');
    }

    const code = await DiscountCode.findOne({ code: codeValue });
    if (!code || !isCodeUsable(code)) {
      return ApiResponse.badRequest(res, 'كود الخصم غير صالح أو منتهي أو تم استنفاده');
    }

    let cart = await Cart.findOne({ user: req.user.id }).populate('courses');
    if (!cart || cart.courses.length === 0) {
      return ApiResponse.badRequest(res, 'السلة فارغة');
    }

    const calculation = calculateDiscount(code, cart.courses);
    if (calculation.eligibleCourses.length === 0 || calculation.discountAmount <= 0) {
      return ApiResponse.badRequest(res, 'كود الخصم لا ينطبق على الكورسات الموجودة في السلة');
    }

    cart.discountCode = code._id;
    await cart.save();

    const summary = await buildCartSummary(cart);
    return ApiResponse.ok(res, 'تم تطبيق كود الخصم بنجاح', summary);
  } catch (error) {
    console.error('Apply discount error:', error);
    return ApiResponse.serverError(res, 'حدث خطأ أثناء تطبيق كود الخصم');
  }
};

// DELETE /api/cart/remove-discount
exports.removeDiscount = async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user.id });
    if (!cart) {
      return ApiResponse.notFound(res, 'السلة غير موجودة');
    }

    cart.discountCode = null;
    await cart.save();

    const summary = await buildCartSummary(cart);
    return ApiResponse.ok(res, 'تم إزالة كود الخصم بنجاح', summary);
  } catch (error) {
    console.error('Remove discount error:', error);
    return ApiResponse.serverError(res, 'حدث خطأ أثناء إزالة كود الخصم');
  }
};
