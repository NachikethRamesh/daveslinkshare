#!/usr/bin/env node
// Environment Variables Test Script

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

console.log('🔍 Environment Variables Test\n');

const requiredVars = ['JSONBIN_API_KEY', 'LINKS_BIN_ID', 'AUTH_BIN_ID', 'JWT_SECRET'];
const optionalVars = ['PORT', 'NODE_ENV', 'CLIENT_URL'];

console.log('📋 Required Variables:');
requiredVars.forEach(varName => {
    const value = process.env[varName];
    const status = value ? '✅' : '❌';
    const displayValue = value ? `${value.substring(0, 8)}...` : 'NOT SET';
    console.log(`  ${status} ${varName}: ${displayValue}`);
});

console.log('\n📋 Optional Variables:');
optionalVars.forEach(varName => {
    const value = process.env[varName];
    const status = value ? '✅' : '⚠️ ';
    const displayValue = value || 'Using default';
    console.log(`  ${status} ${varName}: ${displayValue}`);
});

// Test configuration loading
console.log('\n🧪 Testing Configuration Loading:');
try {
    const config = require('./config');
    console.log('✅ Configuration loaded successfully');
    console.log(`📡 Server will run on port: ${config.port}`);
    console.log(`🌍 Environment: ${config.nodeEnv}`);
    console.log(`🔗 JSONBin Base URL: ${config.jsonbin.baseUrl}`);
    console.log(`🎯 CORS Origin: ${config.cors.origin}`);
} catch (error) {
    console.log('❌ Configuration loading failed:', error.message);
    process.exit(1);
}

console.log('\n🎉 Environment test completed successfully!');
