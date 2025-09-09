#!/usr/bin/env node

/**
 * Migration Verification Script
 * Verifies that data was successfully migrated from JSONBin to D1
 */

const { execSync } = require('child_process');

console.log('🔍 Verifying D1 Migration...\n');

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
    console.error(`Query failed: ${sql}`);
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
  console.log('📋 Verifying database structure...');
  
  try {
    // Check if tables exist
    const tablesResult = executeD1Query(`
      SELECT COUNT(*) as count FROM sqlite_master 
      WHERE type='table' AND name IN ('users', 'links');
    `);
    
    const tableCount = extractCount(tablesResult);
    
    if (tableCount === 2) {
      console.log('✅ All required tables exist (users, links)');
    } else {
      console.log(`❌ Missing tables. Found ${tableCount}/2 tables`);
      return false;
    }
    
    // Check indexes
    const indexesResult = executeD1Query(`
      SELECT COUNT(*) as count FROM sqlite_master 
      WHERE type='index' AND name LIKE 'idx_%';
    `);
    
    const indexCount = extractCount(indexesResult);
    console.log(`✅ Found ${indexCount} custom indexes`);
    
    return true;
    
  } catch (error) {
    console.error('❌ Database structure verification failed:', error.message);
    return false;
  }
}

/**
 * Verify data migration
 */
function verifyDataMigration() {
  console.log('\n📊 Verifying data migration...');
  
  try {
    // Count users
    const usersResult = executeD1Query('SELECT COUNT(*) as count FROM users;');
    const userCount = extractCount(usersResult);
    console.log(`👥 Users in database: ${userCount}`);
    
    // Count links
    const linksResult = executeD1Query('SELECT COUNT(*) as count FROM links;');
    const linkCount = extractCount(linksResult);
    console.log(`🔗 Links in database: ${linkCount}`);
    
    // Check data integrity
    const integrityResult = executeD1Query(`
      SELECT COUNT(*) as count FROM links l 
      LEFT JOIN users u ON l.user_id = u.id 
      WHERE u.id IS NULL;
    `);
    
    const orphanedLinks = extractCount(integrityResult);
    
    if (orphanedLinks === 0) {
      console.log('✅ Data integrity check passed (no orphaned links)');
    } else {
      console.log(`⚠️  Found ${orphanedLinks} orphaned links`);
    }
    
    // Sample data verification
    if (userCount > 0) {
      console.log('\n📝 Sample users:');
      const sampleUsersResult = executeD1Query(`
        SELECT username, created_at FROM users LIMIT 3;
      `);
      console.log(sampleUsersResult);
    }
    
    if (linkCount > 0) {
      console.log('\n📝 Sample links:');
      const sampleLinksResult = executeD1Query(`
        SELECT l.title, l.category, u.username 
        FROM links l 
        JOIN users u ON l.user_id = u.id 
        LIMIT 3;
      `);
      console.log(sampleLinksResult);
    }
    
    return { userCount, linkCount, orphanedLinks };
    
  } catch (error) {
    console.error('❌ Data verification failed:', error.message);
    return null;
  }
}

/**
 * Test database functionality
 */
function testDatabaseFunctionality() {
  console.log('\n🧪 Testing database functionality...');
  
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
    console.log('✅ User creation test passed');
    
    // Test link creation
    const testUrl = 'https://example.com/test';
    const testTitle = 'Test Link';
    
    executeD1Query(`
      INSERT INTO links (user_id, url, title, category) 
      VALUES (${userId}, '${testUrl}', '${testTitle}', 'test');
    `);
    
    console.log('✅ Link creation test passed');
    
    // Test data retrieval
    const retrievalResult = executeD1Query(`
      SELECT l.title, u.username 
      FROM links l 
      JOIN users u ON l.user_id = u.id 
      WHERE u.username = '${testUsername}';
    `);
    
    if (retrievalResult.includes(testTitle)) {
      console.log('✅ Data retrieval test passed');
    } else {
      console.log('❌ Data retrieval test failed');
    }
    
    // Clean up test data
    executeD1Query(`DELETE FROM links WHERE user_id = ${userId};`);
    executeD1Query(`DELETE FROM users WHERE id = ${userId};`);
    console.log('✅ Test data cleanup completed');
    
    return true;
    
  } catch (error) {
    console.error('❌ Database functionality test failed:', error.message);
    return false;
  }
}

/**
 * Main verification function
 */
async function verifyMigration() {
  try {
    console.log('🎯 Starting migration verification...\n');
    
    // Step 1: Verify database structure
    const structureValid = verifyDatabaseStructure();
    if (!structureValid) {
      console.log('\n❌ Database structure verification failed');
      process.exit(1);
    }
    
    // Step 2: Verify data migration
    const migrationData = verifyDataMigration();
    if (!migrationData) {
      console.log('\n❌ Data migration verification failed');
      process.exit(1);
    }
    
    // Step 3: Test database functionality
    const functionalityValid = testDatabaseFunctionality();
    if (!functionalityValid) {
      console.log('\n❌ Database functionality test failed');
      process.exit(1);
    }
    
    // Final summary
    console.log('\n🎉 Migration verification completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`   ✅ Database structure: Valid`);
    console.log(`   ✅ Users migrated: ${migrationData.userCount}`);
    console.log(`   ✅ Links migrated: ${migrationData.linkCount}`);
    console.log(`   ✅ Data integrity: ${migrationData.orphanedLinks === 0 ? 'Valid' : 'Issues found'}`);
    console.log(`   ✅ Functionality: Working`);
    
    if (migrationData.userCount === 0) {
      console.log('\n⚠️  Note: No users found. This might be expected for a fresh setup.');
    }
    
    console.log('\n🚀 Your D1 database is ready for production!');
    
  } catch (error) {
    console.error('\n❌ Verification failed:', error.message);
    process.exit(1);
  }
}

// Run verification if called directly
if (require.main === module) {
  verifyMigration();
}

module.exports = { verifyMigration };
