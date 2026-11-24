const User = require('../models/User');
const Course = require('../models/Course');
const Order = require('../models/Order');
const Category = require('../models/Category');
const Transaction = require('../models/Transaction');
const Contact = require('../models/Contact');
const Comment = require('../models/Comment');
const Banner = require('../models/Banner');

// GET /admin/dashboard - Admin dashboard overview
exports.getDashboard = async (req, res) => {
  try {
    // Get stats
    const totalCourses = await Course.countDocuments();
    const totalUsers = await User.countDocuments();
    const totalOrders = await Order.countDocuments();
    const totalRevenue = await Order.aggregate([
      { $match: { status: 'confirmed' } },
      { $group: { _id: null, total: { $sum: '$totalPrice' } } }
    ]);
    const revenue = totalRevenue.length > 0 ? totalRevenue[0].total : 0;

    // Get latest 5 orders
    const latestOrders = await Order.find()
      .populate('user', 'fullName')
      .populate('courses', 'title')
      .sort({ createdAt: -1 })
      .limit(5);

    // Get courses sold by category for chart
    const categoryStats = await Course.aggregate([
      { $match: { enrolledCount: { $gt: 0 } } },
      {
        $group: {
          _id: '$category',
          totalSold: { $sum: '$enrolledCount' }
        }
      },
      {
        $lookup: {
          from: 'categories',
          localField: '_id',
          foreignField: '_id',
          as: 'categoryInfo'
        }
      },
      { $unwind: '$categoryInfo' },
      {
        $project: {
          name: '$categoryInfo.name',
          totalSold: 1
        }
      }
    ]);

    // Get recent stats
    const recentContacts = await Contact.countDocuments();
    const recentComments = await Comment.countDocuments();
    const totalTeachers = await User.countDocuments({ role: 'teacher' });
    const totalBanners = await Banner.countDocuments();
    const activeBanners = await Banner.countDocuments({ isActive: true });
    const admin = await User.findById(req.session.userId).select('-password');

    res.render('pages/admin/dashboard', {
      title: 'لوحة التحكم',
      stats: {
        totalCourses,
        totalUsers,
        totalOrders,
        revenue,
        recentContacts,
        recentComments,
        totalTeachers,
        totalBanners,
        activeBanners
      },
      latestOrders,
      categoryStats,
      admin,
      layouts: 'admin'
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    req.session.error_msg = 'حدث خطأ أثناء تحميل لوحة التحكم';
    res.redirect('/');
  }
};
