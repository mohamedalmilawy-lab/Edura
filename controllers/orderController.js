const Order = require('../models/Order');
const Cart = require('../models/Cart');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Course = require('../models/Course');
const Comment = require('../models/Comment');
const ApiResponse = require('../utils/ApiResponse');
const DiscountCode = require('../models/DiscountCode');
const { calculateDiscount, isCodeUsable } = require('./discountCodeController');

// GET /api/orders - User's confirmed orders
exports.getOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user.id, status: 'confirmed' })
      .populate({
        path: 'courses',
        populate: [
          { path: 'category', select: 'name' },
          { path: 'teacher', select: 'fullName' }
        ]
      })
      .sort({ createdAt: -1 });

    return ApiResponse.ok(res, 'تم جلب الطلبات بنجاح', { orders });
  } catch (error) {
    console.error('Get orders error:', error);
    return ApiResponse.serverError(res, 'حدث خطأ أثناء تحميل الطلبات');
  }
};

// GET /api/orders/:id - Course content (order detail)
exports.getCourseById = async (req, res) => {
  try {
    const course = await Course.findOne({ _id: req.params.id }).populate('category', 'name').populate('teacher', 'fullName');

    if (!course) {
      return ApiResponse.notFound(res, 'الكورس غير موجود');
    }

    let hasAccess = false;
    // Check access (admin, teacher, or purchased)
    if (req.user.role === 'admin' || course.teacher._id.toString() === req.user.id.toString()) {
      hasAccess = true;
    } else {
      const order = await Order.findOne({
        user: req.user.id,
        status: 'confirmed',
        courses: course._id
      });
      if (order) hasAccess = true;
    }

    // Get comments
    const comments = await Comment.find({ course: course._id })
      .populate('user', 'fullName')
      .sort({ createdAt: -1 });

    return ApiResponse.ok(res, 'تم جلب محتوى الكورس بنجاح', {
      course,
      hasAccess,
      comments
    });
  } catch (error) {
    console.error('Get order detail error:', error);
    return ApiResponse.serverError(res, 'حدث خطأ أثناء تحميل محتوى الكورس');
  }
};


// POST /api/orders/confirm - Confirm order from cart
exports.confirmOrder = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get cart
    const cart = await Cart.findOne({ user: userId })
      .populate('courses')
      .populate('discountCode');
    if (!cart || cart.courses.length === 0) {
      return ApiResponse.badRequest(res, 'السلة فارغة');
    }

    const subtotal = cart.courses.reduce((sum, course) => sum + Number(course.effectivePrice || course.price || 0), 0);
    let discountAmount = 0;
    let discountCodeName = null;

    if (cart.discountCode) {
      const code = await DiscountCode.findById(cart.discountCode._id);
      if (!code || !isCodeUsable(code)) {
        return ApiResponse.badRequest(res, 'كود الخصم لم يعد صالحاً');
      }
      const calculation = calculateDiscount(code, cart.courses);
      if (calculation.eligibleCourses.length === 0) {
        return ApiResponse.badRequest(res, 'كود الخصم لا ينطبق على الكورسات الموجودة في السلة');
      }
      discountAmount = calculation.discountAmount;
      discountCodeName = code.code;
    }

    const totalPrice = Math.round((subtotal - discountAmount) * 100) / 100;

    // Check wallet balance
    const user = await User.findById(userId);
    if (user.walletBalance < totalPrice) {
      return ApiResponse.badRequest(
        res,
        `رصيد المحفظة غير كافي. رصيدك: ${user.walletBalance} د.م.، المطلوب: ${totalPrice} د.م.`,
        { walletBalance: user.walletBalance, totalPrice }
      );
    }

    if (cart.discountCode) {
      const code = await DiscountCode.findOneAndUpdate(
        {
          _id: cart.discountCode._id,
          isActive: true,
          $and: [
            { $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] },
            { $or: [{ maxUses: null }, { $expr: { $lt: ['$usedCount', '$maxUses'] } }] }
          ]
        },
        { $inc: { usedCount: 1 } },
        { new: true }
      );
      if (!code) {
        return ApiResponse.badRequest(res, 'تم استنفاد كود الخصم قبل إتمام الطلب');
      }
    }

    // Deduct from wallet
    user.walletBalance -= totalPrice;
    await user.save();

    // Create order
    const orderCount = await Order.countDocuments();
    const order = new Order({
      orderNumber: `ORD-${Date.now()}-${String(orderCount + 1).padStart(4, '0')}`,
      user: userId,
      courses: cart.courses.map(c => c._id),
      totalPrice,
      discountCode: discountCodeName,
      discountAmount,
      status: 'confirmed'
    });
    await order.save();

    // Create transaction
    await Transaction.create({
      user: userId,
      type: 'purchase',
      amount: -totalPrice,
      description: `شراء كورسات - طلب #${order.orderNumber}`,
      order: order._id
    });

    // Increment enrolled count for courses
    for (const course of cart.courses) {
      await Course.findByIdAndUpdate(course._id, { $inc: { enrolledCount: 1 } });
    }

    // Clear cart
    cart.courses = [];
    cart.discountCode = null;
    await cart.save();

    return ApiResponse.created(res, `تم تأكيد الطلب بنجاح! رقم الطلب: ${order.orderNumber}`, {
      order,
      walletBalance: user.walletBalance
    });
  } catch (error) {
    console.error('Confirm order error:', error);
    return ApiResponse.serverError(res, 'حدث خطأ أثناء تأكيد الطلب');
  }
};

// Admin: Get all orders
exports.getAdminOrders = async (req, res) => {
  try {
    const orders = await Order.find()
      .populate('user', 'fullName email')
      .populate({
        path: 'courses',
        populate: { path: 'category', select: 'name' }
      })
      .sort({ createdAt: -1 });

    res.render('pages/admin/orders', {
      title: 'إدارة الطلبات',
      orders,
      layouts: 'admin'
    });
  } catch (error) {
    console.error('Admin orders error:', error);
    req.session.error_msg = 'حدث خطأ أثناء تحميل الطلبات';
    res.redirect('/admin/dashboard');
  }
};

// Admin: Get order detail
exports.getAdminOrderDetail = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('user', 'fullName email')
      .populate({
        path: 'courses',
        populate: [
          { path: 'category', select: 'name' },
          { path: 'teacher', select: 'fullName' }
        ]
      });

    if (!order) {
      return res.status(404).json({ success: false, message: 'الطلب غير موجود' });
    }

    res.json({ success: true, order });
  } catch (error) {
    console.error('Order detail error:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ' });
  }
};

// Admin: Update order status
exports.updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!order) {
      req.session.error_msg = 'الطلب غير موجود';
      return res.redirect('/admin/orders');
    }

    req.flash('success_msg', 'تم تحديث حالة الطلب بنجاح');
    res.redirect('/admin/orders');
  } catch (error) {
    console.error('Update order error:', error);
    req.session.error_msg = 'حدث خطأ أثناء تحديث الطلب';
    res.redirect('/admin/orders');
  }
};

// Admin: Delete order
exports.deleteOrder = async (req, res) => {
  try {
    await Order.findByIdAndDelete(req.params.id);
    req.flash('success_msg', 'تم حذف الطلب بنجاح');
    res.redirect('/admin/orders');
  } catch (error) {
    console.error('Delete order error:', error);
    req.session.error_msg = 'حدث خطأ أثناء حذف الطلب';
    res.redirect('/admin/orders');
  }
};
