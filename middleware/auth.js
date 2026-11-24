// Check if user is authenticated
const isAuthenticated = (req, res, next) => {
  if (req.session && req.session.userId) {
    return next();
  }
  req.session.error_msg = 'يجب تسجيل الدخول أولاً للوصول إلى هذه الصفحة';
  res.redirect('/login');
};

// Check if user is admin
const isAdmin = (req, res, next) => {
  if (req.session && req.session.userId && req.session.userRole === 'admin') {
    return next();
  }
  req.session.error_msg = 'غير مصرح لك بالوصول إلى لوحة التحكم';
  res.redirect('/login');
};

// Check if user is teacher
const isTeacher = (req, res, next) => {
  if (req.session && req.session.userId && (req.session.userRole === 'teacher' || req.session.userRole === 'admin')) {
    return next();
  }
  req.session.error_msg = 'غير مصرح لك بالوصول إلى لوحة المدرس';
  res.redirect('/login');
};

const isInstructor = (req, res, next) => {
  if (req.session && req.session.userId && req.session.userRole === 'teacher') {
    return next();
  }
  req.session.error_msg = 'هذه الصفحة متاحة للمدرسين فقط';
  res.redirect('/login');
};

// Make user available to all views
const setUser = (req, res, next) => {
  res.locals.user = req.session.userId ? {
    id: req.session.userId,
    fullName: req.session.userName,
    email: req.session.userEmail,
    profileImage: req.session.userProfileImage || '/images/default-avatar.svg',
    role: req.session.userRole,
    walletBalance: req.session.walletBalance || 0
  } : null;
  next();
};

module.exports = {
  isAuthenticated,
  isAdmin,
  isTeacher,
  isInstructor,
  setUser
};
