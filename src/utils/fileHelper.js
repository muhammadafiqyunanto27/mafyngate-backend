const path = require('path');
const fs = require('fs');
const { cloudinary } = require('../config/cloudinary');

/**
 * Enhanced file deletion utility that handles both Local and Cloudinary storage.
 * @param {string} fileUrlOrPath - The full URL (Cloudinary) or relative path (Local)
 */
const deleteFile = async (fileUrlOrPath) => {
  if (!fileUrlOrPath) return;

  try {
    // 1. Handle Cloudinary deletion
    if (fileUrlOrPath.includes('cloudinary.com')) {
      // Extract public_id from URL
      // Example: https://res.cloudinary.com/cloudname/image/upload/v12345/folder/public_id.jpg
      const parts = fileUrlOrPath.split('/');
      const lastPart = parts[parts.length - 1]; // public_id.jpg
      const publicIdWithExtension = lastPart.split('.');
      const publicId = publicIdWithExtension[0];
      
      // If there are folders, we need to extract from "upload/v..." onwards
      // Simplified approach: find the folder segment if possible
      const uploadIndex = parts.indexOf('upload');
      if (uploadIndex !== -1) {
        // parts[uploadIndex + 1] is 'vXXXX'
        // parts from uploadIndex + 2 to end is the public_id WITH folder
        const pathParts = parts.slice(uploadIndex + 2);
        const fullPathWithExt = pathParts.join('/'); 
        const publicIdFullPath = fullPathWithExt.split('.')[0];

        // Determine resource type (raw for files, image for images, video for video/audio)
        let resourceType = 'image';
        if (fileUrlOrPath.includes('/video/upload/')) resourceType = 'video';
        if (fileUrlOrPath.includes('/raw/upload/')) resourceType = 'raw';

        await cloudinary.uploader.destroy(publicIdFullPath, { resource_type: resourceType });
        console.log(`[FileHelper] Deleted from Cloudinary: ${publicIdFullPath} (${resourceType})`);
      }
      return;
    }

    // 2. Handle Local deletion (Legacy)
    if (fileUrlOrPath.startsWith('/uploads/')) {
      const absolutePath = path.join(__dirname, '../../', fileUrlOrPath);
      if (fs.existsSync(absolutePath)) {
        fs.unlinkSync(absolutePath);
        console.log(`[FileHelper] Deleted from local storage: ${fileUrlOrPath}`);
      }
    }
  } catch (err) {
    console.error(`[FileHelper] Error deleting file ${fileUrlOrPath}:`, err.message);
  }
};

module.exports = { deleteFile };
