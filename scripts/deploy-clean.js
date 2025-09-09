#!/usr/bin/env node

/**
 * Complete Deployment Script
 * Handles D1 setup, migration, and deployment in the correct order
 */

const { execSync } = require('child_process');
const { setupD1Database } = require('./setup-d1');
const { migrateFromJSONBin } = require('./migrate-from-jsonbin');
const { verifyMigration } = require('./verify-migration');

/**
 * Check if D1 database exists
 */
function checkDatabaseExists() {
  try {
    const result = execSync('npx wrangler d1 list', { encoding: 'utf8', stdio: 'pipe' });
    return result.includes('daves-links-db');
  } catch (error) {
    return false;
  }
}

/**
 * Deploy to Cloudflare Workers
 */
function deployToCloudflare() {
  try {
    // Build the application
    execSync('npm run build', { stdio: 'inherit' });
    
    // Deploy with wrangler
    execSync('npx wrangler deploy', { stdio: 'inherit' });
    
    return true;
    
  } catch (error) {
    return false;
  }
}

/**
 * Test the deployed application
 */
async function testDeployment() {
  try {
    // Wait a moment for deployment to propagate
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Test health endpoint
    const healthUrl = 'https://daveslinkshare.workers.dev/api/health';
    
    const response = await fetch(healthUrl);
    
    if (response.ok) {
      const data = await response.json();
      return true;
    }
    
    return false;
    
  } catch (error) {
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
    try {
      execSync('npx wrangler whoami', { stdio: 'pipe' });
    } catch (error) {
      process.exit(1);
    }
    
    // Step 2: Check if database exists
    dbExists = checkDatabaseExists();
    
    if (!dbExists) {
      migrationNeeded = true;
    }
    
    // Step 3: Setup D1 database if needed
    if (!dbExists) {
      await setupD1Database();
    }
    
    // Step 4: Migrate data if needed
    if (migrationNeeded) {
      // Check if JSONBin credentials are available
      const hasJsonBinCreds = process.env.JSONBIN_API_KEY && 
                             process.env.AUTH_BIN_ID && 
                             process.env.LINKS_BIN_ID;
      
      if (hasJsonBinCreds) {
        try {
          await migrateFromJSONBin();
        } catch (error) {
          // Continue with deployment even if migration fails
        }
      }
    }
    
    // Step 5: Verify database setup
    try {
      await verifyMigration();
    } catch (error) {
      // Continue with deployment
    }
    
    // Step 6: Deploy to Cloudflare
    const deploySuccess = deployToCloudflare();
    
    if (!deploySuccess) {
      process.exit(1);
    }
    
    // Step 7: Test deployment
    await testDeployment();
    
  } catch (error) {
    process.exit(1);
  }
}

// Run deployment if called directly
if (require.main === module) {
  completeDeploy();
}

module.exports = { completeDeploy };
