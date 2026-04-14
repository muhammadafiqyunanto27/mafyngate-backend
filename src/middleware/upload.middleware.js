const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadBase = process.env.UPLOAD_PATH || 'uploads';
    cb(null, path.join(uploadBase, 'avatars'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'avatar-' + uniqueSuffix + ext);
  }
});

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
  storage: storage,
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB limit
  },
  fileFilter: fileFilter
});

module.exports = upload;
