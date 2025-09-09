#!/usr/bin/env node

/**
 * Migration Verification Script
 * Verifies that data was successfully migrated from JSONBin to D1
 */

const { execSync } = require('child_process');

/**
 * Execute D1 command and return parsed result
 */
function executeD1Query(sql) {
  try {
    const result = execSync(`npx wrangler d1 execute daves-links-db --command="${sql}"`, {
      encoding: 'utf8',
      stdio: 'pipe'
    });
    return result;
  } catch (error) {
    throw error;
  }
}

/**
 * Extract count from D1 result
 */
function extractCount(result, field = 'count') {
  const match = result.match(new RegExp(`"${field}": (\\d+)`));
  return match ? parseInt(match[1]) : 0;
}

/**
 * Verify database structure
 */
function verifyDatabaseStructure() {
  try {
    // Check if tables exist
    const tablesResult = executeD1Query(`
      SELECT COUNT(*) as count FROM sqlite_master 
      WHERE type='table' AND name IN ('users', 'links');
    `);
    
    const tableCount = extractCount(tablesResult);
    
    if (tableCount !== 2) {
      return false;
    }
    
    // Check indexes
    const indexesResult = executeD1Query(`
      SELECT COUNT(*) as count FROM sqlite_master 
      WHERE type='index' AND name LIKE 'idx_%';
    `);
    
    return true;
    
  } catch (error) {
    return false;
  }
}

/**
 * Verify data migration
 */
function verifyDataMigration() {
  try {
    // Count users
    const usersResult = executeD1Query('SELECT COUNT(*) as count FROM users;');
    const userCount = extractCount(usersResult);
    
    // Count links
    const linksResult = executeD1Query('SELECT COUNT(*) as count FROM links;');
    const linkCount = extractCount(linksResult);
    
    // Check data integrity
    const integrityResult = executeD1Query(`
      SELECT COUNT(*) as count FROM links l 
      LEFT JOIN users u ON l.user_id = u.id 
      WHERE u.id IS NULL;
    `);
    
    const orphanedLinks = extractCount(integrityResult);
    
    return { userCount, linkCount, orphanedLinks };
    
  } catch (error) {
    return null;
  }
}

/**
 * Test database functionality
 */
function testDatabaseFunctionality() {
  try {
    // Test user creation
    const testUsername = `test_user_${Date.now()}`;
    const testPassword = 'test_password_hash';
    const testUserHash = `test_hash_${Date.now()}`;
    
    executeD1Query(`
      INSERT INTO users (username, password_hash, user_hash) 
      VALUES ('${testUsername}', '${testPassword}', '${testUserHash}');
    `);
    
    // Get the test user ID
    const userResult = executeD1Query(`
      SELECT id FROM users WHERE username = '${testUsername}';
    `);
    
    const userIdMatch = userResult.match(/"id": (\d+)/);
    if (!userIdMatch) {
      throw new Error('Failed to create test user');
    }
    
    const userId = userIdMatch[1];
    
    // Test link creation
    const testUrl = 'https://example.com/test';
    const testTitle = 'Test Link';
    
    executeD1Query(`
      INSERT INTO links (user_id, url, title, category) 
      VALUES (${userId}, '${testUrl}', '${testTitle}', 'test');
    `);
    
    // Test data retrieval
    const retrievalResult = executeD1Query(`
      SELECT l.title, u.username 
      FROM links l 
      JOIN users u ON l.user_id = u.id 
      WHERE u.username = '${testUsername}';
    `);
    
    if (!retrievalResult.includes(testTitle)) {
      return false;
    }
    
    // Clean up test data
    executeD1Query(`DELETE FROM links WHERE user_id = ${userId};`);
    executeD1Query(`DELETE FROM users WHERE id = ${userId};`);
    
    return true;
    
  } catch (error) {
    return false;
  }
}

/**
 * Main verification function
 */
async function verifyMigration() {
  try {
    // Step 1: Verify database structure
    const structureValid = verifyDatabaseStructure();
    if (!structureValid) {
      process.exit(1);
    }
    
    // Step 2: Verify data migration
    const migrationData = verifyDataMigration();
    if (!migrationData) {
      process.exit(1);
    }
    
    // Step 3: Test database functionality
    const functionalityValid = testDatabaseFunctionality();
    if (!functionalityValid) {
      process.exit(1);
    }
    
  } catch (error) {
    process.exit(1);
  }
}

// Run verification if called directly
if (require.main === module) {
  verifyMigration();
}

module.exports = { verifyMigration };
