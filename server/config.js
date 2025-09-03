// Server Configuration
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const config = {
    // Server settings
    port: process.env.PORT || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
    
    // JSONBin Configuration
    jsonbin: {
        apiKey: process.env.JSONBIN_API_KEY,
        linksBinId: process.env.LINKS_BIN_ID,
        authBinId: process.env.AUTH_BIN_ID,
        baseUrl: 'https://api.jsonbin.io/v3/b'
    },
    
    // JWT Configuration
    jwt: {
        secret: process.env.JWT_SECRET,
        expiresIn: '7d'
    },
    
    // CORS Configuration
    cors: {
        origin: process.env.CLIENT_URL || 'http://localhost:3000',
        credentials: true
    },
    
    // Rate limiting
    rateLimit: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100 // limit each IP to 100 requests per windowMs
    }
};

// Debug environment loading (only in development)
if (process.env.NODE_ENV === 'development') {
    const envPath = path.join(__dirname, '.env');
    const fs = require('fs');
    
    if (fs.existsSync(envPath)) {
        console.log('✅ .env file found at:', envPath);
    } else {
        console.log('⚠️  .env file not found at:', envPath);
        console.log('💡 Run "npm run setup" to create it');
    }
}

// Validation
const requiredEnvVars = ['JSONBIN_API_KEY', 'LINKS_BIN_ID', 'AUTH_BIN_ID', 'JWT_SECRET'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:', missingVars);
    console.error('📋 Available variables:', Object.keys(process.env).filter(key => key.includes('JSONBIN') || key.includes('JWT')));
    console.error('🔧 Please run "npm run setup" to configure environment');
    process.exit(1);
}

// Success message (only in development)
if (process.env.NODE_ENV === 'development') {
    console.log('✅ All environment variables loaded successfully');
}

module.exports = config;
