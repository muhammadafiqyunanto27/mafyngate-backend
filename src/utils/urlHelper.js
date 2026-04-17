/**
 * Utility to ensure all media URLs are absolute.
 * This is critical for Railway/Vercel deployments where the frontend
 * needs the full path to the backend for local assets.
 */
const getAbsoluteUrl = (pathOrUrl) => {
  if (!pathOrUrl) return null;
  
  // If already absolute (Cloudinary / External), return as is
  if (pathOrUrl.startsWith('http')) return pathOrUrl;
  
  let baseUrl = 'http://localhost:5000';
  
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    baseUrl = `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  } else if (process.env.NODE_ENV === 'production' && process.env.BACKEND_URL) {
    baseUrl = process.env.BACKEND_URL;
  }
  
  const cleanPath = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
  return `${baseUrl}${cleanPath}`;
};

const getFrontendUrl = (path) => {
  const base = process.env.FRONTEND_URL || 'http://localhost:3000';
  const cleanPath = path ? (path.startsWith('/') ? path : `/${path}`) : '';
  return `${base}${cleanPath}`;
};

module.exports = { getAbsoluteUrl, getFrontendUrl };
