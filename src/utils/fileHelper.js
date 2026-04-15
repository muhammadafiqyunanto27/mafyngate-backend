const path = require('path');
const fs = require('fs');
const cloudinary = require('../config/cloudinary');

/**
 * Enhanced file deletion utility that handles both Local and Cloudinary storage.
 * @param {string} fileUrlOrPath - The full URL (Cloudinary) or relative path (Local)
 */
const deleteFile = async (fileUrlOrPath) => {
  if (!fileUrlOrPath) return;

  try {
    // 1. Handle Cloudinary Deletion
    if (fileUrlOrPath.startsWith('http') && fileUrlOrPath.includes('cloudinary.com')) {
      console.log(`[FileHelper] Attempting to delete from Cloudinary: ${fileUrlOrPath}`);
      
      // Extract public_id from URL
      // URL format: https://res.cloudinary.com/cloudname/image/upload/v12345/folder/public_id.jpg
      const parts = fileUrlOrPath.split('/');
      const lastPart = parts[parts.length - 1];
      const filename = lastPart.split('.')[0];
      
      // The public_id includes the folder path if present
      const uploadIndex = parts.indexOf('upload');
      if (uploadIndex !== -1) {
        // public_id is everything after 'v12345/' or 'upload/' until the extension
        // e.g., 'mafyngate/avatars/file-123'
        const publicIdWithExt = parts.slice(uploadIndex + 2).join('/');
        const publicId = publicIdWithExt.split('.')[0];
        
        console.log(`[FileHelper] Extracted Public ID: ${publicId}`);
        
        await cloudinary.uploader.destroy(publicId);
        console.log(`[FileHelper] Succesfully deleted from Cloudinary.`);
      }
      return;
    }

    // 2. Handle Local deletion
    // If it starts with http but isn't Cloudinary, ignore
    if (fileUrlOrPath.startsWith('http')) {
      return;
    }

    const absolutePath = path.resolve(fileUrlOrPath);
    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
      console.log(`[FileHelper] Deleted from local storage: ${fileUrlOrPath}`);
    }
  } catch (err) {
    console.error(`[FileHelper] Error deleting file ${fileUrlOrPath}:`, err.message);
  }
};

module.exports = { deleteFile };
