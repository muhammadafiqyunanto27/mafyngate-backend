const path = require('path');
const fs = require('fs');

/**
 * Enhanced file deletion utility that handles Local storage.
 * @param {string} fileUrlOrPath - The full URL (ignored if external) or relative path (Local)
 */
const deleteFile = async (fileUrlOrPath) => {
  if (!fileUrlOrPath) return;

  try {
    // We only handle local deletion now. 
    // If the path starts with http, it might be an old Cloudinary URL (ignore)
    if (fileUrlOrPath.startsWith('http')) {
      console.log(`[FileHelper] Skipping external/legacy URL: ${fileUrlOrPath}`);
      return;
    }

    // Handle Local deletion
    // The path in DB is relative to the project root (e.g., 'uploads/avatars/...')
    const absolutePath = path.resolve(fileUrlOrPath);
    
    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
      console.log(`[FileHelper] Deleted from local storage: ${fileUrlOrPath}`);
    } else {
      console.warn(`[FileHelper] File not found: ${absolutePath}`);
    }
  } catch (err) {
    console.error(`[FileHelper] Error deleting file ${fileUrlOrPath}:`, err.message);
  }
};

module.exports = { deleteFile };
