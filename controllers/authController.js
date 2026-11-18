const User = require('../models/User');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const asyncHandler = require('express-async-handler');
const ApiResponse = require('../utils/ApiResponse');
const { signToken } = require('../middleware/apiAuth');

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard (session based) authentication – used only by the admin/teacher panels
// ─────────────────────────────────────────────────────────────────────────────

const dashboardUrlForRole = (role) => {
  if (role === 'admin') return '/admin/dashboard';
  if (role === 'teacher') return '/teacher/dashboard';
  return '/';
};

// GET /login - Show the dashboard login page
exports.getLogin = (req, res) => {
  if (req.session.userId) {
    return res.redirect(dashboardUrlForRole(req.session.userRole));
  }
  res.render('pages/login', {
    title: 'تسجيل الدخول',
    errors: []
  });
};

// POST /login - Session login for the dashboards
exports.postLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.render('pages/login', {
        title: 'تسجيل الدخول',
        errors: ['البريد الإلكتروني أو كلمة السر غير صحيحة'],
        email
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.render('pages/login', {
        title: 'تسجيل الدخول',
        errors: ['البريد الإلكتروني أو كلمة السر غير صحيحة'],
        email
      });
    }

    req.session.userId = user._id;
    req.session.userName = user.fullName;
    req.session.userEmail = user.email;
    req.session.userRole = user.role;
    req.session.walletBalance = user.walletBalance;

    req.flash('success_msg', `مرحباً بك ${user.fullName}! تم تسجيل الدخول بنجاح`);
    res.redirect(dashboardUrlForRole(user.role));
  } catch (error) {
    console.error('Login error:', error);
    res.render('pages/login', {
      title: 'تسجيل الدخول',
      errors: ['حدث خطأ أثناء تسجيل الدخول، يرجى المحاولة مرة أخرى'],
      email: req.body.email
    });
  }
};

// GET /logout - Session logout for the dashboards
exports.logout = (req, res) => {
  res.clearCookie('connect.sid');
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
    }
    req.session = null;
    res.redirect('/login');
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// Public JSON API authentication (JWT)
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/auth/register
exports.apiRegister = async (req, res) => {
  try {
    const { fullName, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return ApiResponse.badRequest(res, 'البريد الإلكتروني مستخدم مسبقاً');
    }

    const user = await User.create({ fullName, email, password });
    const token = signToken(user);

    return ApiResponse.created(res, 'تم إنشاء الحساب بنجاح', {
      token,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        walletBalance: user.walletBalance
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    return ApiResponse.serverError(res, 'حدث خطأ أثناء إنشاء الحساب، يرجى المحاولة مرة أخرى');
  }
};

// POST /api/auth/login
exports.apiLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return ApiResponse.unauthorized(res, 'البريد الإلكتروني أو كلمة السر غير صحيحة');
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return ApiResponse.unauthorized(res, 'البريد الإلكتروني أو كلمة السر غير صحيحة');
    }

    const token = signToken(user);

    return ApiResponse.ok(res, `مرحباً بك ${user.fullName}! تم تسجيل الدخول بنجاح`, {
      token,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        walletBalance: user.walletBalance
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return ApiResponse.serverError(res, 'حدث خطأ أثناء تسجيل الدخول، يرجى المحاولة مرة أخرى');
  }
};

// POST /api/auth/logout  (يرفع tokenVersion لإبطال كل الرموز الصادرة سابقاً)
exports.apiLogout = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(req.user.id, { $inc: { tokenVersion: 1 } });
  return ApiResponse.ok(res, 'تم تسجيل الخروج بنجاح');
});

// GET /api/auth/me
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return ApiResponse.notFound(res, 'المستخدم غير موجود');
    }
    return ApiResponse.ok(res, 'تم جلب بيانات المستخدم بنجاح', { user });
  } catch (error) {
    console.error('Get me error:', error);
    return ApiResponse.serverError(res, 'حدث خطأ أثناء جلب بيانات المستخدم');
  }
};

// POST /api/auth/forgot-password
exports.apiForgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return ApiResponse.notFound(res, 'لم يتم العثور على حساب بهذا البريد الإلكتروني');
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    const resetUrl = `http://${req.get('host')}/reset-password/${user._id}/${resetToken}`;

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD
      }
    });

    const mailOptions = {
      from: process.env.EMAIL_USERNAME,
      to: user.email,
      subject: 'Reset Password',
      html: `<p>Click <a href="${resetUrl}">here</a> to reset your password</p>`
    };

    try {
      await transporter.sendMail(mailOptions);
      return ApiResponse.ok(res, 'تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني');
    } catch (emailError) {
      console.error('Email sending error:', emailError);
      return ApiResponse.ok(res, 'تم إنشاء رابط إعادة التعيين (تعذّر إرسال البريد الإلكتروني)', { resetUrl });
    }
  } catch (error) {
    console.error('Forgot password error:', error);
    return ApiResponse.serverError(res, 'حدث خطأ أثناء محاولة إستعادة كلمة المرور');
  }
};

// POST /api/auth/reset-password/:id/:token
exports.apiResetPassword = async (req, res) => {
  try {
    const { id, token } = req.params;
    const { password } = req.body;

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      _id: id,
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return ApiResponse.badRequest(res, 'الرابط غير صالح أو منتهي الصلاحية');
    }

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    return ApiResponse.ok(res, 'تم إعادة تعيين كلمة المرور بنجاح! يمكنك الآن تسجيل الدخول');
  } catch (error) {
    console.error('Reset password error:', error);
    return ApiResponse.serverError(res, 'حدث خطأ أثناء إعادة تعيين كلمة المرور');
  }
};
