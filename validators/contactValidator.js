const Joi = require('joi');
const { validateBody } = require('./validationMiddleware');

const contactSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).optional().messages({
    'string.empty': 'الاسم مطلوب',
    'string.min': 'الاسم قصير جداً',
    'string.max': 'الاسم طويل جداً'
  }),
  email: Joi.string().trim().email({ tlds: { allow: false } }).optional().messages({
    'string.empty': 'البريد الإلكتروني مطلوب',
    'string.email': 'البريد الإلكتروني غير صالح'
  }),
  subject: Joi.string().trim().min(3).max(150).required().messages({
    'string.empty': 'الموضوع مطلوب',
    'string.min': 'الموضوع قصير جداً',
    'string.max': 'الموضوع طويل جداً',
    'any.required': 'الموضوع مطلوب'
  }),
  message: Joi.string().trim().min(5).max(2000).required().messages({
    'string.empty': 'الرسالة مطلوبة',
    'string.min': 'الرسالة قصيرة جداً',
    'string.max': 'الرسالة طويلة جداً',
    'any.required': 'الرسالة مطلوبة'
  })
});

const validateContact = validateBody(contactSchema);

module.exports = {
  validateContact
};
