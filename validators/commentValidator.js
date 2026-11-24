const Joi = require('joi');
const { validateBody } = require('./validationMiddleware');

const commentSchema = Joi.object({
  text: Joi.string().trim().min(3).required().messages({
    'string.empty': 'نص التعليق مطلوب',
    'string.min': 'نص التعليق قصير جداً',
    'any.required': 'نص التعليق مطلوب'
  }),
  rating: Joi.number().integer().min(1).max(5).required().messages({
    'number.base': 'التقييم يجب أن يكون رقماً من 1 إلى 5',
    'number.integer': 'التقييم يجب أن يكون من 1 إلى 5',
    'number.min': 'التقييم يجب أن يكون من 1 إلى 5',
    'number.max': 'التقييم يجب أن يكون من 1 إلى 5',
    'any.required': 'التقييم مطلوب'
  })
});

const validateComment = validateBody(commentSchema);

module.exports = {
  validateComment
};
