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
  pdfs: {
    type: [{
      title: { type: String, trim: true },
      url: { type: String, required: true }
    }],
    default: []
  },
  exams: {
    type: [{
      title: { type: String, trim: true },
      questions: {
        type: [{
          question: { type: String, trim: true, required: true },
          choices: {
            type: [String],
            validate: {
              validator: choices => choices.length >= 2 && choices.length <= 6,
              message: 'يجب إدخال خيارين على الأقل'
            }
          },
          correctChoice: {
            type: Number,
            required: true,
            min: 0
          }
        }],
        default: []
      }
    }],
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
  // نسبة خصم مئوية (0–100). مثال: 20 يعني خصم 20% على سعر الكورس.
  offerPrice: {
      type: Number,
      min: [0, 'نسبة الخصم لا يمكن أن تكون سالبة.'],
      max: [100, 'نسبة الخصم لا يمكن أن تتجاوز 100%.']
  },
  // تاريخ انتهاء العرض — إذا مرّ هذا التاريخ تُهمَل نسبة الخصم تلقائياً
  offerEndDate: {
      type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// هل العرض فعّال حالياً؟ (نسبة خصم موجودة وتاريخ الانتهاء لم يمرّ بعد)
courseSchema.virtual('hasActiveOffer').get(function () {
  if (!this.offerPrice || this.offerPrice <= 0) return false;
  if (this.offerEndDate && this.offerEndDate <= new Date()) return false;
  return true;
});

// السعر الفعلي بعد تطبيق نسبة الخصم إن كان العرض فعّالاً
courseSchema.virtual('effectivePrice').get(function () {
  if (!this.hasActiveOffer) return this.price;
  return Math.round(this.price * (100 - this.offerPrice)) / 100;
});

courseSchema.set('toJSON', { virtuals: true });
courseSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Course', courseSchema);
