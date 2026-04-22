const fs = require('fs');
const filePath = 'd:/mafynGate/backend/src/modules/user/user.controller.js';
let content = fs.readFileSync(filePath, 'utf8');

const downloadMethod = `
  async downloadFile(req, res, next) {
    try {
      const { url } = req.query;
      if (!url) return res.status(400).json({ success: false, message: 'URL is required' });

      console.log(\`[Download] Proxying request for: \${url}\`);

      // 1. Handle Local Files
      if (!url.startsWith('http')) {
        const path = require('path');
        const fs = require('fs');
        const absolutePath = path.resolve(url);
        
        if (!fs.existsSync(absolutePath)) {
          return res.status(404).json({ success: false, message: 'File not found' });
        }

        const filename = path.basename(absolutePath);
        res.setHeader('Content-Disposition', \`attachment; filename="\${filename}"\`);
        return res.sendFile(absolutePath);
      }

      // 2. Handle External Files (Cloudinary, etc)
      const response = await fetch(url);
      if (!response.ok) throw new Error(\`Failed to fetch file: \${response.statusText}\`);

      const contentType = response.headers.get('content-type');
      const filename = url.split('/').pop().split('?')[0] || 'download';
      
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', \`attachment; filename="\${filename}"\`);

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      res.send(buffer);

    } catch (error) {
      console.error('[Download] Error:', error.message);
      next(error);
    }
  }
`;

// Insert before the last closing brace
const lastBraceIndex = content.lastIndexOf('}');
if (lastBraceIndex !== -1) {
    const newContent = content.substring(0, lastBraceIndex) + downloadMethod + '\n' + content.substring(lastBraceIndex);
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log('SUCCESS: Added downloadFile method to UserController.');
} else {
    console.error('FAILED: Could not find the closing brace of the class.');
    process.exit(1);
}
