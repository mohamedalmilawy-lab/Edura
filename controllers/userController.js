const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Order = require('../models/Order');
const ApiResponse = require('../utils/ApiResponse');

// GET /api/users/profile
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');

    // Get order count
    const orderCount = await Order.countDocuments({ user: req.user.id });

    return ApiResponse.ok(res, 'تم جلب الملف الشخصي بنجاح', { user, orderCount });
  } catch (error) {
    console.error('Get profile error:', error);
    return ApiResponse.serverError(res, 'حدث خطأ أثناء تحميل الملف الشخصي');
  }
};

// PUT /api/users/profile
exports.updateProfile = async (req, res) => {
  try {
    const { fullName, email } = req.body;

    // Check if email is taken by another user
    const existingUser = await User.findOne({ email, _id: { $ne: req.user.id } });
    if (existingUser) {
      return ApiResponse.badRequest(res, 'البريد الإلكتروني مستخدم مسبقاً');
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { fullName, email },
      { new: true }
    ).select('-password');

    return ApiResponse.ok(res, 'تم تحديث المعلومات الشخصية بنجاح', { user });
  } catch (error) {
    console.error('Update profile error:', error);
    return ApiResponse.serverError(res, 'حدث خطأ أثناء تحديث الملف الشخصي');
  }
};

// PUT /api/users/profile/password
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user.id);
    const isMatch = await user.comparePassword(currentPassword);

    if (!isMatch) {
      return ApiResponse.badRequest(res, 'كلمة السر الحالية غير صحيحة');
    }

    user.password = newPassword;
    await user.save();

    return ApiResponse.ok(res, 'تم تغيير كلمة السر بنجاح');
  } catch (error) {
    console.error('Change password error:', error);
    return ApiResponse.serverError(res, 'حدث خطأ أثناء تغيير كلمة السر');
  }
};

// GET /api/users/wallet
exports.getWallet = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('walletBalance fullName');
    const transactions = await Transaction.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .limit(50);

    return ApiResponse.ok(res, 'تم جلب المحفظة بنجاح', { user, transactions });
  } catch (error) {
    console.error('Get wallet error:', error);
    return ApiResponse.serverError(res, 'حدث خطأ أثناء تحميل المحفظة');
  }
};

// Admin: Get all users
exports.getAdminUsers = async (req, res) => {
  try {
    const { search } = req.query;
    const query = {};

    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(query)
      .select('-password')
      .sort({ joinedAt: -1 });

    // Get stats
    const stats = {
      total: await User.countDocuments(),
      students: await User.countDocuments({ role: 'student' }),
      teachers: await User.countDocuments({ role: 'teacher' }),
      admins: await User.countDocuments({ role: 'admin' })
    };

    res.render('pages/admin/users', {
      title: 'إدارة المستخدمين',
      users,
      stats,
      search: search || '',
      layouts: 'admin'
    });
  } catch (error) {
    console.error('Admin users error:', error);
    req.session.error_msg = 'حدث خطأ أثناء تحميل المستخدمين';
    res.redirect('/admin/dashboard');
  }
};

// Admin: Create user
exports.createUser = async (req, res) => {
  try {
    const { fullName, email, password, role } = req.body;

    // Check if email exists
    const existing = await User.findOne({ email });
    if (existing) {
      req.session.error_msg = 'البريد الإلكتروني مستخدم مسبقاً';
      return res.redirect('/admin/users');
    }

    await User.create({ fullName, email, password, role: role || 'student' });
    req.flash('success_msg', 'تم إضافة المستخدم بنجاح');
    res.redirect('/admin/users');
  } catch (error) {
    console.error('Create user error:', error);
    req.session.error_msg = 'حدث خطأ أثناء إضافة المستخدم';
    res.redirect('/admin/users');
  }
};

// Admin: Update user role
exports.updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
    }

    res.json({ success: true, message: 'تم تحديث الدور بنجاح' });
  } catch (error) {
    console.error('Update role error:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ' });
  }
};

// Admin: Recharge wallet
exports.rechargeWallet = async (req, res) => {
  try {
    const { amount } = req.body;
    const userId = req.params.id;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'المبلغ غير صالح' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
    }

    user.walletBalance += parseFloat(amount);
    await user.save();

    // Create transaction record
    await Transaction.create({
      user: userId,
      type: 'recharge',
      amount: parseFloat(amount),
      description: 'شحن رصيد من قبل الإدارة'
    });

    res.json({ success: true, message: `تم شحن ${amount} ل.س بنجاح`, newBalance: user.walletBalance });
  } catch (error) {
    console.error('Recharge error:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ أثناء الشحن' });
  }
};

// Admin: Delete user
exports.deleteUser = async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    req.flash('success_msg', 'تم حذف المستخدم بنجاح');
    res.redirect('/admin/users');
  } catch (error) {
    console.error('Delete user error:', error);
    req.session.error_msg = 'حدث خطأ أثناء حذف المستخدم';
    res.redirect('/admin/users');
  }
};
