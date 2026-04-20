const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');
const path = require('path');

// 1. Storage Configuration (Local as fallback)
const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadBase = process.env.UPLOAD_PATH || 'uploads';
    cb(null, path.join(uploadBase, 'chat'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    let ext = path.extname(file.originalname);
    
    // Fallback for blobs without extension (Voice Notes)
    if (!ext || ext === '.') {
      if (file.mimetype.startsWith('audio/')) ext = '.' + file.mimetype.split('/')[1].split(';')[0];
      else if (file.mimetype === 'image/jpeg') ext = '.jpg';
      else if (file.mimetype === 'image/png') ext = '.png';
    }
    
    cb(null, 'chat-' + uniqueSuffix + ext);
  }
});

// 2. Cloudinary Storage Configuration (Primary)
const cloudinaryStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    return {
      folder: 'mafyngate/chat',
      resource_type: 'auto', // MUST BE AUTO for Videos/Audio
      public_id: `chat-${Date.now()}-${Math.round(Math.random() * 1E9)}`,
    };
  },
});

const useCloudinary = process.env.USE_CLOUDINARY === 'true';

// Log storage status on init
if (useCloudinary) {
  console.log('✅ [Storage:Chat] Cloudinary is ACTIVE (Persistent)');
} else {
  console.warn('⚠️ [Storage:Chat] Local Disk is ACTIVE (NOT Persistent on Railway)');
}

const chatUpload = multer({
  storage: useCloudinary ? cloudinaryStorage : diskStorage,
  limits: {
    fileSize: 20 * 1024 * 1024 // 20MB
  }
});

module.exports = chatUpload;
