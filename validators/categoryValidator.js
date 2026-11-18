const Joi = require('joi');
const { validateBody } = require('./validationMiddleware');

const categorySchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required().messages({
    'string.empty': 'اسم التصنيف مطلوب',
    'string.min': 'اسم التصنيف قصير جداً',
    'string.max': 'اسم التصنيف طويل جداً',
    'any.required': 'اسم التصنيف مطلوب'
  }),
  description: Joi.string().trim().max(500).allow('').messages({
    'string.max': 'الوصف طويل جداً'
  }),
  icon: Joi.string().trim().max(100).allow('').messages({
    'string.max': 'رمز الأيقونة طويل جداً'
  })
});

const validateCategory = validateBody(categorySchema);

module.exports = {
  validateCategory
};
