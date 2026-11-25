require('dotenv').config();
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const methodOverride = require('method-override');
const path = require('path');
const multer = require('multer');

const connectDB = require('./config/db');
const { setUser } = require('./middleware/auth');
const ApiResponse = require('./utils/ApiResponse');

// Import routes
const dashboardRoutes = require('./routes/dashboard');
const authRoutes = require('./routes/auth');
const homeRoutes = require('./routes/home');
const courseRoutes = require('./routes/courses');
const cartRoutes = require('./routes/cart');
const wishlistRoutes = require('./routes/wishlist');
const orderRoutes = require('./routes/orders');
const userRoutes = require('./routes/users');
const contactRoutes = require('./routes/contact');
const commentRoutes = require('./routes/comments');
const chatRoutes = require('./routes/chat');
const bannerRoutes = require('./routes/banners');
const adminRoutes = require('./routes/admin');
const teacherRoutes = require('./routes/teacher');

// Initialize app
const app = express();
const PORT = process.env.PORT || 3000;

// Connect to database
connectDB();

// EJS setup (used only by the admin/teacher dashboards and the login page)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Method override for PUT/DELETE (dashboard forms)
app.use(methodOverride('_method'));

// Session configuration (used only by the admin/teacher dashboards)
app.use(session({
  secret: process.env.SESSION_SECRET || 'edura_default_secret',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI
  }),
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 7 // 7 days
  }
}));

// Attach flash helper to request
app.use((req, res, next) => {
  req.flash = (type, message) => {
    req.session.flash = req.session.flash || {};
    req.session.flash[type] = message;
  };
  next();
});

// Set user in locals (for dashboard views)
app.use(setUser);

// Session messages middleware (for dashboard views)
app.use((req, res, next) => {
  const flash = req.session.flash || {};

  res.locals.success_msg = flash.success_msg || req.session.success_msg || null;
  res.locals.error_msg = flash.error_msg || req.session.error_msg || null;
  res.locals.info_msg = flash.info_msg || req.session.info_msg || null;
  res.locals.errors = req.session.errors;
  res.locals.errorFields = req.session.errorFields || {};
  res.locals.oldData = req.session.oldData || {};

  // Clear session messages and old flash
  delete req.session.flash;
  delete req.session.success_msg;
  delete req.session.error_msg;
  delete req.session.info_msg;
  delete req.session.errors;
  delete req.session.errorFields;
  delete req.session.oldData;

  next();
});

// ─── API routes ───────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/home', homeRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/users', userRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/banners', bannerRoutes);

// API root
app.get('/api', (req, res) => ApiResponse.ok(res, 'Edura', {
  name: 'Edura',
  version: '1.0.0'
}));

// ─── Dashboard routes (admin / teacher) ───────────────────────────────────────
app.use('/admin', adminRoutes);
app.use('/teacher', teacherRoutes);

// Dashboard session authentication (login page + logout)
app.use('/', dashboardRoutes);

// 404 handler
app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    return ApiResponse.notFound(res, 'المسار المطلوب غير موجود');
  }
  res.status(404).render('pages/404', {
    title: 'الصفحة غير موجودة'
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  if (err instanceof multer.MulterError || err.code === 'LIMIT_FILE_SIZE') {
    if (req.path.startsWith('/api')) {
      return ApiResponse.badRequest(res, err.code === 'LIMIT_FILE_SIZE'
        ? 'حجم الصورة يجب ألا يتجاوز 1 ميجابايت'
        : 'تعذر رفع الملف');
    }
  }
  if (err.message === 'Only image files are allowed (jpeg, jpg, png, webp, gif)' ||
      err.message === 'يسمح برفع صور فقط') {
    if (req.path.startsWith('/api')) {
      return ApiResponse.badRequest(res, 'نوع الملف غير مدعوم. يسمح بصور JPEG أو PNG أو WEBP أو GIF');
    }
  }
  const message = process.env.NODE_ENV === 'development' ? err.message : 'حدث خطأ ما';
  if (req.path.startsWith('/api')) {
    return ApiResponse.serverError(res, message);
  }
  res.status(500).render('pages/error', {
    title: 'خطأ',
    message
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Edura server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
