const Comment = require('../models/Comment');
const Course = require('../models/Course');
const ApiResponse = require('../utils/ApiResponse');

// GET /api/comments/:courseId - Get comments for a course
exports.getComments = async (req, res) => {
  try {
    const comments = await Comment.find({ course: req.params.courseId })
      .populate('user', 'fullName')
      .sort({ createdAt: -1 });

    const ratingSummary = (await Comment.getRatingSummaries([req.params.courseId]))[req.params.courseId] || {
      averageRating: 0,
      ratingCount: 0
    };
    let userRating = null;
    if (req.user) {
      userRating = await Comment.findOne({
        course: req.params.courseId,
        user: req.user.id
      }).select('rating text');
    }

    return ApiResponse.ok(res, 'تم جلب التعليقات بنجاح', { comments, ratingSummary, userRating });
  } catch (error) {
    console.error('Get comments error:', error);
    return ApiResponse.serverError(res, 'حدث خطأ أثناء تحميل التعليقات');
  }
};

// POST /api/comments/:courseId - Add comment to a course
exports.addComment = async (req, res) => {
  try {
    const { text, rating } = req.body;
    const { courseId } = req.params;
    const userId = req.user.id;

    if (!text || text.trim().length === 0) {
      return ApiResponse.badRequest(res, 'نص التعليق مطلوب');
    }

    // Check if course exists
    const course = await Course.findById(courseId);
    if (!course) {
      return ApiResponse.notFound(res, 'الكورس غير موجود');
    }

    const comment = await Comment.findOneAndUpdate(
      { user: userId, course: courseId },
      {
        $set: {
          text: text.trim(),
          rating: Number(rating),
          createdAt: new Date()
        }
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );

    await comment.populate('user', 'fullName');

    const ratingSummary = await Comment.syncCourseRating(courseId);

    return ApiResponse.created(res, 'تم حفظ تقييم الكورس بنجاح', { comment, ratingSummary });
  } catch (error) {
    console.error('Add comment error:', error);
    return ApiResponse.serverError(res, 'حدث خطأ أثناء إضافة التعليق');
  }
};

// Admin: Get all comments
exports.getAdminComments = async (req, res) => {
  try {
    const comments = await Comment.find()
      .populate('user', 'fullName')
      .populate('course', 'title')
      .sort({ createdAt: -1 });

    res.render('pages/admin/comments', {
      title: 'إدارة التعليقات',
      comments,
      layouts: 'admin'
    });
  } catch (error) {
    console.error('Admin comments error:', error);
    req.session.error_msg = 'حدث خطأ أثناء تحميل التعليقات';
    res.redirect('/admin/dashboard');
  }
};

// Admin: Delete comment
exports.deleteComment = async (req, res) => {
  try {
    const comment = await Comment.findByIdAndDelete(req.params.id);
    if (comment) {
      await Comment.syncCourseRating(comment.course);
    }
    req.flash('success_msg', 'تم حذف التعليق بنجاح');
    res.redirect('/admin/comments');
  } catch (error) {
    console.error('Delete comment error:', error);
    req.session.error_msg = 'حدث خطأ أثناء حذف التعليق';
    res.redirect('/admin/comments');
  }
};
