const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const avatarStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'mafyngate/avatars',
    allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
    transformation: [{ width: 500, height: 500, crop: 'limit' }],
  },
});

const chatStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: (req, file) => {
    const isImage = file.mimetype.startsWith('image');
    const isVideo = file.mimetype.startsWith('video');
    const isAudio = file.mimetype.startsWith('audio');
    
    let resourceType = 'raw'; // Default for documents/zip
    if (isImage) resourceType = 'image';
    if (isVideo) resourceType = 'video';
    if (isAudio) resourceType = 'video'; // Cloudinary treats audio as 'video' resource type for many operations

    return {
      folder: 'mafyngate/chat',
      resource_type: resourceType,
      public_id: `chat-${Date.now()}-${Math.round(Math.random() * 1e9)}`,
    };
  },
});

module.exports = {
  cloudinary,
  avatarStorage,
  chatStorage,
};
