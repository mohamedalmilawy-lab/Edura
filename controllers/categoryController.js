const Category = require('../models/Category');

// Get all categories (used in various pages)
exports.getAllCategories = async (req, res, next) => {
  try {
    res.locals.categories = await Category.find().sort({ name: 1 });
    next();
  } catch (error) {
    console.error('Get categories middleware error:', error);
    res.locals.categories = [];
    next();
  }
};

// Admin: Get categories for management
exports.getAdminCategories = async (req, res) => {
  try {
    const categories = await Category.find().sort({ createdAt: -1 });
    res.render('pages/admin/categories', {
      title: 'إدارة التصنيفات',
      categories,
      layouts: 'admin'
    });
  } catch (error) {
    console.error('Admin categories error:', error);
    req.session.error_msg = 'حدث خطأ أثناء تحميل التصنيفات';
    res.redirect('/admin/dashboard');
  }
};

// Admin: Create category
exports.createCategory = async (req, res) => {
  try {
    const { name, description, icon } = req.body;

    // Check if name exists
    const existing = await Category.findOne({ name: { $regex: new RegExp('^' + name + '$', 'i') } });
    if (existing) {
      req.session.error_msg = 'اسم التصنيف موجود مسبقاً';
      return res.redirect('/admin/categories');
    }

    await Category.create({ name, description, icon });
    req.flash('success_msg', 'تم إضافة التصنيف بنجاح');
    res.redirect('/admin/categories');
  } catch (error) {
    console.error('Create category error:', error);
    req.session.error_msg = 'حدث خطأ أثناء إضافة التصنيف';
    res.redirect('/admin/categories');
  }
};

// Admin: Update category
exports.updateCategory = async (req, res) => {
  try {
    const { name, description, icon } = req.body;
    const category = await Category.findByIdAndUpdate(
      req.params.id,
      { name, description, icon },
      { new: true }
    );

    if (!category) {
      req.session.error_msg = 'التصنيف غير موجود';
      return res.redirect('/admin/categories');
    }

    req.flash('success_msg', 'تم تحديث التصنيف بنجاح');
    res.redirect('/admin/categories');
  } catch (error) {
    console.error('Update category error:', error);
    req.session.error_msg = 'حدث خطأ أثناء تحديث التصنيف';
    res.redirect('/admin/categories');
  }
};

// Admin: Delete category
exports.deleteCategory = async (req, res) => {
  try {
    // Check if category has courses
    const Course = require('../models/Course');
    const courseCount = await Course.countDocuments({ category: req.params.id });

    if (courseCount > 0) {
      req.session.error_msg = 'لا يمكن حذف التصنيف لأنه يحتوي على كورسات';
      return res.redirect('/admin/categories');
    }

    await Category.findByIdAndDelete(req.params.id);
    req.flash('success_msg', 'تم حذف التصنيف بنجاح');
    res.redirect('/admin/categories');
  } catch (error) {
    console.error('Delete category error:', error);
    req.session.error_msg = 'حدث خطأ أثناء حذف التصنيف';
    res.redirect('/admin/categories');
  }
};

// Teacher: Get categories
exports.getTeacherCategories = async (req, res) => {
  try {
    const categories = await Category.find().sort({ createdAt: -1 });
    res.render('pages/teacher/categories', {
      title: 'التصنيفات',
      categories,
      layouts: 'teacher'
    });
  } catch (error) {
    console.error('Teacher categories error:', error);
    req.session.error_msg = 'حدث خطأ أثناء تحميل التصنيفات';
    res.redirect('/teacher/dashboard');
  }
};

// Teacher: Create category
exports.createTeacherCategory = async (req, res) => {
  try {
    const { name, description, icon } = req.body;

    const existing = await Category.findOne({ name: { $regex: new RegExp('^' + name + '$', 'i') } });
    if (existing) {
      req.session.error_msg = 'اسم التصنيف موجود مسبقاً';
      return res.redirect('/teacher/categories');
    }

    await Category.create({ name, description, icon });
    req.flash('success_msg', 'تم إضافة التصنيف بنجاح');
    res.redirect('/teacher/categories');
  } catch (error) {
    console.error('Create teacher category error:', error);
    req.session.error_msg = 'حدث خطأ أثناء إضافة التصنيف';
    res.redirect('/teacher/categories');
  }
};

// // Teacher: Update category
// exports.updateTeacherCategory = async (req, res) => {
//   try {
//     const { name, description, icon } = req.body;
//     await Category.findByIdAndUpdate(req.params.id, { name, description, icon });
//     req.session.success_msg = 'تم تحديث التصنيف بنجاح';
//     res.redirect('/teacher/categories');
//   } catch (error) {
//     console.error('Update teacher category error:', error);
//     req.session.error_msg = 'حدث خطأ أثناء تحديث التصنيف';
//     res.redirect('/teacher/categories');
//   }
// };

// // Teacher: Delete category
// exports.deleteTeacherCategory = async (req, res) => {
//   try {
//     const Course = require('../models/Course');
//     const courseCount = await Course.countDocuments({ category: req.params.id });

//     if (courseCount > 0) {
//       req.session.error_msg = 'لا يمكن حذف التصنيف لأنه يحتوي على كورسات';
//       return res.redirect('/teacher/categories');
//     }

//     await Category.findByIdAndDelete(req.params.id);
//     req.session.success_msg = 'تم حذف التصنيف بنجاح';
//     res.redirect('/teacher/categories');
//   } catch (error) {
//     console.error('Delete teacher category error:', error);
//     req.session.error_msg = 'حدث خطأ أثناء حذف التصنيف';
//     res.redirect('/teacher/categories');
//   }
// };
