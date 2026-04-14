/**
 * Utility to ensure all media URLs are absolute.
 * This is critical for Railway/Vercel deployments where the frontend
 * needs the full path to the backend for local assets.
 */
const getAbsoluteUrl = (pathOrUrl) => {
  if (!pathOrUrl) return null;
  
  // If already absolute (Cloudinary / External), return as is
  if (pathOrUrl.startsWith('http')) return pathOrUrl;
  
  // Prepend backend URL for local assets
  const baseUrl = process.env.BACKEND_URL || 'http://localhost:5000';
  
  // Ensure we don't double slash
  const cleanPath = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
  return `${baseUrl}${cleanPath}`;
};

module.exports = { getAbsoluteUrl };
