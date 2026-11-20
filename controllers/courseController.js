const Course = require('../models/Course');
const Category = require('../models/Category');
const Comment = require('../models/Comment');
const User = require('../models/User');
const Cart = require('../models/Cart');
const Wishlist = require('../models/Wishlist');
const fs = require('fs');
const path = require('path');
const ApiResponse = require('../utils/ApiResponse');

function convertToYouTubeUrl(url) {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return `https://www.youtube.com/embed/${match[1]}`;
    }
  }
  return url;
}

// يقرأ حقول العرض (offerPrice / offerEndDate) من req.body ويرجع قيماً جاهزة للحفظ
function parseOfferFields(body) {
  const offerPrice = body.offerPrice === '' || body.offerPrice == null ? null : Number(body.offerPrice);
  const offerEndDate = body.offerEndDate ? new Date(body.offerEndDate) : null;
  return { offerPrice, offerEndDate };
}

// GET /api/courses - List all courses with filters
exports.getAllCourses = async (req, res) => {
  try {
    const { search, category, minPrice, maxPrice, page = 1 } = req.query;
    const limit = 9;
    const skip = (parseInt(page) - 1) * limit;

    // Build query
    const query = { status: 'available' };

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    if (category) {
      query.category = category;
    }

    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = parseFloat(minPrice);
      if (maxPrice) query.price.$lte = parseFloat(maxPrice);
    }

    // Get courses with pagination
    const courses = await Course.find(query)
      .populate('category', 'name')
      .populate('teacher', 'fullName')
      .sort({ createdAt: -1, _id: 1 })
      .skip(skip)
      .limit(limit);

    // Get total count for pagination
    const totalCourses = await Course.countDocuments(query);
    const totalPages = Math.ceil(totalCourses / limit);

    // Get all categories for filter
    const categories = await Category.find().sort({ name: 1 });

    // Check user's cart and wishlist for button states (optional auth)
    let cartCourseIds = [];
    let wishlistCourseIds = [];

    if (req.user) {
      const cart = await Cart.findOne({ user: req.user.id });
      const wishlist = await Wishlist.findOne({ user: req.user.id });
      if (cart) cartCourseIds = cart.courses.map(c => c.toString());
      if (wishlist) wishlistCourseIds = wishlist.courses.map(c => c.toString());
    }

    // Get comments for each course
    const courseIds = courses.map(c => c._id);
    const allComments = await Comment.find({ course: { $in: courseIds } })
      .populate('user', 'fullName')
      .sort({ createdAt: -1 });

    const commentsByCourse = {};
    allComments.forEach(comment => {
      const courseId = comment.course.toString();
      if (!commentsByCourse[courseId]) commentsByCourse[courseId] = [];
      commentsByCourse[courseId].push(comment);
    });

    return ApiResponse.ok(res, 'تم جلب الكورسات بنجاح', {
      courses,
      categories,
      commentsByCourse,
      cartCourseIds,
      wishlistCourseIds,
      filters: {
        search: search || '',
        category: category || '',
        minPrice: minPrice || '',
        maxPrice: maxPrice || ''
      },
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalCourses
      }
    });
  } catch (error) {
    console.error('Get courses error:', error);
    return ApiResponse.serverError(res, 'حدث خطأ أثناء تحميل الكورسات');
  }
};

// GET /api/courses/:id - Course detail
exports.getCourseDetail = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id)
      .populate('category', 'name')
      .populate('teacher', 'fullName');

    if (!course) {
      return ApiResponse.notFound(res, 'الكورس غير موجود');
    }

    // Get comments
    const comments = await Comment.find({ course: course._id })
      .populate('user', 'fullName')
      .sort({ createdAt: -1 });

    // Get related courses
    const relatedCourses = await Course.find({
      category: course.category,
      _id: { $ne: course._id },
      status: 'available'
    })
      .populate('category', 'name')
      .limit(4);

    // Check if in cart/wishlist (optional auth)
    let inCart = false;
    let inWishlist = false;
    let hasAccess = false;

    if (req.user) {
      const cart = await Cart.findOne({ user: req.user.id });
      const wishlist = await Wishlist.findOne({ user: req.user.id });
      if (cart) inCart = cart.courses.includes(course._id);
      if (wishlist) inWishlist = wishlist.courses.includes(course._id);

      // Check access (admin, teacher, or purchased)
      if (req.user.role === 'admin' || course.teacher._id.toString() === req.user.id.toString()) {
        hasAccess = true;
      } else {
        const Order = require('../models/Order');
        const order = await Order.findOne({
          user: req.user.id,
          status: 'confirmed',
          courses: course._id
        });
        if (order) hasAccess = true;
      }
    }

    return ApiResponse.ok(res, 'تم جلب تفاصيل الكورس بنجاح', {
      course,
      comments,
      relatedCourses,
      inCart,
      inWishlist,
      hasAccess
    });
  } catch (error) {
    console.error('Get course detail error:', error);
    return ApiResponse.serverError(res, 'حدث خطأ أثناء تحميل تفاصيل الكورس');
  }
};

// Admin: Get all courses for management
exports.getAdminCourses = async (req, res) => {
  try {
    const { search, category, status } = req.query;
    const query = {};

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    if (category) query.category = category;
    if (status) query.status = status;

    const courses = await Course.find(query)
      .populate('category', 'name')
      .populate('teacher', 'fullName')
      .sort({ createdAt: -1 });

    const categories = await Category.find();
    const teachers = await User.find({ role: { $in: ['teacher', 'admin'] } });

    res.render('pages/admin/courses', {
      title: 'إدارة الكورسات',
      courses,
      categories,
      teachers,
      layouts: 'admin'
    });
  } catch (error) {
    console.error('Admin courses error:', error);
    req.session.error_msg = 'حدث خطأ أثناء تحميل الكورسات';
    res.redirect('/admin/dashboard');
  }
};

// Admin: Create course
exports.createCourse = async (req, res) => {
  try {
    const { title, description, price, category, teacher, status, videos } = req.body;
    const offer = parseOfferFields(req.body);

    const courseData = {
      title,
      description,
      price: parseFloat(price),
      category,
      teacher,
      status: status || 'available',
      videos: [],
      offerPrice: offer.offerPrice,
      offerEndDate: offer.offerEndDate
    };
    
    if (videos) {
      const rawVideos = Array.isArray(videos) ? videos : [videos];
      courseData.videos = rawVideos
        .map(url => url.trim())
        .filter(url => url !== '')
        .map(url => convertToYouTubeUrl(url))
        .filter(url => url !== null);
    }

    if (req.file) {
      courseData.image = '/uploads/' + req.file.filename;
    }

    await Course.create(courseData);
    req.flash('success_msg', 'تم إضافة الكورس بنجاح');
    res.redirect('/admin/courses');
  } catch (error) {
    console.error('Create course error:', error);
    req.session.error_msg = 'حدث خطأ أثناء إضافة الكورس';
    res.redirect('/admin/courses');
  }
};

// Admin: Update course
exports.updateCourse = async (req, res) => {
  try {
    const { title, description, price, category, teacher, status, videos } = req.body;
    const course = await Course.findById(req.params.id);

    if (!course) {
      req.session.error_msg = 'الكورس غير موجود';
      return res.redirect('/admin/courses');
    }

    course.title = title;
    course.description = description;
    course.price = parseFloat(price);
    course.category = category;
    course.teacher = teacher;
    const offer = parseOfferFields(req.body);
    course.offerPrice = offer.offerPrice;
    course.offerEndDate = offer.offerEndDate;
    course.status = status || course.status;

    if (videos) {
      const rawVideos = Array.isArray(videos) ? videos : [videos];
      course.videos = rawVideos
        .map(url => url.trim())
        .filter(url => url !== '')
        .map(url => convertToYouTubeUrl(url))
        .filter(url => url !== null);
    } else {
      course.videos = [];
    }

    if (req.file) {
      if (course.image && !course.image.includes('default')) {
        const oldPath = path.join(__dirname, '..', 'public', course.image);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      course.image = '/uploads/' + req.file.filename;
    }

    await course.save();
    req.flash('success_msg', 'تم تحديث الكورس بنجاح');
    res.redirect('/admin/courses');
  } catch (error) {
    console.error('Update course error:', error);
    req.session.error_msg = 'حدث خطأ أثناء تحديث الكورس';
    res.redirect('/admin/courses');
  }
};


// Admin: Delete course
exports.deleteCourse = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);

    if (!course) {
      req.session.error_msg = 'الكورس غير موجود';
      return res.redirect('/admin/courses');
    }

    // Delete image if not default
    if (course.image && !course.image.includes('default')) {
      const imagePath = path.join(__dirname, '..', 'public', course.image);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    await Course.findByIdAndDelete(req.params.id);
    req.flash('success_msg', 'تم حذف الكورس بنجاح');
    res.redirect('/admin/courses');
  } catch (error) {
    console.error('Delete course error:', error);
    req.session.error_msg = 'حدث خطأ أثناء حذف الكورس';
    res.redirect('/admin/courses');
  }
};

// Teacher: Get own courses
exports.getTeacherCourses = async (req, res) => {
  try {
    const { search, status } = req.query;
    const query = { teacher: req.session.userId };

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    if (status) query.status = status;

    const courses = await Course.find(query)
      .populate('category', 'name')
      .sort({ createdAt: -1 });

    const categories = await Category.find();

    res.render('pages/teacher/courses', {
      title: 'كورساتي',
      courses,
      categories,
      layouts: 'teacher'
    });
  } catch (error) {
    console.error('Teacher courses error:', error);
    req.session.error_msg = 'حدث خطأ أثناء تحميل الكورسات';
    res.redirect('/teacher/dashboard');
  }
};

// Teacher: Create course
exports.createTeacherCourse = async (req, res) => {
  try {
    const { title, description, price, category, status, videos } = req.body;
    const offer = parseOfferFields(req.body);
    
    const courseData = {
      title,
      description,
      price: parseFloat(price),
      category,
      teacher: req.session.userId,
      status: status || 'available',
      videos: [],
      offerPrice: offer.offerPrice,
      offerEndDate: offer.offerEndDate
    };
    
    if (videos) {
      const rawVideos = Array.isArray(videos) ? videos : [videos];
      courseData.videos = rawVideos
        .map(url => url.trim())
        .filter(url => url !== '')
        .map(url => convertToYouTubeUrl(url))
        .filter(url => url !== null);
    }

    if (req.file) {
      courseData.image = '/uploads/' + req.file.filename;
    }

    await Course.create(courseData);
    req.flash('success_msg', 'تم إضافة الكورس بنجاح');
    res.redirect('/teacher/courses');
  } catch (error) {
    console.error('Create teacher course error:', error);
    req.session.error_msg = 'حدث خطأ أثناء إضافة الكورس';
    res.redirect('/teacher/courses');
  }
};

// Teacher: Update own course
exports.updateTeacherCourse = async (req, res) => {
  try {
    const { title, description, price, category, status, videos } = req.body;
    const offer = parseOfferFields(req.body);
    const course = await Course.findOne({
      _id: req.params.id,
      teacher: req.session.userId
    });

    if (!course) {
      req.session.error_msg = 'الكورس غير موجود أو غير مصرح لك بتعديله';
      return res.redirect('/teacher/courses');
    }

    course.title = title;
    course.description = description;
    course.price = parseFloat(price);
    course.category = category;
    course.offerPrice = offer.offerPrice;
    course.offerEndDate = offer.offerEndDate;
    course.status = status || course.status;

    if (videos) {
      const rawVideos = Array.isArray(videos) ? videos : [videos];
      course.videos = rawVideos
        .map(url => url.trim())
        .filter(url => url !== '')
        .map(url => convertToYouTubeUrl(url))
        .filter(url => url !== null);
    } else {
      course.videos = [];
    }


    if (req.file) {
      if (course.image && !course.image.includes('default')) {
        const oldPath = path.join(__dirname, '..', 'public', course.image);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      course.image = '/uploads/' + req.file.filename;
    }

    await course.save();
    req.flash('success_msg', 'تم تحديث الكورس بنجاح');
    res.redirect('/teacher/courses');
  } catch (error) {
    console.error('Update teacher course error:', error);
    req.session.error_msg = 'حدث خطأ أثناء تحديث الكورس';
    res.redirect('/teacher/courses');
  }
};

// Teacher: Delete own course
exports.deleteTeacherCourse = async (req, res) => {
  try {
    const course = await Course.findOne({
      _id: req.params.id,
      teacher: req.session.userId
    });

    if (!course) {
      req.session.error_msg = 'الكورس غير موجود أو غير مصرح لك بحذفه';
      return res.redirect('/teacher/courses');
    }

    if (course.image && !course.image.includes('default')) {
      const imagePath = path.join(__dirname, '..', 'public', course.image);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    await Course.findByIdAndDelete(req.params.id);
    req.flash('success_msg', 'تم حذف الكورس بنجاح');
    res.redirect('/teacher/courses');
  } catch (error) {
    console.error('Delete teacher course error:', error);
    req.session.error_msg = 'حدث خطأ أثناء حذف الكورس';
    res.redirect('/teacher/courses');
  }
};
