#!/usr/bin/env node
// Build script for Cloudflare Pages deployment

const fs = require('fs');
const path = require('path');

console.log('🏗️  Building for Cloudflare Pages...');

// Create dist directory
const distDir = path.join(__dirname, 'dist');
if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
}

// Copy client files to dist
const clientDir = path.join(__dirname, 'client');
const clientFiles = ['index.html', 'styles.css', 'app.js'];

clientFiles.forEach(file => {
    const srcPath = path.join(clientDir, file);
    const destPath = path.join(distDir, file);
    
    if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, destPath);
        console.log(`✅ Copied ${file}`);
    } else {
        console.log(`⚠️  ${file} not found`);
    }
});

// Create a simple client-only version for now
// Since we don't have a separate API server deployed yet,
// we'll create a notice page
const noticePage = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dave's Links - Setup Required</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f5f5f5;
            margin: 0;
            padding: 40px 20px;
            text-align: center;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 { color: #ef4056; margin-bottom: 20px; }
        .step { text-align: left; margin: 20px 0; padding: 15px; background: #f9f9f9; border-radius: 4px; }
        .step h3 { margin-top: 0; color: #333; }
        code { background: #e8e8e8; padding: 2px 6px; border-radius: 3px; font-family: 'Courier New', monospace; }
        .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 4px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔗 Dave's Links</h1>
        <div class="warning">
            <strong>⚠️ Setup Required</strong><br>
            This is a full-stack application that requires both frontend and backend deployment.
        </div>
        
        <div class="step">
            <h3>📋 What you need to do:</h3>
            <p>1. <strong>Deploy the API server</strong> to a Node.js hosting platform (Heroku, Railway, DigitalOcean, etc.)</p>
            <p>2. <strong>Update the client</strong> to point to your deployed API</p>
            <p>3. <strong>Redeploy this frontend</strong> with the correct API URL</p>
        </div>
        
        <div class="step">
            <h3>🚀 Quick Deploy Options:</h3>
            <p><strong>Heroku:</strong> <code>git push heroku main</code></p>
            <p><strong>Railway:</strong> Connect your GitHub repo</p>
            <p><strong>DigitalOcean App Platform:</strong> Import from GitHub</p>
        </div>
        
        <div class="step">
            <h3>🔧 Local Development:</h3>
            <p>Run <code>npm run dev</code> in your project directory</p>
            <p>Visit <code>http://localhost:3000</code></p>
        </div>
        
        <p style="margin-top: 30px; color: #666;">
            This static deployment shows the frontend only. The full app requires a Node.js server for authentication and data storage.
        </p>
    </div>
</body>
</html>`;

fs.writeFileSync(path.join(distDir, 'index.html'), noticePage);
console.log('✅ Created setup notice page');

// Create _redirects file for SPA routing
const redirectsContent = `# Cloudflare Pages redirects
/*    /index.html   200
`;

fs.writeFileSync(path.join(distDir, '_redirects'), redirectsContent);
console.log('✅ Created _redirects file');

// Create functions directory for serverless functions
const functionsDir = path.join(distDir, 'functions');
if (!fs.existsSync(functionsDir)) {
    fs.mkdirSync(functionsDir, { recursive: true });
}

console.log('🎉 Build complete! Deploy with: wrangler pages deploy dist');
console.log('📝 Don\'t forget to set environment variables in Cloudflare dashboard');
