#!/usr/bin/env node

/**
 * Complete Deployment Script
 * Handles D1 setup, migration, and deployment in the correct order
 */

const { execSync } = require('child_process');
const { setupD1Database } = require('./setup-d1');
const { migrateFromJSONBin } = require('./migrate-from-jsonbin');
const { verifyMigration } = require('./verify-migration');

console.log('🚀 Starting Complete Deployment Process...\n');

/**
 * Check if D1 database exists
 */
function checkDatabaseExists() {
  try {
    const result = execSync('npx wrangler d1 list', { encoding: 'utf8', stdio: 'pipe' });
    return result.includes('daves-links-db');
  } catch (error) {
    console.log('⚠️  Could not check database status, assuming it doesn\'t exist');
    return false;
  }
}

/**
 * Deploy to Cloudflare Workers
 */
function deployToCloudflare() {
  console.log('🚀 Deploying to Cloudflare Workers...');
  
  try {
    // Build the application
    console.log('🔨 Building application...');
    execSync('npm run build', { stdio: 'inherit' });
    
    // Deploy with wrangler
    console.log('📤 Deploying with Wrangler...');
    execSync('npx wrangler deploy', { stdio: 'inherit' });
    
    console.log('✅ Deployment successful!');
    return true;
    
  } catch (error) {
    console.error('❌ Deployment failed:', error.message);
    return false;
  }
}

/**
 * Test the deployed application
 */
async function testDeployment() {
  console.log('🧪 Testing deployed application...');
  
  try {
    // Wait a moment for deployment to propagate
    console.log('⏳ Waiting for deployment to propagate...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Test health endpoint
    const healthUrl = 'https://daveslinkshare.workers.dev/api/health';
    console.log(`📡 Testing health endpoint: ${healthUrl}`);
    
    const response = await fetch(healthUrl);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Health check passed!');
      console.log('📊 Health data:', JSON.stringify(data, null, 2));
    } else {
      console.log(`⚠️  Health check returned status: ${response.status}`);
    }
    
    return true;
    
  } catch (error) {
    console.log('⚠️  Could not test deployment:', error.message);
    console.log('   This might be normal if the deployment is still propagating');
    return false;
  }
}

/**
 * Main deployment function
 */
async function completeDeploy() {
  try {
    let dbExists = false;
    let migrationNeeded = false;
    
    // Step 1: Check authentication
    console.log('🔐 Checking Cloudflare authentication...');
    try {
      execSync('npx wrangler whoami', { stdio: 'pipe' });
      console.log('✅ Cloudflare authentication confirmed\n');
    } catch (error) {
      console.log('❌ Not authenticated with Cloudflare');
      console.log('💡 Please run: npx wrangler login');
      process.exit(1);
    }
    
    // Step 2: Check if database exists
    console.log('🔍 Checking D1 database status...');
    dbExists = checkDatabaseExists();
    
    if (dbExists) {
      console.log('✅ D1 database already exists\n');
    } else {
      console.log('❌ D1 database does not exist\n');
      migrationNeeded = true;
    }
    
    // Step 3: Setup D1 database if needed
    if (!dbExists) {
      console.log('📦 Setting up D1 database...');
      await setupD1Database();
      console.log('');
    }
    
    // Step 4: Migrate data if needed
    if (migrationNeeded) {
      console.log('🔄 Checking for JSONBin data to migrate...');
      
      // Check if JSONBin credentials are available
      const hasJsonBinCreds = process.env.JSONBIN_API_KEY && 
                             process.env.AUTH_BIN_ID && 
                             process.env.LINKS_BIN_ID;
      
      if (hasJsonBinCreds) {
        console.log('📥 JSONBin credentials found, starting migration...');
        try {
          await migrateFromJSONBin();
          console.log('');
        } catch (error) {
          console.log('⚠️  Migration failed, but continuing with deployment...');
          console.log('   Error:', error.message);
        }
      } else {
        console.log('⏭️  No JSONBin credentials found, skipping migration');
        console.log('   (This is normal for fresh setups)\n');
      }
    }
    
    // Step 5: Verify database setup
    console.log('🔍 Verifying database setup...');
    try {
      await verifyMigration();
      console.log('');
    } catch (error) {
      console.log('⚠️  Database verification had issues, but continuing...');
    }
    
    // Step 6: Deploy to Cloudflare
    const deploySuccess = deployToCloudflare();
    
    if (!deploySuccess) {
      console.log('\n❌ Deployment failed');
      process.exit(1);
    }
    
    // Step 7: Test deployment
    console.log('');
    await testDeployment();
    
    // Final summary
    console.log('\n🎉 Complete deployment finished!');
    console.log('\n📋 Deployment Summary:');
    console.log(`   🗄️  Database: ${dbExists ? 'Existing' : 'Newly created'}`);
    console.log(`   📊 Migration: ${migrationNeeded ? 'Attempted' : 'Skipped'}`);
    console.log(`   🚀 Deployment: Successful`);
    console.log('\n🌐 Your app is now live at:');
    console.log('   https://daveslinkshare.workers.dev');
    console.log('\n🔍 Health check:');
    console.log('   https://daveslinkshare.workers.dev/api/health');
    
  } catch (error) {
    console.error('\n❌ Complete deployment failed:', error.message);
    process.exit(1);
  }
}

// Run deployment if called directly
if (require.main === module) {
  completeDeploy();
}

module.exports = { completeDeploy };
