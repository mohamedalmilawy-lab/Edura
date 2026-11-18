const Joi = require('joi');
const { validateBody } = require('./validationMiddleware');

const commentSchema = Joi.object({
  text: Joi.string().trim().min(3).required().messages({
    'string.empty': 'نص التعليق مطلوب',
    'string.min': 'نص التعليق قصير جداً',
    'any.required': 'نص التعليق مطلوب'
  })
});

const validateComment = validateBody(commentSchema);

module.exports = {
  validateComment
};
