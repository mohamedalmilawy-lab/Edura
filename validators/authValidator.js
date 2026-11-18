const Joi = require('joi');
const { validateBody } = require('./validationMiddleware');

const registerSchema = Joi.object({
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
  confirmPassword: Joi.any().valid(Joi.ref('password')).required().messages({
    'any.only': 'كلمتا السر غير متطابقتين',
    'any.required': 'تأكيد كلمة المرور مطلوب'
  })
});

const loginSchema = Joi.object({
  email: Joi.string().trim().email({ tlds: { allow: false } }).required().messages({
    'string.empty': 'البريد الإلكتروني مطلوب',
    'string.email': 'البريد الإلكتروني غير صالح',
    'any.required': 'البريد الإلكتروني مطلوب'
  }),
  password: Joi.string().required().messages({
    'string.empty': 'كلمة المرور مطلوبة',
    'any.required': 'كلمة المرور مطلوبة'
  })
});

const forgotPasswordSchema = Joi.object({
    email: Joi.string().email().trim().required()
});

const resetPasswordSchema = Joi.object({
    password: Joi.string().required().messages({
    'string.empty': 'كلمة المرور مطلوبة',
    'any.required': 'كلمة المرور مطلوبة'
  }),
    confirmPassword: Joi.string().valid(Joi.ref('password')).required().messages({
        'any.only': 'كلمة المرور وتأكيد كلمة المرور يجب أن تكون متطابقة',
    }),
});

const changePasswordSchema = Joi.object({
    oldPassword: Joi.string().required().messages({
        'string.empty': 'كلمة المرور القديمة مطلوبة',
        'any.required': 'كلمة المرور القديمة مطلوبة',
    }),
    newPassword: Joi.string().required().messages({
        'string.empty': 'كلمة المرور مطلوبة',
        'any.required': 'كلمة المرور مطلوبة',
    }),
    confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required().messages({
        'any.only': 'كلمة المرور وتأكيد كلمة المرور يجب أن تكون متطابقة',
        'string.empty': 'تأكيد كلمة المرور مطلوب',
        'any.required': 'تأكيد كلمة المرور مطلوب',
    }),
});

const validateRegister = validateBody(registerSchema);
const validateLogin = validateBody(loginSchema);
const validateForgot = validateBody(forgotPasswordSchema);
const validateReset = validateBody(resetPasswordSchema);
const validateChangePassword = validateBody(changePasswordSchema);

module.exports = {
  validateRegister,
  validateLogin,
  validateForgot,
  validateReset,
  validateChangePassword
};
