#!/usr/bin/env node

/**
 * JSONBin to Cloudflare D1 Migration Script
 * Migrates user data and links from JSONBin to D1 database
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// JSONBin configuration (from environment or config)
const JSONBIN_CONFIG = {
  apiKey: process.env.JSONBIN_API_KEY || '$2a$10$ny3GTPiENLtRJQfE9RmHb.DjGt06dQlR9QoyPShSzzXjSMWpL15f.',
  authBinId: process.env.AUTH_BIN_ID || '68b7c443ae596e708fe0d657',
  linksBinId: process.env.LINKS_BIN_ID || '68b7de25ae596e708fe0ea04'
};

console.log('🔄 Starting JSONBin to D1 Migration...\n');

/**
 * Fetch data from JSONBin
 */
async function fetchFromJSONBin(binId, apiKey) {
  const response = await fetch(`https://api.jsonbin.io/v3/b/${binId}/latest`, {
    headers: {
      'X-Master-Key': apiKey,
      'X-Bin-Meta': 'false'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch from JSONBin: ${response.status}`);
  }
  
  return await response.json();
}

/**
 * Hash password for D1 storage
 */
async function hashPassword(password) {
  const crypto = require('crypto');
  const salt = 'salt_daves_links_2025';
  return crypto.createHash('sha256').update(password + salt).digest('hex');
}

/**
 * Generate user hash
 */
async function generateUserHash(username) {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(username + Date.now().toString()).digest('hex');
}

/**
 * Execute SQL command on D1 database
 */
function executeD1Command(sql, params = []) {
  const command = params.length > 0 
    ? `npx wrangler d1 execute daves-links-db --command="${sql}"` 
    : `npx wrangler d1 execute daves-links-db --command="${sql}"`;
    
  try {
    return execSync(command, { encoding: 'utf8', stdio: 'pipe' });
  } catch (error) {
    console.error(`SQL Error: ${sql}`);
    throw error;
  }
}

/**
 * Migrate users from JSONBin auth data
 */
async function migrateUsers(authData) {
  console.log('👥 Migrating users...');
  let migratedCount = 0;
  let skippedCount = 0;
  
  for (const [username, userData] of Object.entries(authData)) {
    try {
      // Check if user already exists
      const checkUserSql = `SELECT COUNT(*) as count FROM users WHERE username = '${username}';`;
      const checkResult = executeD1Command(checkUserSql);
      
      if (checkResult.includes('"count": 1')) {
        console.log(`⏭️  User ${username} already exists, skipping...`);
        skippedCount++;
        continue;
      }
      
      // Generate password hash and user hash
      const passwordHash = userData.password 
        ? userData.password 
        : await hashPassword('defaultpassword123'); // Fallback for users without passwords
      
      const userHash = userData.userHash || await generateUserHash(username);
      
      // Insert user into D1
      const insertUserSql = `
        INSERT INTO users (username, password_hash, user_hash, created_at) 
        VALUES ('${username}', '${passwordHash}', '${userHash}', datetime('now'));
      `;
      
      executeD1Command(insertUserSql);
      console.log(`✅ Migrated user: ${username}`);
      migratedCount++;
      
    } catch (error) {
      console.error(`❌ Failed to migrate user ${username}:`, error.message);
    }
  }
  
  console.log(`\n📊 Users Migration Summary:`);
  console.log(`   ✅ Migrated: ${migratedCount}`);
  console.log(`   ⏭️  Skipped: ${skippedCount}\n`);
  
  return migratedCount;
}

/**
 * Get domain from URL
 */
function getDomainFromUrl(url) {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return 'unknown';
  }
}

/**
 * Migrate links from JSONBin links data
 */
async function migrateLinks(linksData, authData) {
  console.log('🔗 Migrating links...');
  let migratedCount = 0;
  let skippedCount = 0;
  
  // Create a mapping of userHash to userId from D1
  const userMapping = {};
  
  for (const [username, userData] of Object.entries(authData)) {
    const userHash = userData.userHash;
    if (userHash) {
      try {
        const getUserSql = `SELECT id FROM users WHERE user_hash = '${userHash}';`;
        const result = executeD1Command(getUserSql);
        const match = result.match(/"id": (\d+)/);
        if (match) {
          userMapping[userHash] = parseInt(match[1]);
        }
      } catch (error) {
        console.error(`Failed to get user ID for hash ${userHash}:`, error.message);
      }
    }
  }
  
  // Migrate links for each user
  for (const [key, userLinks] of Object.entries(linksData)) {
    if (!key.startsWith('links_')) continue;
    
    const userHash = key.replace('links_', '');
    const userId = userMapping[userHash];
    
    if (!userId) {
      console.log(`⚠️  No user found for hash ${userHash}, skipping links...`);
      continue;
    }
    
    if (!Array.isArray(userLinks)) continue;
    
    for (const link of userLinks) {
      try {
        // Check if link already exists
        const checkLinkSql = `SELECT COUNT(*) as count FROM links WHERE user_id = ${userId} AND url = '${link.url.replace(/'/g, "''")}';`;
        const checkResult = executeD1Command(checkLinkSql);
        
        if (checkResult.includes('"count": 1')) {
          skippedCount++;
          continue;
        }
        
        // Prepare link data
        const title = (link.title || 'Untitled').replace(/'/g, "''");
        const url = link.url.replace(/'/g, "''");
        const category = (link.category || 'general').replace(/'/g, "''");
        const domain = getDomainFromUrl(link.url);
        const isRead = link.isRead || 0;
        const dateAdded = link.dateAdded || link.timestamp || new Date().toISOString();
        
        // Insert link into D1
        const insertLinkSql = `
          INSERT INTO links (user_id, url, title, category, domain, is_read, date_added, timestamp) 
          VALUES (${userId}, '${url}', '${title}', '${category}', '${domain}', ${isRead}, '${dateAdded}', '${dateAdded}');
        `;
        
        executeD1Command(insertLinkSql);
        migratedCount++;
        
      } catch (error) {
        console.error(`❌ Failed to migrate link ${link.url}:`, error.message);
      }
    }
  }
  
  console.log(`\n📊 Links Migration Summary:`);
  console.log(`   ✅ Migrated: ${migratedCount}`);
  console.log(`   ⏭️  Skipped: ${skippedCount}\n`);
  
  return migratedCount;
}

/**
 * Main migration function
 */
async function migrateFromJSONBin() {
  try {
    console.log('🔍 Fetching data from JSONBin...');
    
    // Fetch auth data
    console.log('   📥 Fetching user authentication data...');
    const authData = await fetchFromJSONBin(JSONBIN_CONFIG.authBinId, JSONBIN_CONFIG.apiKey);
    console.log(`   ✅ Found ${Object.keys(authData).length} users\n`);
    
    // Fetch links data
    console.log('   📥 Fetching links data...');
    const linksData = await fetchFromJSONBin(JSONBIN_CONFIG.linksBinId, JSONBIN_CONFIG.apiKey);
    const linkKeys = Object.keys(linksData).filter(key => key.startsWith('links_'));
    console.log(`   ✅ Found ${linkKeys.length} user link collections\n`);
    
    // Migrate users first
    const migratedUsers = await migrateUsers(authData);
    
    if (migratedUsers === 0) {
      console.log('⚠️  No users migrated, skipping links migration');
      return;
    }
    
    // Migrate links
    const migratedLinks = await migrateLinks(linksData, authData);
    
    // Final summary
    console.log('🎉 Migration completed successfully!');
    console.log(`📊 Final Summary:`);
    console.log(`   👥 Users migrated: ${migratedUsers}`);
    console.log(`   🔗 Links migrated: ${migratedLinks}`);
    
    // Verify migration
    console.log('\n🔍 Verifying migration...');
    executeD1Command('SELECT COUNT(*) as user_count FROM users;');
    executeD1Command('SELECT COUNT(*) as link_count FROM links;');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    
    if (error.message.includes('fetch')) {
      console.log('\n💡 Make sure JSONBin credentials are correct and accessible');
    }
    
    if (error.message.includes('wrangler')) {
      console.log('\n💡 Make sure you have:');
      console.log('   1. Authenticated with Cloudflare: npx wrangler login');
      console.log('   2. Created the D1 database: npm run setup:d1');
    }
    
    process.exit(1);
  }
}

// Run migration if called directly
if (require.main === module) {
  // Check if required environment variables are set
  if (!JSONBIN_CONFIG.apiKey || !JSONBIN_CONFIG.authBinId || !JSONBIN_CONFIG.linksBinId) {
    console.error('❌ Missing JSONBin configuration. Please set environment variables:');
    console.log('   JSONBIN_API_KEY, AUTH_BIN_ID, LINKS_BIN_ID');
    process.exit(1);
  }
  
  migrateFromJSONBin();
}

module.exports = { migrateFromJSONBin };
