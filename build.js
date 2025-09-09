const fs = require('fs');
const path = require('path');

// Create dist directory
const distDir = path.join(__dirname, 'dist');
if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
}

// Copy client files
const clientFiles = ['index.html', 'styles.css', 'app.js'];
const clientDir = path.join(__dirname, 'client');

clientFiles.forEach(file => {
    const srcPath = path.join(clientDir, file);
    const destPath = path.join(distDir, file);
    if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, destPath);
    }
});

// Copy configuration files
const configFiles = ['_headers', '_routes.json'];
configFiles.forEach(file => {
    const srcPath = path.join(__dirname, file);
    const destPath = path.join(distDir, file);
    if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, destPath);
    }
});

// Copy functions directory
const functionsSourceDir = path.join(__dirname, 'functions');
const functionsDestDir = path.join(distDir, 'functions');

if (fs.existsSync(functionsSourceDir)) {
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
}