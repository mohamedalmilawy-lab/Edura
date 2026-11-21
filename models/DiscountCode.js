const mongoose = require('mongoose');

const discountCodeSchema = new mongoose.Schema({
  code: {
    type: String,
    required: [true, 'كود الخصم مطلوب'],
    unique: true,
    trim: true,
    uppercase: true,
    minlength: [3, 'كود الخصم قصير جداً'],
    maxlength: [50, 'كود الخصم طويل جداً']
  },
  discountType: {
    type: String,
    enum: ['percentage', 'fixed'],
    required: [true, 'نوع الخصم مطلوب']
  },
  discountValue: {
    type: Number,
    required: [true, 'قيمة الخصم مطلوبة'],
    min: [0.01, 'قيمة الخصم يجب أن تكون أكبر من صفر']
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  courses: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course'
  }],
  maxUses: {
    type: Number,
    default: null,
    min: [1, 'الحد الأقصى للاستخدام يجب أن يكون رقماً موجباً']
  },
  usedCount: {
    type: Number,
    default: 0,
    min: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  expiresAt: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

discountCodeSchema.pre('validate', function(next) {
  if (this.discountType === 'percentage' && this.discountValue > 100) {
    this.invalidate('discountValue', 'نسبة الخصم يجب ألا تتجاوز 100%');
  }
  next();
});

module.exports = mongoose.model('DiscountCode', discountCodeSchema);
