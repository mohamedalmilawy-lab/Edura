const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  },
  text: {
    type: String,
    required: [true, 'نص التعليق مطلوب'],
    trim: true
  },
  rating: {
    type: Number,
    required: [true, 'تقييم الكورس مطلوب'],
    min: [1, 'التقييم يجب أن يكون من 1 إلى 5'],
    max: [5, 'التقييم يجب أن يكون من 1 إلى 5']
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

commentSchema.index({ user: 1, course: 1 }, { unique: true });

commentSchema.statics.getRatingSummaries = async function(courseIds) {
  const ids = courseIds
    .map(id => id._id ? id._id : id)
    .filter(Boolean)
    .map(id => typeof id === 'string' && mongoose.isValidObjectId(id)
      ? new mongoose.Types.ObjectId(id)
      : id);
  if (ids.length === 0) return {};

  const rows = await this.aggregate([
    {
      $match: {
        course: { $in: ids },
        rating: { $gte: 1, $lte: 5 }
      }
    },
    {
      $group: {
        _id: '$course',
        averageRating: { $avg: '$rating' },
        ratingCount: { $sum: 1 }
      }
    }
  ]);

  return rows.reduce((summaries, row) => {
    summaries[row._id.toString()] = {
      averageRating: Math.round(row.averageRating * 10) / 10,
      ratingCount: row.ratingCount
    };
    return summaries;
  }, {});
};

commentSchema.statics.getCourseIdsWithMinimumRating = async function(minimumRating) {
  const rows = await this.aggregate([
    {
      $match: {
        rating: { $gte: 1, $lte: 5 }
      }
    },
    {
      $group: {
        _id: '$course',
        averageRating: { $avg: '$rating' }
      }
    },
    {
      $match: {
        averageRating: { $gte: minimumRating }
      }
    },
    {
      $project: { _id: 1 }
    }
  ]);

  return rows.map(row => row._id);
};

commentSchema.statics.syncCourseRating = async function(courseId) {
  const summaries = await this.getRatingSummaries([courseId]);
  const ratingSummary = summaries[courseId.toString()] || { averageRating: 0, ratingCount: 0 };

  await mongoose.model('Course').updateOne(
    { _id: courseId },
    { $set: { rating: ratingSummary.averageRating } }
  );

  return ratingSummary;
};

module.exports = mongoose.model('Comment', commentSchema);
