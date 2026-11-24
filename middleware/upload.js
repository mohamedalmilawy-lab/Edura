const multer = require('multer');
const path = require('path');

// Storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.resolve(__dirname, '..', 'public', 'uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  const allowedExtensions = ['.jpeg', '.jpg', '.png', '.webp', '.gif'];
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  const extname = allowedExtensions.includes(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedMimeTypes.includes(file.mimetype.toLowerCase());
  
  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb(new Error('Only image files are allowed (jpeg, jpg, png, webp, gif)'));
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 1 * 1024 * 1024 // 1MB limit
  },
  fileFilter: fileFilter
});

const pdfStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.resolve(__dirname, '..', 'public', 'uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    if (file.fieldname === 'image') {
      cb(null, 'image-' + uniqueSuffix + path.extname(file.originalname).toLowerCase());
    } else {
      cb(null, 'course-pdf-' + uniqueSuffix + '.pdf');
    }
  }
});

const pdfUpload = multer({
  storage: pdfStorage,
  limits: {
    fileSize: 20 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'image') {
      const allowedTypes = /jpeg|jpg|png|webp|gif/;
      if (allowedTypes.test(path.extname(file.originalname).toLowerCase()) && allowedTypes.test(file.mimetype)) {
        return cb(null, true);
      }
      return cb(new Error('يسمح برفع صور فقط'));
    }
    if (file.fieldname === 'pdfs' && path.extname(file.originalname).toLowerCase() === '.pdf' && file.mimetype === 'application/pdf') {
      return cb(null, true);
    }
    cb(new Error('يسمح برفع ملفات PDF فقط'));
  }
});

module.exports = upload;
module.exports.pdfUpload = pdfUpload;
