// Password hashing utilities - matches JSONBin system exactly
async function generatePasswordHash(password) {
  const salt = 'salt_daves_links_2025';
  
  // Use the EXACT same method as JSONBin migration script
  // The migration script uses: crypto.createHash('sha256').update(password + salt).digest('hex')
  // But in Cloudflare Workers, we need to use Web Crypto API
  const combined = password + salt;
  const encoder = new TextEncoder();
  const data = encoder.encode(combined);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function generateUserHash(username) {
  const encoder = new TextEncoder();
  const data = encoder.encode(username + Date.now().toString());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function getDomainFromUrl(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch (error) {
    return 'unknown';
  }
}

async function extractTitleFromUrl(url) {
  try {
    const response = await fetch(url, { 
      method: 'GET',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DavesLinksBot/1.0)' },
      signal: AbortSignal.timeout(5000) // 5 second timeout
    });
    
    if (!response.ok) return null;
    
    const html = await response.text();
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    return titleMatch ? titleMatch[1].trim().substring(0, 200) : null; // Limit title length
  } catch (error) {
    return null;
  }
}

export async function createUser(db, username, password) {
  try {
    const passwordHash = await generatePasswordHash(password);
    const userHash = await generateUserHash(username);
    
    const result = await db.prepare(`
      INSERT INTO users (username, password_hash, user_hash)
      VALUES (?, ?, ?)
    `).bind(username, passwordHash, userHash).run();
    
    return {
      success: true,
      userId: result.meta.last_row_id,
      userHash
    };
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return {
        success: false,
        error: 'Username already exists'
      };
    }
    throw error;
  }
}

export async function getUserByUsername(db, username) {
  try {
    const user = await db.prepare(`
      SELECT id, username, password_hash, user_hash, created_at
      FROM users 
      WHERE username = ?
    `).bind(username).first();
    
    return user;
  } catch (error) {
    return null;
  }
}

export async function verifyUserPassword(db, username, password) {
  try {
    const user = await getUserByUsername(db, username);
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    const passwordHash = await generatePasswordHash(password);
    if (user.password_hash !== passwordHash) {
      return { success: false, error: 'Invalid credentials' };
    }

    return {
      success: true,
      user: {
        id: user.id,
        username: user.username,
        userHash: user.user_hash
      }
    };
  } catch (error) {
    return { success: false, error: 'Authentication failed' };
  }
}

export async function updateUserPassword(db, username, newPassword) {
  try {
    const newPasswordHash = await generatePasswordHash(newPassword);
    const result = await db.prepare(`
      UPDATE users 
      SET password_hash = ?, updated_at = CURRENT_TIMESTAMP
      WHERE username = ?
    `).bind(newPasswordHash, username).run();
    
    return {
      success: result.changes > 0,
      changes: result.changes
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function getUserLinks(db, userId) {
  try {
    const links = await db.prepare(`
      SELECT id, url, title, category, is_read, domain, date_added, timestamp
      FROM links 
      WHERE user_id = ?
      ORDER BY timestamp DESC
    `).bind(userId).all();
    
    // Format for frontend compatibility
    const formattedLinks = (links.results || []).map(link => ({
      id: link.id.toString(),
      url: link.url,
      title: link.title,
      category: link.category,
      isRead: link.is_read,
      domain: link.domain,
      dateAdded: link.date_added,
      timestamp: link.timestamp
    }));

    return {
      success: true,
      links: formattedLinks
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      links: []
    };
  }
}

export async function createLink(db, userId, linkData) {
  try {
    const { url, title, category = 'general' } = linkData;
    const domain = getDomainFromUrl(url);
    const finalTitle = title || await extractTitleFromUrl(url) || 'Untitled';
    
    const result = await db.prepare(`
      INSERT INTO links (user_id, url, title, category, domain, is_read)
      VALUES (?, ?, ?, ?, ?, 0)
    `).bind(userId, url, finalTitle, category, domain).run();
    
    // Fetch the created link
    const newLink = await db.prepare(`
      SELECT id, url, title, category, is_read, domain, date_added, timestamp
      FROM links 
      WHERE id = ?
    `).bind(result.meta.last_row_id).first();
    
    return {
      success: true,
      link: {
        id: newLink.id.toString(),
        url: newLink.url,
        title: newLink.title,
        category: newLink.category,
        isRead: newLink.is_read,
        domain: newLink.domain,
        dateAdded: newLink.date_added,
        timestamp: newLink.timestamp
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

export async function deleteLink(db, userId, linkId) {
  try {
    const result = await db.prepare(`
      DELETE FROM links 
      WHERE id = ? AND user_id = ?
    `).bind(linkId, userId).run();
    
    return {
      success: result.changes > 0,
      changes: result.changes
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

export async function markLinkAsRead(db, userId, linkId, isRead = 1) {
  try {
    const result = await db.prepare(`
      UPDATE links 
      SET is_read = ?
      WHERE id = ? AND user_id = ?
    `).bind(isRead, linkId, userId).run();
    
    return {
      success: result.changes > 0,
      changes: result.changes
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

export async function checkDatabaseHealth(db) {
  try {
    // Simple query to check if database is accessible
    const result = await db.prepare('SELECT COUNT(*) as count FROM users').first();
    return {
      status: 'connected',
      userCount: result.count
    };
  } catch (error) {
    return {
      status: 'error',
      error: error.message
    };
  }
}
