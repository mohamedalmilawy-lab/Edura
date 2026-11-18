const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ApiResponse = require('../utils/ApiResponse');

const JWT_SECRET = process.env.JWT_SECRET || 'edura_jwt_default_secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// Generate a signed JWT for a given user document
const signToken = (user) => jwt.sign(
  { id: user._id.toString(), role: user.role, tokenVersion: user.tokenVersion || 0 },
  JWT_SECRET,
  { expiresIn: JWT_EXPIRES_IN }
);

// Extract the bearer token from the Authorization header
const extractToken = (req) => {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) {
    return header.slice(7).trim();
  }
  return null;
};

// Require a valid JWT; attaches the user document to req.user
const protect = async (req, res, next) => {
  const token = extractToken(req);
  if (!token) {
    return ApiResponse.unauthorized(res, 'يجب تسجيل الدخول أولاً');
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return ApiResponse.unauthorized(res, 'المستخدم غير موجود');
    }
    if ((decoded.tokenVersion || 0) !== (user.tokenVersion || 0)) {
      return ApiResponse.unauthorized(res, 'رمز الدخول غير صالح أو منتهي الصلاحية');
    }
    req.user = user;
    return next();
  } catch (error) {
    return ApiResponse.unauthorized(res, 'رمز الدخول غير صالح أو منتهي الصلاحية');
  }
};

// Attach the user when a valid token is present, otherwise continue as guest
const optionalAuth = async (req, res, next) => {
  const token = extractToken(req);
  if (!token) return next();

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (user && (decoded.tokenVersion || 0) === (user.tokenVersion || 0)) req.user = user;
  } catch (error) {
    // Ignore invalid tokens for optional authentication
  }
  return next();
};

module.exports = {
  signToken,
  protect,
  optionalAuth
};
