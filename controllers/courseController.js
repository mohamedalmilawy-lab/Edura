const Course = require('../models/Course');
const Category = require('../models/Category');
const Comment = require('../models/Comment');
const User = require('../models/User');
const Cart = require('../models/Cart');
const Wishlist = require('../models/Wishlist');
const Order = require('../models/Order');
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

function getUploadedImage(req) {
  if (req.file) return req.file;
  return req.files && req.files.image ? req.files.image[0] : null;
}

function toArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function parseExams(body) {
  const questionTexts = toArray(body.questionTexts);
  const choiceOne = toArray(body.choiceOne);
  const choiceTwo = toArray(body.choiceTwo);
  const choiceThree = toArray(body.choiceThree);
  const choiceFour = toArray(body.choiceFour);
  const correctChoices = toArray(body.correctChoices);

  const questions = questionTexts
    .map((question, index) => {
      const choices = [
        (choiceOne[index] || '').trim(),
        (choiceTwo[index] || '').trim(),
        (choiceThree[index] || '').trim(),
        (choiceFour[index] || '').trim()
      ].filter(choice => choice !== '');
      const correctChoice = Number(correctChoices[index] ?? 0);

      if (!question || !question.trim() || choices.length < 2) return null;
      if (!Number.isInteger(correctChoice) || correctChoice < 0 || correctChoice >= choices.length) return null;

      return {
        question: question.trim(),
        choices,
        correctChoice
      };
    })
    .filter(Boolean);

  if (questions.length === 0) return [];

  return [{
    title: (body.examTitle || '').trim() || 'اختبار الكورس',
    questions
  }];
}

function parseUploadedPdfs(req) {
  const files = req.files && req.files.pdfs ? req.files.pdfs : [];
  const titles = toArray(req.body.pdfTitles);
  return files.map((file, index) => ({
    title: (titles[index] || '').trim() || file.originalname,
    url: '/uploads/' + file.filename
  }));
}

function deleteCourseFile(url) {
  if (!url || !url.startsWith('/uploads/')) return;
  const filePath = path.join(__dirname, '..', 'public', url);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

// GET /api/courses/popular - List the most requested available courses
exports.getPopularCourses = async (req, res) => {
  try {
    const requestedLimit = parseInt(req.query.limit, 10);
    const limit = Number.isInteger(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), 20)
      : 8;

    const courses = await Course.find({ status: 'available' })
      .populate('category', 'name')
      .populate('teacher', 'fullName bio profileImage')
      .sort({ enrolledCount: -1, createdAt: -1 })
      .limit(limit);
    const ratingSummaries = await Comment.getRatingSummaries(courses.map(course => course._id));

    return ApiResponse.ok(res, 'تم جلب الكورسات الاكثر طلبا بنجاح', {
      courses,
      ratingSummaries
    });
  } catch (error) {
    console.error('Get popular courses error:', error);
    return ApiResponse.serverError(res, 'حدث خطأ اثناء تحميل الكورسات الاكثر طلبا');
  }
};

// GET /api/courses/recommended - Personalized recommendations for the logged-in student
exports.getRecommendedCourses = async (req, res) => {
  try {
    const requestedLimit = parseInt(req.query.limit, 10);
    const limit = Number.isInteger(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), 20)
      : 8;

    const [orders, wishlist, cart] = await Promise.all([
      Order.find({ user: req.user.id, status: 'confirmed' }).select('courses'),
      Wishlist.findOne({ user: req.user.id }).select('courses'),
      Cart.findOne({ user: req.user.id }).select('courses')
    ]);

    const excludedCourseIds = [];
    orders.forEach(order => excludedCourseIds.push(...order.courses));
    if (wishlist) excludedCourseIds.push(...wishlist.courses);
    if (cart) excludedCourseIds.push(...cart.courses);

    const preferenceCourses = excludedCourseIds.length > 0
      ? await Course.find({ _id: { $in: excludedCourseIds } }).select('category teacher')
      : [];
    const preferredCategories = [...new Set(preferenceCourses.map(course =>
      course.category ? course.category.toString() : null).filter(Boolean))];
    const preferredTeachers = [...new Set(preferenceCourses.map(course =>
      course.teacher ? course.teacher.toString() : null).filter(Boolean))];

    const query = { status: 'available' };
    if (excludedCourseIds.length > 0) query._id = { $nin: excludedCourseIds };

    const preferenceFilters = [];
    if (preferredCategories.length > 0) {
      preferenceFilters.push({ category: { $in: preferredCategories } });
    }
    if (preferredTeachers.length > 0) {
      preferenceFilters.push({ teacher: { $in: preferredTeachers } });
    }
    if (preferenceFilters.length > 0) query.$or = preferenceFilters;

    let courses = await Course.find(query)
      .populate('category', 'name')
      .populate('teacher', 'fullName bio profileImage')
      .sort({ enrolledCount: -1, createdAt: -1 })
      .limit(limit);

    if (courses.length < limit) {
      const fallbackIds = [
        ...excludedCourseIds,
        ...courses.map(course => course._id)
      ];
      const fallbackCourses = await Course.find({
        status: 'available',
        _id: { $nin: fallbackIds }
      })
        .populate('category', 'name')
        .populate('teacher', 'fullName bio profileImage')
        .sort({ enrolledCount: -1, createdAt: -1 })
        .limit(limit - courses.length);
      courses.push(...fallbackCourses);
    }
    const ratingSummaries = await Comment.getRatingSummaries(courses.map(course => course._id));

    return ApiResponse.ok(res, 'تم جلب الكورسات المقترحة بنجاح', { courses, ratingSummaries });
  } catch (error) {
    console.error('Get recommended courses error:', error);
    return ApiResponse.serverError(res, 'حدث خطأ أثناء جلب الكورسات المقترحة');
  }
};

// GET /api/courses - List all courses with filters
exports.getAllCourses = async (req, res) => {
  try {
    const { search, category, minPrice, maxPrice, page = 1, limit = 8 } = req.query;
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
      .populate('teacher', 'fullName bio profileImage')
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
    const ratingSummaries = await Comment.getRatingSummaries(courseIds);

    return ApiResponse.ok(res, 'تم جلب الكورسات بنجاح', {
      courses,
      categories,
      commentsByCourse,
      ratingSummaries,
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

// GET /api/courses/search?search=... - Search available courses
exports.searchCourses = async (req, res) => {
  const searchTerm = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  if (!searchTerm || searchTerm.length > 100) {
    return ApiResponse.badRequest(res, 'يرجى إدخال عبارة بحث لا تتجاوز 100 حرف');
  }

  const page = req.query.page === undefined ? 1 : Number(req.query.page);
  const requestedLimit = req.query.limit === undefined ? 8 : Number(req.query.limit);
  if (!Number.isInteger(page) || page < 1 ||
      !Number.isInteger(requestedLimit) || requestedLimit < 1) {
    return ApiResponse.badRequest(res, 'رقم الصفحة وعدد النتائج يجب أن يكونا أعداداً صحيحة موجبة');
  }

  const limit = Math.min(requestedLimit, 50);
  const skip = (page - 1) * limit;
  const escapedSearchTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const query = {
    status: 'available',
    $or: [
      { title: { $regex: escapedSearchTerm, $options: 'i' } },
      { description: { $regex: escapedSearchTerm, $options: 'i' } }
    ]
  };

  try {
    const [courses, totalCourses] = await Promise.all([
      Course.find(query)
        .populate('category', 'name')
        .populate('teacher', 'fullName bio profileImage')
        .sort({ createdAt: -1, _id: 1 })
        .skip(skip)
        .limit(limit),
      Course.countDocuments(query)
    ]);
    const ratingSummaries = await Comment.getRatingSummaries(courses.map(course => course._id));

    return ApiResponse.ok(res, 'تم البحث عن الكورسات بنجاح', {
      courses,
      ratingSummaries,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCourses / limit),
        totalCourses,
        limit
      }
    });
  } catch (error) {
    console.error('Search courses error:', error);
    return ApiResponse.serverError(res, 'حدث خطأ أثناء البحث عن الكورسات');
  }
};

// GET /api/courses/:id - Course detail
exports.getCourseDetail = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id)
      .populate('category', 'name')
      .populate('teacher', 'fullName bio profileImage');

    if (!course) {
      return ApiResponse.notFound(res, 'الكورس غير موجود');
    }

    // Get comments
    const comments = await Comment.find({ course: course._id })
      .populate('user', 'fullName')
      .sort({ createdAt: -1 });
    const ratingSummaries = await Comment.getRatingSummaries([course._id]);
    const ratingSummary = ratingSummaries[course._id.toString()] || {
      averageRating: 0,
      ratingCount: 0
    };
    let userRating = null;
    if (req.user) {
      const ownReview = await Comment.findOne({ course: course._id, user: req.user.id }).select('rating text');
      if (ownReview) userRating = ownReview;
    }

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
      ratingSummary,
      userRating,
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
      .populate('teacher', 'fullName bio profileImage')
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
    const uploadedImage = getUploadedImage(req);

    const courseData = {
      title,
      description,
      price: parseFloat(price),
      category,
      teacher,
      status: status || 'available',
      videos: [],
      pdfs: parseUploadedPdfs(req),
      exams: parseExams(req.body),
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

    if (uploadedImage) {
      courseData.image = '/uploads/' + uploadedImage.filename;
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
    const uploadedImage = getUploadedImage(req);

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
    course.exams = parseExams(req.body);

    const removedPdfs = toArray(req.body.removePdfs);
    if (removedPdfs.length > 0) {
      course.pdfs = (course.pdfs || []).filter(pdf => {
        if (removedPdfs.includes(pdf.url)) {
          deleteCourseFile(pdf.url);
          return false;
        }
        return true;
      });
    }
    const uploadedPdfs = parseUploadedPdfs(req);
    if (uploadedPdfs.length > 0) {
      course.pdfs = [...(course.pdfs || []), ...uploadedPdfs];
    }

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

    if (uploadedImage) {
      if (course.image && !course.image.includes('default')) {
        const oldPath = path.join(__dirname, '..', 'public', course.image);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      course.image = '/uploads/' + uploadedImage.filename;
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
    (course.pdfs || []).forEach(pdf => deleteCourseFile(pdf.url));

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
    const uploadedImage = getUploadedImage(req);
    
    const courseData = {
      title,
      description,
      price: parseFloat(price),
      category,
      teacher: req.session.userId,
      status: status || 'available',
      videos: [],
      pdfs: parseUploadedPdfs(req),
      exams: parseExams(req.body),
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

    if (uploadedImage) {
      courseData.image = '/uploads/' + uploadedImage.filename;
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
    const uploadedImage = getUploadedImage(req);
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
    course.exams = parseExams(req.body);

    const removedPdfs = toArray(req.body.removePdfs);
    if (removedPdfs.length > 0) {
      course.pdfs = (course.pdfs || []).filter(pdf => {
        if (removedPdfs.includes(pdf.url)) {
          deleteCourseFile(pdf.url);
          return false;
        }
        return true;
      });
    }
    const uploadedPdfs = parseUploadedPdfs(req);
    if (uploadedPdfs.length > 0) {
      course.pdfs = [...(course.pdfs || []), ...uploadedPdfs];
    }

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


    if (uploadedImage) {
      if (course.image && !course.image.includes('default')) {
        const oldPath = path.join(__dirname, '..', 'public', course.image);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      course.image = '/uploads/' + uploadedImage.filename;
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
    (course.pdfs || []).forEach(pdf => deleteCourseFile(pdf.url));

    await Course.findByIdAndDelete(req.params.id);
    req.flash('success_msg', 'تم حذف الكورس بنجاح');
    res.redirect('/teacher/courses');
  } catch (error) {
    console.error('Delete teacher course error:', error);
    req.session.error_msg = 'حدث خطأ أثناء حذف الكورس';
    res.redirect('/teacher/courses');
  }
};
