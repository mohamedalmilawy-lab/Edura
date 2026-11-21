const Joi = require('joi');
const { validateBody } = require('./validationMiddleware');

const discountCodeSchema = Joi.object({
  code: Joi.string().trim().min(3).max(50).required().messages({
    'string.empty': 'كود الخصم مطلوب',
    'string.min': 'كود الخصم قصير جداً',
    'string.max': 'كود الخصم طويل جداً',
    'any.required': 'كود الخصم مطلوب'
  }),
  discountType: Joi.string().valid('percentage', 'fixed').required().messages({
    'any.only': 'نوع الخصم غير صالح',
    'any.required': 'نوع الخصم مطلوب'
  }),
  discountValue: Joi.number().positive().required().messages({
    'number.base': 'قيمة الخصم يجب أن تكون رقماً',
    'number.positive': 'قيمة الخصم يجب أن تكون أكبر من صفر',
    'any.required': 'قيمة الخصم مطلوبة'
  }),
  scope: Joi.string().valid('all', 'courses').default('all'),
  courses: Joi.array().items(Joi.string().hex().length(24)).single().default([]),
  maxUses: Joi.alternatives().try(
    Joi.number().integer().min(1),
    Joi.valid('', null)
  ).default(null),
  isActive: Joi.any().optional(),
  expiresAt: Joi.alternatives().try(Joi.date(), Joi.valid('', null)).default(null)
});

const validateDiscountCode = validateBody(discountCodeSchema);

module.exports = { validateDiscountCode };
