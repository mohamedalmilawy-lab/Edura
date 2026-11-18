const Joi = require('joi');
const ApiResponse = require('../utils/ApiResponse');

const stripSensitiveData = (body) => Object.keys(body).reduce((acc, key) => {
  if (/password|confirm|current/i.test(key)) return acc;
  acc[key] = body[key];
  return acc;
}, {});

const buildErrorFields = (details) => {
  const fields = {};
  details.forEach((detail) => {
    const path = detail.path && detail.path.length ? detail.path.join('.') : detail.context.key;
    if (!fields[path]) {
      fields[path] = detail.message;
    }
  });
  return fields;
};

const sendValidationError = (req, res, error, oldData) => {
  const errorMessages = error.details.map((detail) => detail.message);
  const errorFields = buildErrorFields(error.details);
  req.session.errors = errorMessages;
  req.session.errorFields = errorFields;
  req.session.oldData = oldData || stripSensitiveData(req.body);

  const wantsJson = req.xhr
    || req.originalUrl?.startsWith('/api')
    || req.headers.accept?.includes('application/json')
    || req.get('Content-Type')?.includes('application/json');
  if (wantsJson) {
    return ApiResponse.badRequest(res, errorMessages[0] || 'بيانات غير صالحة', {
      errors: errorMessages,
      errorFields
    });
  }

  const redirectUrl = req.get('Referer') || req.originalUrl || '/';
  return res.redirect(redirectUrl);
};

const validateBody = (schema, options = {}) => (req, res, next) => {
  const { value, error } = schema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true
  });
  if (error) {
    return sendValidationError(req, res, error, options.oldData || stripSensitiveData(req.body));
  }
  req.body = value;
  next();
};

module.exports = {
  validateBody
};
