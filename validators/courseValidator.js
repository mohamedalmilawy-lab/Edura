const Joi = require('joi');
const { validateBody } = require('./validationMiddleware');

const courseSchema = Joi.object({
  title: Joi.string().trim().min(3).max(200).required().messages({
    'string.empty': 'عنوان الكورس مطلوب',
    'string.min': 'عنوان الكورس قصير جداً',
    'string.max': 'عنوان الكورس طويل جداً',
    'any.required': 'عنوان الكورس مطلوب'
  }),
  description: Joi.string().trim().min(10).max(3000).required().messages({
    'string.empty': 'الوصف مطلوب',
    'string.min': 'الوصف قصير جداً',
    'string.max': 'الوصف طويل جداً',
    'any.required': 'الوصف مطلوب'
  }),
  price: Joi.number().min(0).required().messages({
    'number.base': 'السعر يجب أن يكون رقماً',
    'number.min': 'السعر لا يمكن أن يكون سالباً',
    'any.required': 'السعر مطلوب'
  }),
  category: Joi.string().trim().required().messages({
    'string.empty': 'التصنيف مطلوب',
    'any.required': 'التصنيف مطلوب'
  }),
  status: Joi.string().valid('available', 'unavailable').required().messages({
    'any.only': 'الحالة غير صحيحة',
    'any.required': 'الحالة مطلوبة'
  }),
  teacher: Joi.string().trim().optional().allow(''),
  videos: Joi.any().optional()
});

const validateAdminCourse = validateBody(courseSchema);
const validateTeacherCourse = validateBody(courseSchema);

module.exports = {
  validateAdminCourse,
  validateTeacherCourse
};
