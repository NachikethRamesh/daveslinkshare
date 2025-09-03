#!/usr/bin/env node
// Script to set Cloudflare Pages secrets securely

const { execSync } = require('child_process');

console.log('🔐 Setting up Cloudflare Pages secrets...\n');

const secrets = {
  'JSONBIN_API_KEY': '$2a$10$ny3GTPiENLtRJQfE9RmHb.DjGt06dQlR9QoyPShSzzXjSMWpL15f.',
  'LINKS_BIN_ID': '68b7de25ae596e708fe0ea04',
  'AUTH_BIN_ID': '68b7c443ae596e708fe0d657',
  'JWT_SECRET': '5b452b847b8dd1d2b68af11b176dba87aef2753d59118b30dcab0a4853e48979b2590bfebce52071807ba666d303acb86b17ee0e9256e35082289cf0e420545a'
};

const projectName = 'daves-link-sharing-app';

try {
  // Check if wrangler is installed
  console.log('Checking Wrangler installation...');
  execSync('wrangler --version', { stdio: 'pipe' });
  console.log('✅ Wrangler is installed\n');

  // Check if user is logged in
  console.log('Checking Cloudflare authentication...');
  try {
    execSync('wrangler whoami', { stdio: 'pipe' });
    console.log('✅ Authenticated with Cloudflare\n');
  } catch (error) {
    console.log('❌ Not authenticated. Please run: wrangler login\n');
    process.exit(1);
  }

  // Set each secret
  console.log('Setting secrets...\n');
  
  for (const [key, value] of Object.entries(secrets)) {
    try {
      console.log(`Setting ${key}...`);
      
      // Use echo to pipe the value to wrangler
      const command = process.platform === 'win32' 
        ? `echo ${value} | wrangler pages secret put ${key} --project-name=${projectName}`
        : `echo "${value}" | wrangler pages secret put ${key} --project-name=${projectName}`;
      
      execSync(command, { stdio: 'inherit' });
      console.log(`✅ ${key} set successfully\n`);
    } catch (error) {
      console.log(`❌ Failed to set ${key}: ${error.message}\n`);
    }
  }

  console.log('🎉 All secrets configured!');
  console.log('💡 You can now deploy with: npm run deploy');
  
} catch (error) {
  console.log('❌ Wrangler not found. Please install it first:');
  console.log('npm install -g wrangler');
  console.log('Then run: wrangler login');
}
