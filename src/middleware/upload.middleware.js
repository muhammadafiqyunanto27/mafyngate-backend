const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');
const path = require('path');

// 1. Storage Configuration (Lokal/Railway as fallback)
const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadBase = process.env.UPLOAD_PATH || 'uploads';
    // Dynamically choose folder based on fieldname or route
    const subfolder = req.originalUrl.includes('/chat') ? 'chat' : 'avatars';
    cb(null, path.join(uploadBase, subfolder));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'file-' + uniqueSuffix + ext);
  }
});

// 2. Cloudinary Storage Configuration (Primary)
const cloudinaryStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    const isChat = req.originalUrl.includes('/chat');
    const folder = isChat ? 'mafyngate/chat' : 'mafyngate/avatars';
    
    // Determine format from mimetype
    const format = file.mimetype.split('/')[1];
    
    return {
      folder: folder,
      resource_type: 'auto', // Auto handles images, videos, audio (VN)
      public_id: `file-${Date.now()}-${Math.round(Math.random() * 1E9)}`,
    };
  },
});

const fileFilter = (req, file, cb) => {
  // Allow images, video, and audio (for VNs)
  const allowedMimes = [
    'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
    'video/mp4', 'video/quicktime', 'video/webm',
    'audio/mpeg', 'audio/wav', 'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/aac', 'audio/m4a'
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Tipe file ${file.mimetype} tidak didukung.`));
  }
};

const useCloudinary = process.env.USE_CLOUDINARY === 'true';

// Log storage status on init
if (useCloudinary) {
  console.log('✅ [Storage] Cloudinary is ACTIVE (Persistent)');
} else {
  console.warn('⚠️ [Storage] Local Disk is ACTIVE (NOT Persistent on Railway/Heroku)');
}

const upload = multer({
  storage: useCloudinary ? cloudinaryStorage : diskStorage,
  limits: {
    fileSize: 20 * 1024 * 1024 // Increased to 20MB for better support
  },
  fileFilter: fileFilter
});

module.exports = upload;
