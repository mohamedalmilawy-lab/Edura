const Joi = require('joi');
const { validateBody } = require('./validationMiddleware');

const createUserSchema = Joi.object({
  fullName: Joi.string().trim().min(3).max(100).required().messages({
    'string.empty': 'الاسم الكامل مطلوب',
    'string.min': 'الاسم قصير جداً',
    'string.max': 'الاسم طويل جداً',
    'any.required': 'الاسم الكامل مطلوب'
  }),
  email: Joi.string().trim().email({ tlds: { allow: false } }).required().messages({
    'string.empty': 'البريد الإلكتروني مطلوب',
    'string.email': 'البريد الإلكتروني غير صالح',
    'any.required': 'البريد الإلكتروني مطلوب'
  }),
  password: Joi.string().min(8).required().messages({
    'string.empty': 'كلمة المرور مطلوبة',
    'string.min': 'كلمة المرور قصيرة جداً',
    'any.required': 'كلمة المرور مطلوبة'
  }),
  role: Joi.string().valid('student', 'teacher', 'admin').required().messages({
    'any.only': 'الدور غير صالح',
    'any.required': 'الدور مطلوب'
  })
});

const profileSchema = Joi.object({
  fullName: Joi.string().trim().min(3).max(100).required().messages({
    'string.empty': 'الاسم الكامل مطلوب',
    'string.min': 'الاسم قصير جداً',
    'string.max': 'الاسم طويل جداً',
    'any.required': 'الاسم الكامل مطلوب'
  }),
  email: Joi.string().trim().email({ tlds: { allow: false } }).required().messages({
    'string.empty': 'البريد الإلكتروني مطلوب',
    'string.email': 'البريد الإلكتروني غير صالح',
    'any.required': 'البريد الإلكتروني مطلوب'
  })
});

const passwordSchema = Joi.object({
  currentPassword: Joi.string().min(8).required().messages({
    'string.empty': 'كلمة السر الحالية مطلوبة',
    'string.min': 'كلمة السر الحالية قصيرة جداً',
    'any.required': 'كلمة السر الحالية مطلوبة'
  }),
  newPassword: Joi.string().min(8).required().messages({
    'string.empty': 'كلمة السر الجديدة مطلوبة',
    'string.min': 'كلمة السر الجديدة قصيرة جداً',
    'any.required': 'كلمة السر الجديدة مطلوبة'
  }),
  confirmPassword: Joi.any().valid(Joi.ref('newPassword')).required().messages({
    'any.only': 'كلمتا السر الجديدة غير متطابقتين',
    'any.required': 'تأكيد كلمة السر الجديدة مطلوب'
  })
});

const validateCreateUser = validateBody(createUserSchema);
const validateUserProfile = validateBody(profileSchema);
const validatePasswordChange = validateBody(passwordSchema);

module.exports = {
  validateCreateUser,
  validateUserProfile,
  validatePasswordChange
};
