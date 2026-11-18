const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'الاسم مطلوب'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'البريد الإلكتروني مطلوب'],
    trim: true
  },
  subject: {
    type: String,
    required: [true, 'الموضوع مطلوب'],
    trim: true
  },
  message: {
    type: String,
    required: [true, 'الرسالة مطلوبة'],
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Contact', contactSchema);
