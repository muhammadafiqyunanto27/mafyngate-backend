const multer = require('multer');
const { chatStorage } = require('../config/cloudinary');

const fileFilter = (req, file, cb) => {
  // Allow images, videos, audio, and common documents
  const allowedExtensions = /jpeg|jpg|png|webp|gif|mp4|webm|pdf|doc|docx|zip|mp3|wav|txt/;
  const isSupported = allowedExtensions.test(file.originalname.toLowerCase()) || 
                      /image|video|audio|application\/pdf|application\/msword|application\/vnd.openxmlformats-officedocument.wordprocessingml.document|application\/zip|text\/plain/.test(file.mimetype);

  if (isSupported) {
    cb(null, true);
  } else {
    cb(new Error('File type not supported for chat attachments'));
  }
};

const chatUpload = multer({
  storage: chatStorage,
  limits: {
    fileSize: 20 * 1024 * 1024 // 20MB limit
  },
  fileFilter: fileFilter
});

module.exports = chatUpload;
