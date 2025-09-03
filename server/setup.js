#!/usr/bin/env node
// Dave's Links - Secure Setup Script

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const readline = require('readline');
const ValidationUtils = require('./utils/validation');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const question = (query) => new Promise(resolve => rl.question(query, resolve));

async function setupEnvironment() {
    console.log('🔧 Dave\'s Links - Secure Environment Setup\n');

    const envPath = path.join(__dirname, '.env');
    const examplePath = path.join(__dirname, '.env.example');

    // Check if .env already exists
    if (fs.existsSync(envPath)) {
        const overwrite = await question('⚠️  .env file already exists. Overwrite? (y/N): ');
        if (overwrite.toLowerCase() !== 'y') {
            console.log('Setup cancelled.');
            rl.close();
            return;
        }
    }

    console.log('📝 Please provide your JSONBin.io credentials:');
    console.log('   (Get these from https://jsonbin.io dashboard)\n');

    // Get JSONBin credentials with validation
    let apiKey, linksBinId, authBinId;
    
    do {
        apiKey = await question('🔑 JSONBin API Key: ');
        if (!ValidationUtils.validateApiKey(apiKey)) {
            console.log('❌ Invalid API key format. Should start with $2 and be longer than 20 characters.');
        }
    } while (!ValidationUtils.validateApiKey(apiKey));
    
    do {
        linksBinId = await question('📦 Links Bin ID: ');
        if (!ValidationUtils.validateBinId(linksBinId)) {
            console.log('❌ Invalid Bin ID format. Should be 24 hexadecimal characters.');
        }
    } while (!ValidationUtils.validateBinId(linksBinId));
    
    do {
        authBinId = await question('👤 Auth Bin ID: ');
        if (!ValidationUtils.validateBinId(authBinId)) {
            console.log('❌ Invalid Bin ID format. Should be 24 hexadecimal characters.');
        }
    } while (!ValidationUtils.validateBinId(authBinId));

    // Get server configuration
    console.log('\n⚙️  Server Configuration:');
    const port = await question('🌐 Port (default 3000): ') || '3000';
    const nodeEnv = await question('🏗️  Environment (development/production) [development]: ') || 'development';

    // Generate secure JWT secret
    const jwtSecret = crypto.randomBytes(64).toString('hex');
    console.log('🔐 Generated secure JWT secret');

    // Get CORS configuration
    const clientUrl = await question(`🌍 Client URL [http://localhost:${port}]: `) || `http://localhost:${port}`;

    // Create .env content
    const envContent = `# Dave's Links - Environment Configuration
# Generated on ${new Date().toISOString()}

# JSONBin Configuration
JSONBIN_API_KEY=${apiKey}
LINKS_BIN_ID=${linksBinId}
AUTH_BIN_ID=${authBinId}

# Server Configuration
PORT=${port}
NODE_ENV=${nodeEnv}
JWT_SECRET=${jwtSecret}

# CORS Configuration
CLIENT_URL=${clientUrl}
`;

    // Write .env file
    try {
        fs.writeFileSync(envPath, envContent);
        console.log('\n✅ Environment file created successfully!');
        
        // Set secure permissions (Unix/Linux/Mac)
        try {
            fs.chmodSync(envPath, 0o600); // Read/write for owner only
            console.log('🔒 Secure file permissions set');
        } catch (permError) {
            console.log('⚠️  Could not set secure permissions (Windows system)');
        }

        console.log('\n🚀 Setup complete! You can now run:');
        console.log('   npm install');
        console.log('   npm run dev');
        
    } catch (error) {
        console.error('❌ Error creating .env file:', error.message);
    }

    rl.close();
}

// Validation functions
function validateApiKey(apiKey) {
    return apiKey && apiKey.length > 20 && apiKey.startsWith('$2');
}

function validateBinId(binId) {
    return binId && binId.length === 24 && /^[a-f0-9]{24}$/.test(binId);
}

// Run setup if called directly
if (require.main === module) {
    setupEnvironment().catch(console.error);
}

module.exports = { setupEnvironment };
