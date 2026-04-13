const multer = require('multer');
const { avatarStorage } = require('../config/cloudinary');

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|webp/;
  const isImage = allowedTypes.test(file.mimetype) || allowedTypes.test(file.originalname.toLowerCase());

  if (isImage) {
    cb(null, true);
  } else {
    cb(new Error('Hanya diperbolehkan mengupload gambar (jpeg, jpg, png, webp)'));
  }
};

const upload = multer({
  storage: avatarStorage,
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB limit
  },
  fileFilter: fileFilter
});

module.exports = upload;
