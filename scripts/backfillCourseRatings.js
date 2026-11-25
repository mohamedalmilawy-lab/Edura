require('dotenv').config();
const mongoose = require('mongoose');
const Comment = require('../models/Comment');
const Course = require('../models/Course');

async function backfillCourseRatings() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    const summaries = await Comment.aggregate([
      { $match: { rating: { $gte: 1, $lte: 5 } } },
      {
        $group: {
          _id: '$course',
          averageRating: { $avg: '$rating' }
        }
      }
    ]);

    const updates = summaries.map(({ _id, averageRating }) => ({
      updateOne: {
        filter: { _id },
        update: { $set: { rating: Math.round(averageRating * 10) / 10 } }
      }
    }));

    if (updates.length > 0) {
      await Course.bulkWrite(updates);
    }

    await Course.updateMany(
      { _id: { $nin: summaries.map(summary => summary._id) } },
      { $set: { rating: 0 } }
    );

    console.log(`Updated ratings for ${summaries.length} courses.`);
  } catch (error) {
    console.error('Course rating backfill failed:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

backfillCourseRatings();
