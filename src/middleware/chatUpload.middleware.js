const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadBase = process.env.UPLOAD_PATH || 'uploads';
    cb(null, path.join(uploadBase, 'chat'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    let ext = path.extname(file.originalname);
    
    // Fallback for blobs without extension (usually Voice Notes)
    if (!ext || ext === '.') {
      if (file.mimetype.startsWith('audio/')) {
        ext = '.' + file.mimetype.split('/')[1].split(';')[0]; // handle audio/webm;codecs=opus -> .webm
      } else if (file.mimetype === 'image/jpeg') ext = '.jpg';
      else if (file.mimetype === 'image/png') ext = '.png';
      else if (file.mimetype === 'application/pdf') ext = '.pdf';
    }
    
    cb(null, 'chat-' + uniqueSuffix + ext);
  }
});

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
  storage: storage,
  limits: {
    fileSize: 20 * 1024 * 1024 // 20MB limit
  },
  fileFilter: fileFilter
});

module.exports = chatUpload;
