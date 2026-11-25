const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Order = require('../models/Order');
const ApiResponse = require('../utils/ApiResponse');
const fs = require('fs');
const path = require('path');

const DEFAULT_PROFILE_IMAGE = '/images/default-avatar.svg';

function getUploadedProfileImage(req) {
  if (req.file) return req.file;
  if (!req.files) return null;

  return req.files.profileImage?.[0]
    || req.files.avatar?.[0]
    || req.files.image?.[0]
    || null;
}

function deleteUploadedProfileImage(imageUrl) {
  if (!imageUrl || !imageUrl.startsWith('/uploads/')) return;

  const safePath = path.resolve(__dirname, '..', 'public', imageUrl.replace(/^\/+/, ''));
  const uploadsDir = path.resolve(__dirname, '..', 'public', 'uploads');
  if (!safePath.startsWith(uploadsDir + path.sep)) return;

  if (fs.existsSync(safePath)) {
    try {
      fs.unlinkSync(safePath);
    } catch (error) {
      console.error('Delete profile image error:', error);
    }
  }
}

// GET /api/users/teachers
exports.getTeachers = async (req, res) => {
  try {
    const teachers = await User.find({ role: 'teacher' })
      .select('fullName profileImage bio joinedAt')
      .sort({ fullName: 1 });

    return ApiResponse.ok(res, 'تم جلب المدرسين بنجاح', { teachers });
  } catch (error) {
    console.error('Get teachers error:', error);
    return ApiResponse.serverError(res, 'حدث خطأ أثناء تحميل المدرسين');
  }
};

// GET /api/users/profile
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (user && !user.profileImage) {
      user.profileImage = DEFAULT_PROFILE_IMAGE;
    }

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
  const uploadedImage = getUploadedProfileImage(req);

  try {
    const { fullName, email, bio } = req.body;

    // Check if email is taken by another user
    const existingUser = await User.findOne({ email, _id: { $ne: req.user.id } });
    if (existingUser) {
      if (uploadedImage) deleteUploadedProfileImage('/uploads/' + uploadedImage.filename);
      return ApiResponse.badRequest(res, 'البريد الإلكتروني مستخدم مسبقاً');
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      if (uploadedImage) deleteUploadedProfileImage('/uploads/' + uploadedImage.filename);
      return ApiResponse.notFound(res, 'المستخدم غير موجود');
    }

    const oldProfileImage = user.profileImage || DEFAULT_PROFILE_IMAGE;
    user.fullName = fullName;
    user.email = email;
    if (bio !== undefined) user.bio = bio;
    if (uploadedImage) {
      user.profileImage = '/uploads/' + uploadedImage.filename;
    } else if (!user.profileImage) {
      user.profileImage = DEFAULT_PROFILE_IMAGE;
    }
    await user.save();

    if (uploadedImage) deleteUploadedProfileImage(oldProfileImage);

    const updatedUser = await User.findById(req.user.id).select('-password');
    return ApiResponse.ok(res, uploadedImage
      ? 'تم تحديث الصورة الشخصية والمعلومات بنجاح'
      : 'تم تحديث المعلومات الشخصية بنجاح', { user: updatedUser });
  } catch (error) {
    if (uploadedImage) deleteUploadedProfileImage('/uploads/' + uploadedImage.filename);
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
    const { fullName, email, password, role, bio } = req.body;

    // Check if email exists
    const existing = await User.findOne({ email });
    if (existing) {
      req.session.error_msg = 'البريد الإلكتروني مستخدم مسبقاً';
      return res.redirect('/admin/users');
    }

    await User.create({ fullName, email, password, role: role || 'student', bio: bio || '' });
    req.flash('success_msg', 'تم إضافة المستخدم بنجاح');
    res.redirect('/admin/users');
  } catch (error) {
    console.error('Create user error:', error);
    req.session.error_msg = 'حدث خطأ أثناء إضافة المستخدم';
    res.redirect('/admin/users');
  }
};

// Admin: Update a user's editable profile fields
exports.updateAdminUserProfile = async (req, res) => {
  const uploadedImage = req.file;
  try {
    const { fullName, email, bio } = req.body;
    if (!fullName || fullName.trim().length < 3 || !email) {
      if (uploadedImage) deleteUploadedProfileImage('/uploads/' + uploadedImage.filename);
      req.session.error_msg = 'الاسم والبريد الإلكتروني مطلوبان';
      return res.redirect('/admin/users');
    }
    if (typeof bio === 'string' && bio.trim().length > 1000) {
      if (uploadedImage) deleteUploadedProfileImage('/uploads/' + uploadedImage.filename);
      req.session.error_msg = 'النبذة يجب ألا تتجاوز 1000 حرف';
      return res.redirect('/admin/users');
    }
    const user = await User.findById(req.params.id);
    if (!user) {
      if (uploadedImage) deleteUploadedProfileImage('/uploads/' + uploadedImage.filename);
      req.session.error_msg = 'المستخدم غير موجود';
      return res.redirect('/admin/users');
    }

    const existingUser = await User.findOne({ email, _id: { $ne: req.params.id } });
    if (existingUser) {
      if (uploadedImage) deleteUploadedProfileImage('/uploads/' + uploadedImage.filename);
      req.session.error_msg = 'البريد الإلكتروني مستخدم مسبقاً';
      return res.redirect('/admin/users');
    }

    user.fullName = fullName;
    user.email = email;
    user.bio = typeof bio === 'string' ? bio.trim() : '';
    if (uploadedImage) {
      const oldProfileImage = user.profileImage;
      user.profileImage = '/uploads/' + uploadedImage.filename;
      await user.save();
      deleteUploadedProfileImage(oldProfileImage);
    } else {
      await user.save();
    }

    req.flash('success_msg', 'تم تحديث بيانات المستخدم بنجاح');
    res.redirect('/admin/users');
  } catch (error) {
    if (uploadedImage) deleteUploadedProfileImage('/uploads/' + uploadedImage.filename);
    console.error('Update admin user profile error:', error);
    req.session.error_msg = 'حدث خطأ أثناء تحديث بيانات المستخدم';
    res.redirect('/admin/users');
  }
};

// Teacher: Get own profile
exports.getTeacherProfile = async (req, res) => {
  try {
    const teacher = await User.findById(req.session.userId).select('-password');
    if (!teacher) {
      req.session.error_msg = 'المستخدم غير موجود';
      return res.redirect('/teacher/dashboard');
    }

    res.render('pages/teacher/profile', {
      title: 'الملف الشخصي',
      teacher,
      layouts: 'teacher'
    });
  } catch (error) {
    console.error('Get teacher profile error:', error);
    req.session.error_msg = 'حدث خطأ أثناء تحميل الملف الشخصي';
    res.redirect('/teacher/dashboard');
  }
};

// Teacher: Update own profile
exports.updateTeacherProfile = async (req, res) => {
  const uploadedImage = req.file;
  try {
    const { fullName, email, bio } = req.body;
    if (!fullName || fullName.trim().length < 3 || !email) {
      if (uploadedImage) deleteUploadedProfileImage('/uploads/' + uploadedImage.filename);
      req.session.error_msg = 'الاسم والبريد الإلكتروني مطلوبان';
      return res.redirect('/teacher/profile');
    }
    if (typeof bio === 'string' && bio.trim().length > 1000) {
      if (uploadedImage) deleteUploadedProfileImage('/uploads/' + uploadedImage.filename);
      req.session.error_msg = 'النبذة يجب ألا تتجاوز 1000 حرف';
      return res.redirect('/teacher/profile');
    }
    const teacher = await User.findById(req.session.userId);
    if (!teacher) {
      if (uploadedImage) deleteUploadedProfileImage('/uploads/' + uploadedImage.filename);
      req.session.error_msg = 'المستخدم غير موجود';
      return res.redirect('/teacher/profile');
    }

    const existingUser = await User.findOne({ email, _id: { $ne: req.session.userId } });
    if (existingUser) {
      if (uploadedImage) deleteUploadedProfileImage('/uploads/' + uploadedImage.filename);
      req.session.error_msg = 'البريد الإلكتروني مستخدم مسبقاً';
      return res.redirect('/teacher/profile');
    }

    teacher.fullName = fullName;
    teacher.email = email;
    teacher.bio = typeof bio === 'string' ? bio.trim() : '';
    if (uploadedImage) {
      const oldProfileImage = teacher.profileImage;
      teacher.profileImage = '/uploads/' + uploadedImage.filename;
      await teacher.save();
      deleteUploadedProfileImage(oldProfileImage);
    } else {
      await teacher.save();
    }

    req.session.userName = teacher.fullName;
    req.session.userEmail = teacher.email;
    req.session.userProfileImage = teacher.profileImage || '/images/default-avatar.svg';
    req.flash('success_msg', 'تم تحديث الملف الشخصي بنجاح');
    res.redirect('/teacher/profile');
  } catch (error) {
    if (uploadedImage) deleteUploadedProfileImage('/uploads/' + uploadedImage.filename);
    console.error('Update teacher profile error:', error);
    req.session.error_msg = 'حدث خطأ أثناء تحديث الملف الشخصي';
    res.redirect('/teacher/profile');
  }
};

// Admin: Get own profile
exports.getAdminProfile = async (req, res) => {
  try {
    const admin = await User.findById(req.session.userId).select('-password');
    if (!admin) {
      req.session.error_msg = 'المستخدم غير موجود';
      return res.redirect('/admin/dashboard');
    }

    res.render('pages/admin/profile', {
      title: 'الملف الشخصي',
      admin,
      layouts: 'admin'
    });
  } catch (error) {
    console.error('Get admin profile error:', error);
    req.session.error_msg = 'حدث خطأ أثناء تحميل الملف الشخصي';
    res.redirect('/admin/dashboard');
  }
};

// Admin: Update own profile and image
exports.updateAdminProfile = async (req, res) => {
  const uploadedImage = req.file;
  try {
    const { fullName, email, bio } = req.body;
    if (!fullName || fullName.trim().length < 3 || !email) {
      if (uploadedImage) deleteUploadedProfileImage('/uploads/' + uploadedImage.filename);
      req.session.error_msg = 'الاسم والبريد الإلكتروني مطلوبان';
      return res.redirect('/admin/profile');
    }
    if (typeof bio === 'string' && bio.trim().length > 1000) {
      if (uploadedImage) deleteUploadedProfileImage('/uploads/' + uploadedImage.filename);
      req.session.error_msg = 'النبذة يجب ألا تتجاوز 1000 حرف';
      return res.redirect('/admin/profile');
    }

    const admin = await User.findById(req.session.userId);
    if (!admin) {
      if (uploadedImage) deleteUploadedProfileImage('/uploads/' + uploadedImage.filename);
      req.session.error_msg = 'المستخدم غير موجود';
      return res.redirect('/admin/profile');
    }

    const existingUser = await User.findOne({ email, _id: { $ne: req.session.userId } });
    if (existingUser) {
      if (uploadedImage) deleteUploadedProfileImage('/uploads/' + uploadedImage.filename);
      req.session.error_msg = 'البريد الإلكتروني مستخدم مسبقاً';
      return res.redirect('/admin/profile');
    }

    admin.fullName = fullName;
    admin.email = email;
    admin.bio = typeof bio === 'string' ? bio.trim() : '';
    if (uploadedImage) {
      const oldProfileImage = admin.profileImage;
      admin.profileImage = '/uploads/' + uploadedImage.filename;
      await admin.save();
      deleteUploadedProfileImage(oldProfileImage);
    } else {
      await admin.save();
    }

    req.session.userName = admin.fullName;
    req.session.userEmail = admin.email;
    req.session.userProfileImage = admin.profileImage || '/images/default-avatar.svg';
    req.flash('success_msg', 'تم تحديث الملف الشخصي بنجاح');
    res.redirect('/admin/profile');
  } catch (error) {
    if (uploadedImage) deleteUploadedProfileImage('/uploads/' + uploadedImage.filename);
    console.error('Update admin profile error:', error);
    req.session.error_msg = 'حدث خطأ أثناء تحديث الملف الشخصي';
    res.redirect('/admin/profile');
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
    const amount = Number(req.body.amount);
    const description = typeof req.body.description === 'string'
      ? req.body.description.trim()
      : '';
    const userId = req.params.id;

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ success: false, message: 'المبلغ غير صالح' });
    }
    if (!description || description.length > 500) {
      return res.status(400).json({ success: false, message: 'وصف الشحن مطلوب ويجب ألا يتجاوز 500 حرف' });
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
      amount,
      description
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
