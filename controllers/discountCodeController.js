const DiscountCode = require('../models/DiscountCode');
const Course = require('../models/Course');

const normalizeIds = (value) => {
  if (!value) return [];
  return (Array.isArray(value) ? value : [value])
    .map(id => id.toString())
    .filter((id, index, ids) => ids.indexOf(id) === index);
};

const parseMaxUses = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const parseIsActive = (value) => {
  const values = Array.isArray(value) ? value : [value];
  return values.includes('on') || values.includes('true') || value === true;
};

const parseExpiresAt = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const validateDiscountValue = (discountType, discountValue) => {
  if (discountType === 'percentage' && (discountValue <= 0 || discountValue > 100)) {
    return 'نسبة الخصم يجب أن تكون بين 0.01 و100';
  }
  if (discountType === 'fixed' && discountValue <= 0) {
    return 'قيمة الخصم الثابتة يجب أن تكون أكبر من صفر';
  }
  return null;
};

const calculateDiscount = (code, courses) => {
  const eligibleCourses = code.courses.length === 0
    ? courses
    : courses.filter(course => code.courses.some(id => id.toString() === course._id.toString()));

  const eligibleSubtotal = eligibleCourses.reduce((sum, course) => {
    return sum + Number(course.effectivePrice || course.price || 0);
  }, 0);

  if (eligibleSubtotal <= 0) return { discountAmount: 0, eligibleSubtotal, eligibleCourses };

  let discountAmount = code.discountType === 'percentage'
    ? eligibleSubtotal * (Number(code.discountValue) / 100)
    : Number(code.discountValue);

  discountAmount = Math.min(discountAmount, eligibleSubtotal);
  discountAmount = Math.round(discountAmount * 100) / 100;

  return { discountAmount, eligibleSubtotal, eligibleCourses };
};

const isCodeUsable = (code) => {
  if (!code || !code.isActive) return false;
  if (code.expiresAt && code.expiresAt <= new Date()) return false;
  if (code.maxUses !== null && code.usedCount >= code.maxUses) return false;
  return true;
};

// Admin: discount codes page
exports.getAdminDiscountCodes = async (req, res) => {
  try {
    const discountCodes = await DiscountCode.find()
      .populate('courses', 'title')
      .populate('createdBy', 'fullName')
      .sort({ createdAt: -1 });
    const courses = await Course.find({ status: 'available' }).select('title').sort({ title: 1 });

    res.render('pages/admin/discount-codes', {
      title: 'أكواد الخصم',
      discountCodes,
      courses,
      layouts: 'admin'
    });
  } catch (error) {
    console.error('Admin discount codes error:', error);
    req.session.error_msg = 'حدث خطأ أثناء تحميل أكواد الخصم';
    res.redirect('/admin/dashboard');
  }
};

// Admin: create discount code
exports.createAdminDiscountCode = async (req, res) => {
  try {
    const { code, discountType, discountValue, scope, courses, maxUses, expiresAt, isActive } = req.body;
    const value = Number(discountValue);
    const valueError = validateDiscountValue(discountType, value);
    if (valueError) {
      req.session.error_msg = valueError;
      return res.redirect('/admin/discount-codes');
    }

    const courseIds = scope === 'courses' ? normalizeIds(courses) : [];
    if (scope === 'courses' && courseIds.length === 0) {
      req.session.error_msg = 'يجب اختيار كورس واحد على الأقل';
      return res.redirect('/admin/discount-codes');
    }

    await DiscountCode.create({
      code: code.trim().toUpperCase(),
      discountType,
      discountValue: value,
      createdBy: req.session.userId,
      courses: courseIds,
      maxUses: parseMaxUses(maxUses),
      isActive: parseIsActive(isActive),
      expiresAt: parseExpiresAt(expiresAt)
    });

    req.flash('success_msg', 'تم إضافة كود الخصم بنجاح');
    res.redirect('/admin/discount-codes');
  } catch (error) {
    console.error('Create admin discount code error:', error);
    req.session.error_msg = error.code === 11000 ? 'كود الخصم مستخدم مسبقاً' : 'حدث خطأ أثناء إضافة كود الخصم';
    res.redirect('/admin/discount-codes');
  }
};

// Admin: update discount code
exports.updateAdminDiscountCode = async (req, res) => {
  try {
    const discountCode = await DiscountCode.findById(req.params.id);
    if (!discountCode) {
      req.session.error_msg = 'كود الخصم غير موجود';
      return res.redirect('/admin/discount-codes');
    }

    const { code, discountType, discountValue, scope, courses, maxUses, expiresAt, isActive } = req.body;
    const value = Number(discountValue);
    const valueError = validateDiscountValue(discountType, value);
    if (valueError) {
      req.session.error_msg = valueError;
      return res.redirect('/admin/discount-codes');
    }

    const courseIds = scope === 'courses' ? normalizeIds(courses) : [];
    if (scope === 'courses' && courseIds.length === 0) {
      req.session.error_msg = 'يجب اختيار كورس واحد على الأقل';
      return res.redirect('/admin/discount-codes');
    }

    discountCode.code = code.trim().toUpperCase();
    discountCode.discountType = discountType;
    discountCode.discountValue = value;
    discountCode.courses = courseIds;
    discountCode.maxUses = parseMaxUses(maxUses);
    discountCode.expiresAt = parseExpiresAt(expiresAt);
    discountCode.isActive = parseIsActive(isActive);
    await discountCode.save();

    req.flash('success_msg', 'تم تحديث كود الخصم بنجاح');
    res.redirect('/admin/discount-codes');
  } catch (error) {
    console.error('Update admin discount code error:', error);
    req.session.error_msg = error.code === 11000 ? 'كود الخصم مستخدم مسبقاً' : 'حدث خطأ أثناء تحديث كود الخصم';
    res.redirect('/admin/discount-codes');
  }
};

// Admin: delete discount code
exports.deleteAdminDiscountCode = async (req, res) => {
  try {
    const discountCode = await DiscountCode.findByIdAndDelete(req.params.id);
    if (!discountCode) {
      req.session.error_msg = 'كود الخصم غير موجود';
      return res.redirect('/admin/discount-codes');
    }
    req.flash('success_msg', 'تم حذف كود الخصم بنجاح');
    res.redirect('/admin/discount-codes');
  } catch (error) {
    console.error('Delete admin discount code error:', error);
    req.session.error_msg = 'حدث خطأ أثناء حذف كود الخصم';
    res.redirect('/admin/discount-codes');
  }
};

// Teacher: own discount codes page
exports.getTeacherDiscountCodes = async (req, res) => {
  try {
    const discountCodes = await DiscountCode.find({ createdBy: req.session.userId })
      .populate('courses', 'title')
      .sort({ createdAt: -1 });
    const courses = await Course.find({ teacher: req.session.userId })
      .select('title')
      .sort({ title: 1 });

    res.render('pages/teacher/discount-codes', {
      title: 'أكواد الخصم',
      discountCodes,
      courses,
      layouts: 'teacher'
    });
  } catch (error) {
    console.error('Teacher discount codes error:', error);
    req.session.error_msg = 'حدث خطأ أثناء تحميل أكواد الخصم';
    res.redirect('/teacher/dashboard');
  }
};

// Validate that every course belongs to the logged-in teacher
const getOwnedCourseIds = async (req, courseValues) => {
  const ids = normalizeIds(courseValues);
  if (ids.length === 0) return [];
  const owned = await Course.find({
    _id: { $in: ids },
    teacher: req.session.userId
  }).select('_id');
  return owned.map(course => course._id.toString());
};

// Teacher: create own discount code
exports.createTeacherDiscountCode = async (req, res) => {
  try {
    const { code, discountType, discountValue, courses, maxUses, expiresAt, isActive } = req.body;
    const value = Number(discountValue);
    const valueError = validateDiscountValue(discountType, value);
    if (valueError) {
      req.session.error_msg = valueError;
      return res.redirect('/teacher/discount-codes');
    }
    if (parseMaxUses(maxUses) === null) {
      req.session.error_msg = 'يجب تحديد العدد الأقصى للاستخدام لأكواد المدرس';
      return res.redirect('/teacher/discount-codes');
    }

    const courseIds = await getOwnedCourseIds(req, courses);
    if (courseIds.length === 0) {
      req.session.error_msg = 'يجب اختيار كورس واحد على الأقل من كورساتك';
      return res.redirect('/teacher/discount-codes');
    }

    await DiscountCode.create({
      code: code.trim().toUpperCase(),
      discountType,
      discountValue: value,
      createdBy: req.session.userId,
      courses: courseIds,
      maxUses: parseMaxUses(maxUses),
      isActive: parseIsActive(isActive),
      expiresAt: parseExpiresAt(expiresAt)
    });

    req.flash('success_msg', 'تم إضافة كود الخصم بنجاح');
    res.redirect('/teacher/discount-codes');
  } catch (error) {
    console.error('Create teacher discount code error:', error);
    req.session.error_msg = error.code === 11000 ? 'كود الخصم مستخدم مسبقاً' : 'حدث خطأ أثناء إضافة كود الخصم';
    res.redirect('/teacher/discount-codes');
  }
};

// Teacher: update own discount code
exports.updateTeacherDiscountCode = async (req, res) => {
  try {
    const discountCode = await DiscountCode.findOne({
      _id: req.params.id,
      createdBy: req.session.userId
    });
    if (!discountCode) {
      req.session.error_msg = 'كود الخصم غير موجود أو غير مصرح لك بتعديله';
      return res.redirect('/teacher/discount-codes');
    }

    const { code, discountType, discountValue, courses, maxUses, expiresAt, isActive } = req.body;
    const value = Number(discountValue);
    const valueError = validateDiscountValue(discountType, value);
    if (valueError) {
      req.session.error_msg = valueError;
      return res.redirect('/teacher/discount-codes');
    }
    if (parseMaxUses(maxUses) === null) {
      req.session.error_msg = 'يجب تحديد العدد الأقصى للاستخدام لأكواد المدرس';
      return res.redirect('/teacher/discount-codes');
    }

    const courseIds = await getOwnedCourseIds(req, courses);
    if (courseIds.length === 0) {
      req.session.error_msg = 'يجب اختيار كورس واحد على الأقل من كورساتك';
      return res.redirect('/teacher/discount-codes');
    }

    discountCode.code = code.trim().toUpperCase();
    discountCode.discountType = discountType;
    discountCode.discountValue = value;
    discountCode.courses = courseIds;
    discountCode.maxUses = parseMaxUses(maxUses);
    discountCode.expiresAt = parseExpiresAt(expiresAt);
    discountCode.isActive = parseIsActive(isActive);
    await discountCode.save();

    req.flash('success_msg', 'تم تحديث كود الخصم بنجاح');
    res.redirect('/teacher/discount-codes');
  } catch (error) {
    console.error('Update teacher discount code error:', error);
    req.session.error_msg = error.code === 11000 ? 'كود الخصم مستخدم مسبقاً' : 'حدث خطأ أثناء تحديث كود الخصم';
    res.redirect('/teacher/discount-codes');
  }
};

// Teacher: delete own discount code
exports.deleteTeacherDiscountCode = async (req, res) => {
  try {
    const discountCode = await DiscountCode.findOneAndDelete({
      _id: req.params.id,
      createdBy: req.session.userId
    });
    if (!discountCode) {
      req.session.error_msg = 'كود الخصم غير موجود أو غير مصرح لك بحذفه';
      return res.redirect('/teacher/discount-codes');
    }
    req.flash('success_msg', 'تم حذف كود الخصم بنجاح');
    res.redirect('/teacher/discount-codes');
  } catch (error) {
    console.error('Delete teacher discount code error:', error);
    req.session.error_msg = 'حدث خطأ أثناء حذف كود الخصم';
    res.redirect('/teacher/discount-codes');
  }
};

exports.calculateDiscount = calculateDiscount;
exports.isCodeUsable = isCodeUsable;
