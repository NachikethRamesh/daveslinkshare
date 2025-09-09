#!/usr/bin/env node

/**
 * Cloudflare D1 Database Setup Script
 * Creates database, sets up schema, and updates wrangler.toml
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');


async function setupD1Database() {
  try {
    // Step 1: Create D1 database
    const createOutput = execSync('npx wrangler d1 create daves-links-db', { 
      encoding: 'utf8',
      stdio: 'pipe'
    });
    
    // Extract database ID from output
    const dbIdMatch = createOutput.match(/database_id = "([^"]+)"/);
    if (!dbIdMatch) {
      throw new Error('Could not extract database ID from wrangler output');
    }
    
    const databaseId = dbIdMatch[1];
    
    // Step 2: Update wrangler.toml with actual database ID
    const wranglerPath = path.join(process.cwd(), 'wrangler.toml');
    let wranglerContent = fs.readFileSync(wranglerPath, 'utf8');
    
    // Replace placeholder with actual database ID
    wranglerContent = wranglerContent.replace(
      'database_id = "REPLACE_WITH_YOUR_D1_DATABASE_ID"',
      `database_id = "${databaseId}"`
    );
    
    fs.writeFileSync(wranglerPath, wranglerContent);
    
    // Step 3: Set up database schema
    const schemaPath = path.join(process.cwd(), 'schema.sql');
    
    if (fs.existsSync(schemaPath)) {
      execSync(`npx wrangler d1 execute daves-links-db --file=${schemaPath}`, {
        stdio: 'inherit'
      });
    }
    
    // Step 4: Verify setup
    execSync('npx wrangler d1 execute daves-links-db --command="SELECT COUNT(*) as table_count FROM sqlite_master WHERE type=\'table\';"', {
      stdio: 'inherit'
    });
    
    return databaseId;
    
  } catch (error) {
    throw error;
  }
}

// Run setup if called directly
if (require.main === module) {
  setupD1Database();
}

module.exports = { setupD1Database };
