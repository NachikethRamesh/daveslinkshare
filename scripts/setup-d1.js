#!/usr/bin/env node

/**
 * Cloudflare D1 Database Setup Script
 * Creates database, sets up schema, and updates wrangler.toml
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Setting up Cloudflare D1 Database...\n');

async function setupD1Database() {
  try {
    // Step 1: Create D1 database
    console.log('📦 Creating D1 database...');
    const createOutput = execSync('npx wrangler d1 create daves-links-db', { 
      encoding: 'utf8',
      stdio: 'pipe'
    });
    
    console.log(createOutput);
    
    // Extract database ID from output
    const dbIdMatch = createOutput.match(/database_id = "([^"]+)"/);
    if (!dbIdMatch) {
      throw new Error('Could not extract database ID from wrangler output');
    }
    
    const databaseId = dbIdMatch[1];
    console.log(`✅ Database created with ID: ${databaseId}\n`);
    
    // Step 2: Update wrangler.toml with actual database ID
    console.log('📝 Updating wrangler.toml...');
    const wranglerPath = path.join(process.cwd(), 'wrangler.toml');
    let wranglerContent = fs.readFileSync(wranglerPath, 'utf8');
    
    // Replace placeholder with actual database ID
    wranglerContent = wranglerContent.replace(
      'database_id = "REPLACE_WITH_YOUR_D1_DATABASE_ID"',
      `database_id = "${databaseId}"`
    );
    
    fs.writeFileSync(wranglerPath, wranglerContent);
    console.log('✅ wrangler.toml updated with database ID\n');
    
    // Step 3: Set up database schema
    console.log('🏗️  Setting up database schema...');
    const schemaPath = path.join(process.cwd(), 'schema.sql');
    
    if (fs.existsSync(schemaPath)) {
      execSync(`npx wrangler d1 execute daves-links-db --file=${schemaPath}`, {
        stdio: 'inherit'
      });
      console.log('✅ Database schema created successfully\n');
    } else {
      console.log('⚠️  schema.sql not found, skipping schema setup\n');
    }
    
    // Step 4: Verify setup
    console.log('🔍 Verifying database setup...');
    execSync('npx wrangler d1 execute daves-links-db --command="SELECT COUNT(*) as table_count FROM sqlite_master WHERE type=\'table\';"', {
      stdio: 'inherit'
    });
    
    console.log('\n🎉 D1 Database setup completed successfully!');
    console.log(`📋 Database ID: ${databaseId}`);
    console.log('🚀 You can now deploy your application with: npx wrangler deploy');
    
    return databaseId;
    
  } catch (error) {
    console.error('❌ Error setting up D1 database:', error.message);
    
    if (error.message.includes('not authenticated')) {
      console.log('\n💡 Please authenticate with Cloudflare first:');
      console.log('   npx wrangler login');
    }
    
    process.exit(1);
  }
}

// Run setup if called directly
if (require.main === module) {
  setupD1Database();
}

module.exports = { setupD1Database };
