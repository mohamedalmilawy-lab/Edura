const fs = require('fs');
const path = require('path');
const Banner = require('../models/Banner');
const Course = require('../models/Course');
const Category = require('../models/Category');
const ApiResponse = require('../utils/ApiResponse');

const LINK_POPULATE_SELECT = 'title name price image icon description category teacher status';

// تطبيع حقل link القادم من FormData:
// - إذا كان string واحد → نحوّله لمصفوفة
// - إذا كان مصفوفة → نتركه كما هو
// - إذا كان undefined/null أو linkType = 'Non' → مصفوفة فارغة
function normalizeLink(link, linkType) {
  if (linkType === 'Non') return [];
  if (!link) return [];
  if (Array.isArray(link)) return link;
  return [link];
}

// حذف صورة مرفوعة محلياً من public/uploads
function deleteUploadedImage(imageUrl) {
  if (imageUrl && imageUrl.startsWith('/uploads/')) {
    const filePath = path.join(__dirname, '..', 'public', imageUrl);
    fs.unlink(filePath, () => {});
  }
}

// يدعم checkbox + hidden input بنفس الاسم (قيمة تصل كمصفوفة عند التحديد)
const parseIsActive = (value) => {
  const values = Array.isArray(value) ? value : [value];
  return values.includes('on') || values.includes('true') || value === true;
};

// GET /api/banners - Public: active banners
exports.listActiveBanners = async (req, res) => {
  try {
    const banners = await Banner.find({ isActive: true }).sort({ createdAt: -1 });
    return ApiResponse.ok(res, 'تم جلب اللافتات الإعلانية بنجاح', banners);
  } catch (error) {
    console.error('List banners error:', error);
    return ApiResponse.serverError(res, 'حدث خطأ أثناء جلب اللافتات');
  }
};

// GET /api/banners/:id - Public: banner details with linked courses/categories
exports.getBanner = async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id);
    if (!banner || !banner.isActive) {
      return ApiResponse.notFound(res, 'اللافتة الإعلانية غير موجودة');
    }

    if (banner.linkType !== 'Non' && banner.link && banner.link.length > 0) {
      await banner.populate('link', LINK_POPULATE_SELECT);
    }

    return ApiResponse.ok(res, 'تم جلب اللافتة الإعلانية بنجاح', banner);
  } catch (error) {
    console.error('Get banner error:', error);
    return ApiResponse.serverError(res, 'حدث خطأ أثناء جلب اللافتة');
  }
};

// Admin: Get banners page
exports.getAdminBanners = async (req, res) => {
  try {
    const banners = await Banner.find().sort({ createdAt: -1 });
    const courses = await Course.find().select('title').sort({ title: 1 });
    const categories = await Category.find().select('name').sort({ name: 1 });
    res.render('pages/admin/banners', {
      title: 'إدارة اللافتات',
      banners,
      courses,
      categories,
      layouts: 'admin'
    });
  } catch (error) {
    console.error('Admin banners error:', error);
    req.session.error_msg = 'حدث خطأ أثناء تحميل اللافتات';
    res.redirect('/admin/dashboard');
  }
};

// Admin: Create banner
exports.createBanner = async (req, res) => {
  try {
    const { title, linkType } = req.body;

    if (!title) {
      req.session.error_msg = 'عنوان اللافتة مطلوب';
      return res.redirect('/admin/banners');
    }

    let imageUrl = req.body.imageUrl;
    if (req.file) {
      imageUrl = '/uploads/' + req.file.filename;
    }
    if (!imageUrl) {
      req.session.error_msg = 'صورة اللافتة مطلوبة';
      return res.redirect('/admin/banners');
    }

    const link = normalizeLink(req.body.link, linkType);

    await Banner.create({
      title,
      linkType: linkType || 'Non',
      link,
      imageUrl,
      isActive: parseIsActive(req.body.isActive)
    });

    req.flash('success_msg', 'تم إضافة اللافتة بنجاح');
    res.redirect('/admin/banners');
  } catch (error) {
    console.error('Create banner error:', error);
    req.session.error_msg = 'حدث خطأ أثناء إضافة اللافتة';
    res.redirect('/admin/banners');
  }
};

// Admin: Update banner
exports.updateBanner = async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id);
    if (!banner) {
      req.session.error_msg = 'اللافتة غير موجودة';
      return res.redirect('/admin/banners');
    }

    const { title, linkType } = req.body;
    const update = {};

    if (title !== undefined) update.title = title;
    if (linkType !== undefined) update.linkType = linkType;
    if (req.body.link !== undefined || linkType !== undefined) {
      update.link = normalizeLink(req.body.link, linkType !== undefined ? linkType : banner.linkType);
    }
    if (req.body.isActive !== undefined) update.isActive = parseIsActive(req.body.isActive);

    if (req.file) {
      update.imageUrl = '/uploads/' + req.file.filename;
      deleteUploadedImage(banner.imageUrl);
    }

    await Banner.findByIdAndUpdate(req.params.id, update, { runValidators: true });

    req.flash('success_msg', 'تم تحديث اللافتة بنجاح');
    res.redirect('/admin/banners');
  } catch (error) {
    console.error('Update banner error:', error);
    req.session.error_msg = 'حدث خطأ أثناء تحديث اللافتة';
    res.redirect('/admin/banners');
  }
};

// Admin: Delete banner
exports.deleteBanner = async (req, res) => {
  try {
    const banner = await Banner.findByIdAndDelete(req.params.id);
    if (!banner) {
      req.session.error_msg = 'اللافتة غير موجودة';
      return res.redirect('/admin/banners');
    }

    deleteUploadedImage(banner.imageUrl);

    req.flash('success_msg', 'تم حذف اللافتة بنجاح');
    res.redirect('/admin/banners');
  } catch (error) {
    console.error('Delete banner error:', error);
    req.session.error_msg = '';
    res.redirect('/admin/banners');
  }
};
