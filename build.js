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

// Use the actual client files - the app is now full-stack with Cloudflare Functions!
console.log('✅ Using actual client application with Cloudflare Functions API');

// No _redirects file needed for simple static site

        // Copy _headers file
        const headersPath = path.join(__dirname, '_headers');
        if (fs.existsSync(headersPath)) {
            fs.copyFileSync(headersPath, path.join(distDir, '_headers'));
            console.log('✅ Copied _headers file');
        }

        // Copy _routes.json file
        const routesPath = path.join(__dirname, '_routes.json');
        if (fs.existsSync(routesPath)) {
            fs.copyFileSync(routesPath, path.join(distDir, '_routes.json'));
            console.log('✅ Copied _routes.json file');
        }

// Copy functions directory for Cloudflare Pages Functions
const functionsSourceDir = path.join(__dirname, 'functions');
const functionsDestDir = path.join(distDir, 'functions');
if (fs.existsSync(functionsSourceDir)) {
    // Copy entire functions directory
    const copyRecursive = (src, dest) => {
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true });
        }
        const entries = fs.readdirSync(src, { withFileTypes: true });
        for (const entry of entries) {
            const srcPath = path.join(src, entry.name);
            const destPath = path.join(dest, entry.name);
            if (entry.isDirectory()) {
                copyRecursive(srcPath, destPath);
            } else {
                fs.copyFileSync(srcPath, destPath);
            }
        }
    };
    copyRecursive(functionsSourceDir, functionsDestDir);
    console.log('✅ Copied functions directory');
}

console.log('🎉 Build complete! Deploy with: wrangler pages deploy dist');
console.log('📝 Don\'t forget to set environment variables in Cloudflare dashboard');
