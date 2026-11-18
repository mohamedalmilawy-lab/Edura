const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'عنوان الكورس مطلوب'],
    trim: true
  },
  description: {
    type: String,
    required: [true, 'وصف الكورس مطلوب'],
    trim: true
  },
  price: {
    type: Number,
    required: [true, 'سعر الكورس مطلوب'],
    min: [0, 'السعر لا يمكن أن يكون سالباً']
  },
  image: {
    type: String,
    default: '/uploads/default-course.jpg'
  },
  videos: {
    type: [String],
    default: []
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'تصنيف الكورس مطلوب']
  },
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'مدرس الكورس مطلوب']
  },
  status: {
    type: String,
    enum: ['available', 'unavailable'],
    default: 'available'
  },
  enrolledCount: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Course', courseSchema);
