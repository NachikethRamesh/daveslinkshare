// Simple static file serving without KV

// JSONBin utility functions
async function fetchFromBin(binId, apiKey) {
  const response = await fetch(`https://api.jsonbin.io/v3/b/${binId}/latest`, {
    headers: {
      'X-Master-Key': apiKey,
      'X-Bin-Meta': 'false'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch from bin: ${response.status}`);
  }
  
  return await response.json();
}

async function updateBin(binId, apiKey, data) {
  const response = await fetch(`https://api.jsonbin.io/v3/b/${binId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Master-Key': apiKey,
      'X-Bin-Meta': 'false'
    },
    body: JSON.stringify(data)
  });
  
  if (!response.ok) {
    throw new Error(`Failed to update bin: ${response.status}`);
  }
  
  return await response.json();
}

// Common response headers
const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

function createResponse(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS_HEADERS });
}

function createErrorResponse(error, status = 500) {
  return new Response(JSON.stringify({ error }), { status, headers: CORS_HEADERS });
}

// Import API handlers
async function handleAuthLogin(request, env) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: CORS_HEADERS });
  }

  if (request.method === 'GET') {
    return createResponse({
      message: 'Login endpoint ready',
      method: 'GET',
      timestamp: new Date().toISOString()
    });
  }

  if (request.method === 'POST') {
    try {
      const requestData = await request.json();
      const { username, password } = requestData;

      if (!username || !password) {
        return createErrorResponse('Username and password required', 400);
      }

      const apiKey = env.JSONBIN_API_KEY;
      const authBinId = env.AUTH_BIN_ID;

      if (!apiKey || !authBinId) {
        return createErrorResponse('Server configuration error', 500);
      }

      // Check JSONBin for user
      let authData;
      try {
        authData = await fetchFromBin(authBinId, apiKey);
      } catch (error) {
        return createErrorResponse('Authentication service error', 503);
      }
      const userData = authData && authData[username];

      if (!userData) {
        return createErrorResponse('User not found', 404);
      }

      // Verify password if user has hashed password
      if (userData.password) {
        const passwordCheck = await verifyPassword(password, userData.password);
        if (!passwordCheck.valid) {
          return createErrorResponse('Invalid credentials', 401);
        }
        
        // If password needs upgrade, update it in the background
        if (passwordCheck.needsUpgrade) {
          try {
            const updatedData = {
              ...authData,
              [username]: {
                ...userData,
                password: passwordCheck.newHash
              }
            };
            
            await updateBin(authBinId, apiKey, updatedData);
          } catch (upgradeError) {
            // Silent fail - don't break login if upgrade fails
          }
        }
      }

      const token = btoa(JSON.stringify({ username, timestamp: Date.now() }));

      return createResponse({
        success: true,
        message: 'Login successful!',
        user: { username },
        token: token,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      return createErrorResponse('Internal server error', 500);
    }
  }

  return createErrorResponse('Method not allowed', 405);
}

async function handleAuthRegister(request, env) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: CORS_HEADERS });
  }

  if (request.method === 'POST') {
    try {
      const requestData = await request.json();
      const { username, password } = requestData;

      if (!username || !password) {
        return createErrorResponse('Username and password required', 400);
      }

      // Basic validation
      if (username.length < 3) {
        return createErrorResponse('Username must be at least 3 characters long', 400);
      }

      if (password.length < 6) {
        return createErrorResponse('Password must be at least 6 characters long', 400);
      }

      const apiKey = env.JSONBIN_API_KEY;
      const authBinId = env.AUTH_BIN_ID;

      if (!apiKey || !authBinId) {
        return createErrorResponse('Server configuration error', 500);
      }

      // Check if user already exists
      let existingData = {};
      try {
        existingData = await fetchFromBin(authBinId, apiKey);
      } catch (error) {
        return createErrorResponse('Authentication service error', 503);
      }
      
      if (existingData && existingData[username]) {
        return createErrorResponse('Username already exists', 409);
      }

      // Create user hash for password (simple hash for demo)
      const passwordHash = await generatePasswordHash(password);
      const userHash = await generateUserHash(username);

      // Add new user to existing data
      const updatedData = {
        ...existingData,
        [username]: {
          password: passwordHash,
          userHash: userHash,
          created: new Date().toISOString()
        }
      };

      // Update JSONBin with new user
      try {
        await updateBin(authBinId, apiKey, updatedData);
      } catch (error) {
        return createErrorResponse('Failed to create user account', 503);
      }

      // Generate token for immediate login
      const token = btoa(JSON.stringify({ username, timestamp: Date.now() }));

      return createResponse({
        success: true,
        message: 'Account created successfully!',
        user: { username },
        token: token,
        timestamp: new Date().toISOString()
      }, 201);

    } catch (error) {
      return createErrorResponse('Internal server error', 500);
    }
  }

  return createErrorResponse('Method not allowed', 405);
}

// Password hashing functions with backward compatibility
async function generatePasswordHash(password) {
  // Current SHA-256 method
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'salt_2025');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Legacy hashing methods for backward compatibility
function generatePasswordHashLegacy1(password) {
  // Simple btoa method (earliest version)
  return btoa(password);
}

async function generatePasswordHashLegacy2(password) {
  // SHA-256 without salt (intermediate version)
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Check password against all possible hashing methods
async function verifyPassword(inputPassword, storedHash) {
  // Try current method first
  const currentHash = await generatePasswordHash(inputPassword);
  if (currentHash === storedHash) {
    return { valid: true, needsUpgrade: false };
  }
  
  // Try legacy method 1 (btoa)
  const legacy1Hash = generatePasswordHashLegacy1(inputPassword);
  if (legacy1Hash === storedHash) {
    return { valid: true, needsUpgrade: true, newHash: currentHash };
  }
  
  // Try legacy method 2 (SHA-256 without salt)
  const legacy2Hash = await generatePasswordHashLegacy2(inputPassword);
  if (legacy2Hash === storedHash) {
    return { valid: true, needsUpgrade: true, newHash: currentHash };
  }
  
  return { valid: false, needsUpgrade: false };
}

// Simple user hash function - consistent hash based on username only
async function generateUserHash(username) {
  const encoder = new TextEncoder();
  const data = encoder.encode(username + 'user_salt_2025'); // Use consistent salt instead of timestamp
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
}

async function handlePasswordReset(request, env) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers });
  }

  if (request.method === 'POST') {
    try {
      const requestData = await request.json();
      const { username, newPassword } = requestData;

      if (!username || !newPassword) {
        return new Response(JSON.stringify({ 
          error: 'Username and new password required' 
        }), { status: 400, headers });
      }

      // Basic validation
      if (username.length < 3) {
        return createErrorResponse('Username must be at least 3 characters long', 400);
      }

      if (newPassword.length < 6) {
        return new Response(JSON.stringify({ 
          error: 'New password must be at least 6 characters long' 
        }), { status: 400, headers });
      }

      const apiKey = env.JSONBIN_API_KEY;
      const authBinId = env.AUTH_BIN_ID;

      if (!apiKey || !authBinId) {
        return createErrorResponse('Server configuration error', 500);
      }

      // Check if user exists
      const checkResponse = await fetch(`https://api.jsonbin.io/v3/b/${authBinId}/latest`, {
        headers: {
          'X-Master-Key': apiKey,
          'X-Bin-Meta': 'false'
        }
      });

      if (!checkResponse.ok) {
        return new Response(JSON.stringify({
          error: 'Authentication service error'
        }), { status: 503, headers });
      }

      const existingData = await checkResponse.json();
      
      if (!existingData || !existingData[username]) {
        return new Response(JSON.stringify({
          error: 'User not found'
        }), { status: 404, headers });
      }

      // Generate new password hash
      const newPasswordHash = await generatePasswordHash(newPassword);

      // Update user's password while preserving other data
      const updatedData = {
        ...existingData,
        [username]: {
          ...existingData[username],
          password: newPasswordHash,
          passwordResetAt: new Date().toISOString()
        }
      };

      // Update JSONBin with new password
      const updateResponse = await fetch(`https://api.jsonbin.io/v3/b/${authBinId}`, {
        method: 'PUT',
        headers: {
          'X-Master-Key': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updatedData)
      });

      if (!updateResponse.ok) {
        return new Response(JSON.stringify({
          error: 'Failed to reset password'
        }), { status: 503, headers });
      }

      // Generate token for immediate login
      const token = btoa(JSON.stringify({ username, timestamp: Date.now() }));

      return new Response(JSON.stringify({
        success: true,
        message: 'Password reset successfully!',
        user: { username },
        token: token,
        timestamp: new Date().toISOString()
      }), { status: 200, headers });

    } catch (error) {
      return createErrorResponse('Internal server error', 500);
    }
  }

  return createErrorResponse('Method not allowed', 405);
}

// Links API handler
async function handleLinks(request, env) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: CORS_HEADERS });
  }

  // Check authorization
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return createErrorResponse('Authorization required', 401);
  }

  const token = authHeader.substring(7);
  let username;
  try {
    const tokenData = JSON.parse(atob(token));
    username = tokenData.username;
  } catch (error) {
    return createErrorResponse('Invalid token', 401);
  }

  if (!username) {
    return createErrorResponse('Invalid token', 401);
  }

  const apiKey = env.JSONBIN_API_KEY;
  const linksBinId = env.LINKS_BIN_ID || env.AUTH_BIN_ID; // Fallback to auth bin if links bin not configured

  if (!apiKey || !linksBinId) {
    return createErrorResponse('Server configuration error', 500);
  }

  // Get user hash from auth data - must use the stored hash for consistency
  let userHash;
  try {
    const authData = await fetchFromBin(env.AUTH_BIN_ID, apiKey);
    const userData = authData[username];
    if (!userData) {
      return createErrorResponse('User not found', 404);
    }
    
    // MUST use the stored userHash from registration - never generate new one
    if (!userData.userHash) {
      return createErrorResponse('User hash not found - please re-register', 401);
    }
    
    userHash = userData.userHash;
  } catch (error) {
    return createErrorResponse('Failed to verify user', 503);
  }

  if (request.method === 'GET') {
    // Get user's links
    try {
      const allData = await fetchFromBin(linksBinId, apiKey);
      // For links, we use a "links" prefix to avoid conflicts with auth data
      let userLinks = allData[`links_${userHash}`] || [];

      // Sort links by timestamp (newest first)
      userLinks = userLinks.sort((a, b) => new Date(b.timestamp || b.dateAdded) - new Date(a.timestamp || a.dateAdded));

      return createResponse({
        success: true,
        links: userLinks
      });

    } catch (error) {
      return createErrorResponse('Failed to fetch links', 500);
    }
  }

  if (request.method === 'POST') {
    // Add new link
    try {
      const requestData = await request.json();
      const { url, title, category } = requestData;

      if (!url) {
        return createErrorResponse('URL is required', 400);
      }

      // Validate URL format
      try {
        new URL(url);
      } catch (urlError) {
        return createErrorResponse('Invalid URL format', 400);
      }

      // Get existing data
      let allData = {};
      try {
        allData = await fetchFromBin(linksBinId, apiKey);
      } catch (error) {
        // If bin doesn't exist, that's fine - we'll create it
      }

      const userLinks = allData[`links_${userHash}`] || [];
      
      // Create new link object
      const newLink = {
        id: Date.now().toString(),
        url: url,
        title: title || await extractTitleFromUrl(url) || 'Untitled',
        category: category || 'general',
        dateAdded: new Date().toISOString(),
        timestamp: new Date().toISOString(),
        domain: getDomainFromUrl(url),
        isRead: 0 // Default to unread (0)
      };

      // Add to user's links
      const updatedUserLinks = [...userLinks, newLink];
      
      // Update the bin
      const updatedData = {
        ...allData,
        [`links_${userHash}`]: updatedUserLinks
      };

      try {
        await updateBin(linksBinId, apiKey, updatedData);
      } catch (error) {
        return createErrorResponse('Failed to save link', 503);
      }

      return createResponse({
        success: true,
        message: 'Link saved successfully',
        link: newLink
      }, 201);

    } catch (error) {
      return createErrorResponse('Failed to add link', 500);
    }
  }

  if (request.method === 'DELETE') {
    // Delete link
    try {
      const url = new URL(request.url);
      const linkId = url.searchParams.get('id');

      if (!linkId) {
        return createErrorResponse('Link ID is required', 400);
      }

      // Get existing data
      let allData;
      try {
        allData = await fetchFromBin(linksBinId, apiKey);
      } catch (error) {
        return createErrorResponse('Failed to fetch links', 503);
      }

      const userLinks = allData[`links_${userHash}`] || [];
      
      // Remove the link
      const updatedUserLinks = userLinks.filter(link => link.id !== linkId);
      
      // Update the bin
      const updatedData = {
        ...allData,
        [`links_${userHash}`]: updatedUserLinks
      };

      try {
        await updateBin(linksBinId, apiKey, updatedData);
      } catch (error) {
        return createErrorResponse('Failed to delete link', 503);
      }

      return createResponse({
        success: true,
        message: 'Link deleted successfully'
      });

    } catch (error) {
      return createErrorResponse('Failed to delete link', 500);
    }
  }

  return createErrorResponse('Method not allowed', 405);
}

// Handle mark as read/unread
async function handleMarkRead(request, env) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: CORS_HEADERS });
  }

  // Check authorization
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return createErrorResponse('Authorization required', 401);
  }

  const token = authHeader.substring(7);
  let username;
  try {
    const tokenData = JSON.parse(atob(token));
    username = tokenData.username;
  } catch (error) {
    return createErrorResponse('Invalid token', 401);
  }

  if (!username) {
    return createErrorResponse('Invalid token', 401);
  }

  const apiKey = env.JSONBIN_API_KEY;
  const linksBinId = env.LINKS_BIN_ID || env.AUTH_BIN_ID;

  if (!apiKey || !linksBinId) {
    return createErrorResponse('Server configuration error', 500);
  }

  // Get user hash from auth data
  let userHash;
  try {
    const authData = await fetchFromBin(env.AUTH_BIN_ID, apiKey);
    const userData = authData[username];
    if (!userData) {
      return createErrorResponse('User not found', 404);
    }
    
    if (!userData.userHash) {
      return createErrorResponse('User hash not found - please re-register', 401);
    }
    
    userHash = userData.userHash;
  } catch (error) {
    return createErrorResponse('Failed to verify user', 503);
  }

  if (request.method === 'POST') {
    try {
      const requestData = await request.json();
      const { linkId, isRead } = requestData;

      if (!linkId || (isRead !== 0 && isRead !== 1)) {
        return createErrorResponse('Link ID and isRead flag (0 or 1) are required', 400);
      }

      // Get existing data
      let allData;
      try {
        allData = await fetchFromBin(linksBinId, apiKey);
      } catch (error) {
        return createErrorResponse('Failed to fetch links', 503);
      }

      const userLinks = allData[`links_${userHash}`] || [];
      
      // Find and update the link
      const linkIndex = userLinks.findIndex(link => link.id === linkId);
      if (linkIndex === -1) {
        return createErrorResponse('Link not found', 404);
      }

      userLinks[linkIndex].isRead = isRead;
      
      // Update the bin
      const updatedData = {
        ...allData,
        [`links_${userHash}`]: userLinks
      };

      try {
        await updateBin(linksBinId, apiKey, updatedData);
      } catch (error) {
        return createErrorResponse('Failed to update link', 503);
      }

      return createResponse({
        success: true,
        message: isRead === 1 ? 'Link marked as read' : 'Link marked as unread'
      });

    } catch (error) {
      return createErrorResponse('Failed to update link status', 500);
    }
  }

  return createErrorResponse('Method not allowed', 405);
}

// Helper functions for URL processing
async function extractTitleFromUrl(url) {
  try {
    const response = await fetch(url, { 
      method: 'HEAD',
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    // For now, just return domain as title since we can't easily parse HTML in Workers
    return getDomainFromUrl(url);
  } catch (error) {
    return getDomainFromUrl(url);
  }
}

function getDomainFromUrl(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch (error) {
    return 'Unknown';
  }
}


async function handleHealth(request, env) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  let jsonbinStatus = 'not_checked';
  let jsonbinError = null;

  if (env.JSONBIN_API_KEY && env.AUTH_BIN_ID) {
    try {
      const response = await fetch(`https://api.jsonbin.io/v3/b/${env.AUTH_BIN_ID}/latest`, {
        headers: {
          'X-Master-Key': env.JSONBIN_API_KEY,
          'X-Bin-Meta': 'false'
        }
      });
      
      jsonbinStatus = response.ok ? 'connected' : 'error';
      if (!response.ok) jsonbinError = `HTTP ${response.status}`;
    } catch (error) {
      jsonbinStatus = 'error';
      jsonbinError = error.message;
    }
  } else {
    jsonbinStatus = 'missing_config';
  }

  return new Response(JSON.stringify({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: {
      hasApiKey: !!env.JSONBIN_API_KEY,
      hasLinksBin: !!(env.LINKS_BIN_ID || env.AUTH_BIN_ID),
      hasAuthBin: !!env.AUTH_BIN_ID,
      hasJwtSecret: !!env.JWT_SECRET
    },
    jsonbin: {
      status: jsonbinStatus,
      error: jsonbinError
    }
  }), { status: 200, headers });
}


export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // API Routes
    if (path.startsWith('/api/auth/login')) {
      return handleAuthLogin(request, env);
    }

    if (path.startsWith('/api/auth/register')) {
      return handleAuthRegister(request, env);
    }

    if (path.startsWith('/api/auth/reset-password')) {
      return handlePasswordReset(request, env);
    }
    
    if (path.startsWith('/api/health')) {
      return handleHealth(request, env);
    }

    if (path.startsWith('/api/links/mark-read')) {
      return handleMarkRead(request, env);
    }

    if (path.startsWith('/api/links')) {
      return handleLinks(request, env);
    }

    // Serve static HTML for all routes (SPA)
    if (path === '/' || path === '/index.html' || path === '/login' || path === '/signup' || path === '/home' || path === '/dashboard' || path === '/reset-password') {
      return new Response(getIndexHTML(), {
        headers: { 'Content-Type': 'text/html' }
      });
    }

    if (path === '/styles.css') {
      return new Response(getStylesCSS(), {
        headers: { 'Content-Type': 'text/css' }
      });
    }

    if (path === '/app.js') {
      return new Response(getAppJS(), {
        headers: { 'Content-Type': 'application/javascript' }
      });
    }

    // Default fallback to index.html for SPA routing
    return new Response(getIndexHTML(), {
      headers: { 'Content-Type': 'text/html' }
    });
  },
};

// Static file content functions
function getIndexHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes, viewport-fit=cover">
    <meta name="format-detection" content="telephone=no">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="default">
    <title>Dave's Links</title>
    <meta name="description" content="Save and organize your links like Pocket">
    <link rel="stylesheet" href="styles.css">
    <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>ðŸ”—</text></svg>">
</head>
<body>
    <!-- Authentication Container -->
    <div id="authContainer" class="auth-container">
        <div class="auth-card">
            <div class="auth-header">
                <h1 id="authTitle" class="auth-title">Welcome back</h1>
                <p id="authSubtitle" class="auth-subtitle">Sign in to your account</p>
            </div>
            
            <form id="authForm">
                <div class="form-group">
                    <label for="username" class="form-label">Username</label>
                    <input 
                        type="text" 
                        id="username" 
                        class="form-input" 
                        placeholder="Enter your username"
                        required 
                        autocomplete="username"
                    >
                </div>
                
                <div class="form-group">
                    <label for="password" class="form-label">Password</label>
                    <input 
                        type="password" 
                        id="password" 
                        class="form-input" 
                        placeholder="Enter your password"
                        required 
                        autocomplete="current-password"
                    >
                </div>
                
                <button type="submit" id="authSubmit" class="btn btn-primary btn-full">
                    Sign In
                </button>
            </form>
            
            <div class="auth-toggle">
                <span id="authToggleText">Don't have an account?</span>
                <a id="authToggleLink" class="auth-toggle-link">Sign up</a>
            </div>
            
            <div class="auth-reset">
                <a id="resetPasswordLink" class="auth-reset-link">Forgot your password?</a>
            </div>
        </div>
    </div>

    <!-- Password Reset Container -->
    <div id="resetContainer" class="auth-container hidden">
        <div class="auth-card">
            <div class="auth-header">
                <h1 class="auth-title">Reset Password</h1>
                <p class="auth-subtitle">Enter your username and new password</p>
            </div>
            
            <form id="resetForm">
                <div class="form-group">
                    <label for="resetUsername" class="form-label">Username</label>
                    <input 
                        type="text" 
                        id="resetUsername" 
                        class="form-input" 
                        placeholder="Enter your username"
                        required 
                        autocomplete="username"
                    >
                </div>
                
                <div class="form-group">
                    <label for="newPassword" class="form-label">New Password</label>
                    <input 
                        type="password" 
                        id="newPassword" 
                        class="form-input" 
                        placeholder="Enter new password (min 6 characters)"
                        required 
                        autocomplete="new-password"
                    >
                </div>
                
                <div class="form-group">
                    <label for="confirmPassword" class="form-label">Confirm New Password</label>
                    <input 
                        type="password" 
                        id="confirmPassword" 
                        class="form-input" 
                        placeholder="Confirm new password"
                        required 
                        autocomplete="new-password"
                    >
                </div>
                
                <button type="submit" id="resetSubmit" class="btn btn-primary btn-full">
                    Reset Password
                </button>
            </form>
            
            <div class="auth-toggle">
                <a id="backToLoginLink" class="auth-toggle-link">â† Back to Sign In</a>
            </div>
        </div>
    </div>

    <!-- Main Application -->
    <div id="mainApp" class="app hidden">
        <!-- Header -->
        <header class="app-header">
            <div class="header-content">
                <h1 class="app-title">
                    ðŸ”— <span id="userGreeting">My Links</span>
                </h1>
                <button id="logoutBtn" class="logout-btn">Log out</button>
            </div>
        </header>

        <!-- Main Content -->
        <div class="container">
            <div class="main-content">
                <!-- Sidebar -->
                <aside class="sidebar">
                    <div class="sidebar-header">
                        <h2 class="sidebar-title">Add Link</h2>
                    </div>
                    <form id="addLinkForm" class="add-link-form">
                        <div class="form-group">
                            <label for="url" class="form-label">URL</label>
                            <input 
                                type="url" 
                                id="url" 
                                class="form-input" 
                                placeholder="https://example.com"
                                required
                            >
                        </div>
                        
                        <div class="form-group">
                            <label for="title" class="form-label">Title (optional)</label>
                            <input 
                                type="text" 
                                id="title" 
                                class="form-input" 
                                placeholder="Custom title"
                            >
                        </div>
                        
                        <div class="form-group">
                            <label for="category" class="form-label">Category</label>
                            <select id="category" class="form-select">
                                <option value="">Select Category</option>
                                <option value="Sports">Sports</option>
                                <option value="Entertainment">Entertainment</option>
                                <option value="Work">Work</option>
                                <option value="Business">Business</option>
                                <option value="Reading">Reading</option>
                                <option value="Technology">Technology</option>
                                <option value="Education">Education</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                        
                        <button type="submit" id="addBtn" class="btn btn-primary btn-full">
                            Save
                        </button>
                    </form>
                </aside>

                <!-- Content Area -->
                <main class="content-area">
                    <div class="content-header">
                        <h2 class="content-title">My Links</h2>
                    </div>
                    <div class="tabs">
                        <button id="unreadTab" class="tab-button active">To be read</button>
                        <button id="readTab" class="tab-button">Read</button>
                    </div>
                    <div id="links" class="links-container">
                        <div class="empty-state">
                            <div class="empty-icon">ðŸ“–</div>
                            <div class="empty-title">Your links are empty</div>
                            <div class="empty-description">Save your first link to get started</div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    </div>

    <!-- Status/Alert Container -->
    <div id="status" class="alert"></div>

    <!-- Scripts -->
    <script src="app.js"></script>
</body>
</html>`;
}

function getStylesCSS() {
  return `/* Dave's Links - Modern Clean Design */
:root {
    --primary-red: #ef4056;
    --primary-red-hover: #d73648;
    --primary-green: #00d084;
    --dark: #1a1a1a;
    --gray: #666666;
    --light-gray: #f7f7f7;
    --border: #e6e6e6;
    --white: #ffffff;
    --text-primary: #1a1a1a;
    --text-secondary: #666666;
    --text-light: #999999;
    --shadow: 0 1px 3px rgba(0,0,0,0.1);
    --shadow-hover: 0 2px 8px rgba(0,0,0,0.15);
    --radius: 4px;
    --font-primary: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}

* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: var(--font-primary);
    background: var(--white);
    color: var(--text-primary);
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    overflow-x: hidden;
    text-rendering: optimizeLegibility;
    -webkit-touch-callout: none;
    -webkit-tap-highlight-color: transparent;
}

/* Authentication Styles */
.auth-container {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--light-gray);
    padding: 20px;
}

.auth-card {
    background: var(--white);
    border-radius: 8px;
    box-shadow: var(--shadow);
    padding: 40px;
    width: 100%;
    max-width: 400px;
    border: 1px solid var(--border);
}

.auth-header {
    text-align: center;
    margin-bottom: 32px;
}

.auth-title {
    font-size: 28px;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 8px;
}

.auth-subtitle {
    font-size: 16px;
    color: var(--text-secondary);
    font-weight: 400;
}

.form-group {
    margin-bottom: 20px;
}

.form-label {
    display: block;
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary);
    margin-bottom: 6px;
}

.form-input, .form-select {
    width: 100%;
    padding: 12px 16px;
    font-size: 16px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--white);
    color: var(--text-primary);
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
    font-family: inherit;
}

.form-input:focus, .form-select:focus {
    outline: none;
    border-color: var(--primary-red);
    box-shadow: 0 0 0 3px rgba(239, 64, 86, 0.1);
}

.btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 12px 24px;
    font-size: 16px;
    font-weight: 500;
    border: none;
    border-radius: var(--radius);
    cursor: pointer;
    transition: all 0.2s ease;
    text-decoration: none;
    font-family: inherit;
    line-height: 1.2;
}

.btn-primary {
    background: var(--primary-red);
    color: var(--white);
}

.btn-primary:hover {
    background: var(--primary-red-hover);
    transform: translateY(-1px);
    box-shadow: var(--shadow-hover);
}

.btn-full {
    width: 100%;
}

.auth-toggle {
    text-align: center;
    margin-top: 24px;
    font-size: 14px;
    color: var(--text-secondary);
}

.auth-toggle-link {
    color: var(--primary-red);
    text-decoration: none;
    font-weight: 500;
    cursor: pointer;
}

.auth-toggle-link:hover {
    text-decoration: underline;
}

.auth-reset {
    text-align: center;
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid var(--border);
}

.auth-reset-link {
    color: var(--text-secondary);
    text-decoration: none;
    font-size: 14px;
    font-weight: 400;
    cursor: pointer;
    transition: color 0.2s ease;
}

.auth-reset-link:hover {
    color: var(--primary-red);
    text-decoration: underline;
}

/* Main App Styles */
.app {
    min-height: 100vh;
    background: var(--light-gray);
}

.app-header {
    background: var(--white);
    border-bottom: 1px solid var(--border);
    padding: 0;
    position: sticky;
    top: 0;
    z-index: 100;
    box-shadow: var(--shadow);
}

.header-content {
    max-width: 1200px;
    margin: 0 auto;
    padding: 16px 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.app-title {
    font-size: 20px;
    font-weight: 600;
    color: var(--text-primary);
    display: flex;
    align-items: center;
    gap: 8px;
}

.logout-btn {
    padding: 8px 16px;
    font-size: 14px;
    background: transparent;
    color: var(--text-secondary);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    cursor: pointer;
    transition: all 0.2s ease;
}

.logout-btn:hover {
    background: var(--light-gray);
    color: var(--text-primary);
}

.container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 24px 20px;
}

.main-content {
    display: grid;
    grid-template-columns: 350px 1fr;
    gap: 24px;
    align-items: start;
}

.sidebar {
    background: var(--white);
    border-radius: 8px;
    border: 1px solid var(--border);
    box-shadow: var(--shadow);
    position: sticky;
    top: 100px;
}

.sidebar-header {
    padding: 20px 20px 16px;
    border-bottom: 1px solid var(--border);
}

.sidebar-title {
    font-size: 18px;
    font-weight: 600;
    color: var(--text-primary);
}

.add-link-form {
    padding: 20px;
}

.content-area {
    background: var(--white);
    border-radius: 8px;
    border: 1px solid var(--border);
    box-shadow: var(--shadow);
    min-height: 500px;
    max-height: calc(100vh - 120px);
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.content-header {
    padding: 20px 20px 16px;
    border-bottom: 1px solid var(--border);
}

.content-title {
    font-size: 18px;
    font-weight: 600;
    color: var(--text-primary);
}

.links-container {
    padding: 20px;
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
}

/* Custom scrollbar styling */
.links-container::-webkit-scrollbar {
    width: 8px;
}

.links-container::-webkit-scrollbar-track {
    background: var(--background);
    border-radius: 4px;
}

.links-container::-webkit-scrollbar-thumb {
    background: var(--border);
    border-radius: 4px;
    transition: background 0.2s ease;
}

.links-container::-webkit-scrollbar-thumb:hover {
    background: var(--text-tertiary);
}

/* Firefox scrollbar */
.links-container {
    scrollbar-width: thin;
    scrollbar-color: var(--border) var(--background);
}

.empty-state {
    text-align: center;
    padding: 60px 20px;
    color: var(--text-secondary);
}

/* Link Items */
.link-item {
    background: var(--white);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 20px;
    margin-bottom: 16px;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    transition: all 0.2s ease;
    box-shadow: var(--shadow);
}

.link-item:hover {
    box-shadow: var(--shadow-hover);
    border-color: var(--primary-red);
}

.link-content {
    flex: 1;
    min-width: 0;
}

.link-title {
    margin: 0 0 8px 0;
    font-size: 16px;
    font-weight: 700;
    line-height: 1.4;
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.link-url {
    font-size: 12px;
    color: var(--text-secondary);
    font-family: monospace;
    word-break: break-all;
    opacity: 0.8;
}

.link-title a {
    color: var(--text-primary);
    text-decoration: none;
    transition: color 0.2s ease;
}

.link-title a:hover {
    color: var(--primary-red);
}

.link-meta {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 0 0 6px 0;
}

.link-domain {
    font-size: 14px;
    color: var(--text-secondary);
    font-weight: 500;
}

.link-category {
    background: var(--primary-red);
    color: var(--white);
    font-size: 9px;
    font-weight: 600;
    padding: 2px 7px;
    border-radius: 10px;
    text-transform: uppercase;
    letter-spacing: 0.4px;
}

.link-date {
    margin: 0;
    font-size: 12px;
    color: var(--text-tertiary);
}

.link-actions {
    display: flex;
    gap: 8px;
    margin-left: 16px;
    flex-shrink: 0;
}

.action-btn {
    background: white;
    border: none;
    color: var(--text-primary);
    cursor: pointer;
    padding: 7px 10px;
    border-radius: 15px;
    font-size: 10px;
    font-weight: 500;
    transition: all 0.2s ease;
    white-space: nowrap;
}

.action-btn:hover {
    background: var(--primary-red);
    color: white;
}




/* Tabs */
.tabs {
    display: flex;
    justify-content: center;
    margin: 17px 0 10px 0;
    background: #f5f5f5;
    border-radius: 21px;
    padding: 3px;
    width: fit-content;
    margin-left: auto;
    margin-right: auto;
}

.tab-button {
    background: transparent;
    border: none;
    outline: none;
    padding: 8px 17px;
    border-radius: 17px;
    cursor: pointer;
    font-size: 12px;
    font-weight: 500;
    color: #666;
    transition: all 0.3s ease;
    white-space: nowrap;
    min-width: 85px;
}

.tab-button:hover {
    color: #1a1a1a;
    outline: none;
}

.tab-button:focus {
    outline: none;
    border: none;
}

.tab-button.active {
    background: white;
    color: #1a1a1a;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    outline: none;
    border: none;
}

/* Loading and Pending States */
.loading-state {
    text-align: center;
    padding: 40px 20px;
    color: var(--text-secondary);
}

.loading-spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--border);
    border-top-color: var(--primary-red);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 16px;
}

.loading-text {
    font-size: 14px;
    color: var(--text-secondary);
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

.link-item.pending {
    opacity: 0.7;
    background: var(--light-gray);
}

.pending-indicator {
    font-size: 12px;
    color: var(--primary-red);
    font-weight: 500;
    margin-left: 8px;
    opacity: 0.8;
}

.action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    pointer-events: none;
}

.empty-title {
    font-size: 18px;
    font-weight: 500;
    margin-bottom: 8px;
    color: var(--text-primary);
}

.empty-description {
    font-size: 14px;
    color: var(--text-secondary);
}

/* Alert Styles */
.alert {
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 16px 20px;
    border-radius: var(--radius);
    font-weight: 500;
    z-index: 1000;
    max-width: 400px;
    box-shadow: var(--shadow-hover);
    display: none;
}

.alert-success {
    background: var(--primary-green);
    color: var(--white);
}

.alert-error {
    background: var(--primary-red);
    color: var(--white);
}

.alert-info {
    background: var(--white);
    color: var(--text-primary);
    border: 1px solid var(--border);
}

/* Mobile Touch Optimizations */
input, textarea, select, button {
    /* Prevent zoom on iOS when focusing inputs */
    font-size: 16px;
    /* Better touch targets */
    min-height: 44px;
    /* Improve touch responsiveness */
    touch-action: manipulation;
}

/* Better scrollable areas for mobile */
.links-container {
    /* Smooth scrolling on iOS */
    -webkit-overflow-scrolling: touch;
    /* Better momentum scrolling */
    scroll-behavior: smooth;
}

/* Prevent text selection on UI elements */
.btn, .action-btn, .auth-toggle-link {
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
    user-select: none;
    /* Remove tap highlight on mobile */
    -webkit-tap-highlight-color: transparent;
}

/* Better focus states for accessibility */
button:focus, input:focus, select:focus, textarea:focus {
    outline: 2px solid var(--primary-red);
    outline-offset: 2px;
}

/* Safe area adjustments for notched devices */
@supports (padding-top: env(safe-area-inset-top)) {
    .header-content {
        padding-top: calc(12px + env(safe-area-inset-top));
    }
    
    .container {
        padding-bottom: calc(16px + env(safe-area-inset-bottom));
    }
}

/* Utility Classes */
.hidden {
    display: none !important;
}

/* Responsive Design - Mobile-First Approach Based on Desktop Design */

/* Tablets (768px and up) */
@media (min-width: 768px) {
    .main-content {
        grid-template-columns: 300px 1fr;
        gap: 24px;
        padding: 0 20px;
    }
    
    .sidebar {
        order: 1;
    }
    
    .content-area {
        order: 2;
    }
}

/* Mobile devices (767px and below) */
@media (max-width: 767px) {
    body {
        font-size: 14px;
        background: var(--pocket-light-gray);
    }
    
    /* Auth card responsive */
    .auth-card {
        margin: 16px;
        padding: 24px 20px;
        max-width: none;
    }
    
    /* Main layout - single column */
    .main-content {
        grid-template-columns: 1fr;
        gap: 16px;
        padding: 0 12px;
    }
    
    /* Sidebar becomes top section */
    .sidebar {
        position: static;
        order: 1;
        width: 100%;
        background: var(--white);
        border-radius: var(--radius);
        box-shadow: var(--shadow);
        border: 1px solid var(--pocket-border);
        margin-bottom: 16px;
        padding: 16px;
    }
    
    .content-area {
        order: 2;
    }
    
    /* Container adjustments */
    .container {
        background: var(--white);
        border-radius: var(--radius);
        box-shadow: var(--shadow);
        border: 1px solid var(--pocket-border);
        margin-bottom: 16px;
        padding: 16px;
    }
    
    /* Header content */
    .header-content {
        padding: 16px;
        background: var(--white);
        border-radius: var(--radius);
        box-shadow: var(--shadow);
        border: 1px solid var(--pocket-border);
        margin-bottom: 16px;
    }
    
    /* Link items - desktop style adapted for mobile */
    .link-item {
        display: flex;
        flex-direction: column;
        padding: 16px;
        background: var(--white);
        border-radius: var(--radius);
        box-shadow: var(--shadow);
        border: 1px solid var(--pocket-border);
        margin-bottom: 12px;
        transition: all 0.2s ease;
        gap: 12px;
    }
    
    .link-item:hover {
        box-shadow: var(--shadow-hover);
        border-color: var(--pocket-red);
        transform: translateY(-1px);
    }
    
    /* Link content structure */
    .link-content {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 8px;
    }
    
    .link-title {
        font-size: 16px;
        font-weight: 700;
        color: var(--text-primary);
        line-height: 1.3;
        margin: 0;
    }
    
    .link-title a {
        color: var(--text-primary);
        text-decoration: none;
    }
    
    /* Hide URL on mobile */
    .link-url {
        display: none;
    }
    
    .link-meta {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        color: var(--text-light);
    }
    
    .link-category {
        background: var(--pocket-light-gray);
        color: var(--text-secondary);
        padding: 4px 8px;
        border-radius: 12px;
        font-size: 10px;
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }
    
    .link-date {
        font-size: 12px;
        color: var(--text-secondary);
        margin-top: 4px;
    }
    
    /* Action buttons - horizontal row */
    .link-actions {
        display: flex;
        flex-direction: row;
        gap: 8px;
        margin-top: 8px;
        opacity: 1;
    }
    
    .action-btn {
        flex: 1;
        background: white;
        border: none;
        color: var(--text-primary);
        cursor: pointer;
        padding: 8px 12px;
        border-radius: 15px;
        font-size: 11px;
        font-weight: 500;
        transition: all 0.2s ease;
        text-align: center;
        min-height: 32px;
    }
    
    .action-btn:hover {
        background: var(--pocket-red);
        color: white;
    }
    
    /* Form elements */
    .form-input, .form-select {
        font-size: 16px; /* Prevent zoom on iOS */
        padding: 12px;
        border: 1px solid var(--pocket-border);
        border-radius: var(--radius);
    }
    
    .btn {
        min-height: 44px; /* Better touch targets */
        padding: 12px 20px;
        font-size: 14px;
    }
    
    /* Typography adjustments */
    .app-title {
        font-size: 18px;
    }
    
    .content-title {
        font-size: 18px;
        margin-bottom: 16px;
    }
    
    .sidebar-title {
        font-size: 16px;
        margin-bottom: 16px;
    }
}

/* Small mobile devices (480px and below) */
@media (max-width: 480px) {
    .auth-card {
        margin: 12px;
        padding: 20px 16px;
    }
    
    .main-content {
        padding: 0 8px;
        gap: 12px;
    }
    
    .container, .sidebar, .header-content {
        margin-bottom: 12px;
        padding: 12px;
    }
    
    .link-item {
        padding: 12px;
        margin-bottom: 8px;
    }
    
    .link-title {
        font-size: 15px;
    }
    
    .action-btn {
        padding: 6px 8px;
        font-size: 10px;
        min-height: 28px;
    }
    
    .app-title {
        font-size: 16px;
    }
    
    .content-title {
        font-size: 16px;
    }
}

/* Very small devices (320px and below) */
@media (max-width: 320px) {
    .auth-card {
        margin: 8px;
        padding: 16px 12px;
    }
    
    .main-content {
        padding: 0 6px;
    }
    
    .container, .sidebar, .header-content {
        padding: 10px;
        margin-bottom: 10px;
    }
    
    .link-item {
        padding: 10px;
        margin-bottom: 6px;
    }
    
    .link-title {
        font-size: 14px;
    }
    
    .link-category {
        font-size: 9px;
        padding: 2px 6px;
    }
    
    .action-btn {
        padding: 4px 6px;
        font-size: 9px;
        min-height: 26px;
    }
}

/* IE/Edge specific fixes */
input::-ms-clear {
    display: none;
}

/* Focus styles for accessibility */
.btn:focus, .form-input:focus, .form-select:focus, .auth-toggle-link:focus {
    outline: 2px solid var(--primary-red);
    outline-offset: 2px;
}

/* High contrast mode support */
@media (prefers-contrast: high) {
    :root {
        --pocket-red: #cc0000;
        --pocket-green: #006600;
        --text-primary: #000000;
        --text-secondary: #333333;
    }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
    }
}`;
}

function getAppJS() {
  return `// Simplified app.js for Workers deployment
class LinksApp {
    constructor() {
        this.links = [];
        this.currentUser = null;
        this.token = localStorage.getItem('authToken');
        this.isLoginMode = true;
        this.apiBase = '/api';
        this.linksCache = new Map(); // Cache for links by user
        this.pendingSaves = new Set(); // Track pending saves
        this.lastSyncTime = 0; // Track last sync for caching
        this.currentRoute = '/';
        this.currentTab = 'unread'; // Default to 'To be read' tab
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupRouting();
        this.handleRoute();
    }
        margin-bottom: 16px;
        border-radius: var(--radius);
        box-shadow: var(--shadow);
        border: 1px solid var(--border);
    }

    .sidebar-header {
        margin-bottom: 12px;
    }

    .sidebar-title {
        font-size: 16px;
        font-weight: 500;
        color: var(--text-primary);
        margin: 0;
    }

    .content-area {
        order: 2; /* My Links section appears second */
    }

    .header-content {
        padding: 12px 16px;
        background: var(--white);
        margin: 6px 6px 0; /* narrower margins to increase usable width */
        border-radius: var(--radius);
        box-shadow: var(--shadow);
        border: 1px solid var(--border);
    }

    .container {
        padding: 16px 0px !important; /* Remove horizontal padding for consistent width */
        background: var(--white);
        margin: 0 6px 8px !important; /* consistent margins */
        border-radius: var(--radius);
        box-shadow: var(--shadow);
        border: 1px solid var(--border);
    }

    /* Desktop-style typography */
    .app-title {
        font-size: 18px;
        font-weight: 500;
        color: var(--text-primary);
    }

    .auth-title {
        font-size: 24px;
        font-weight: 600;
        color: var(--text-primary);
        margin-bottom: 8px;
    }

    .auth-subtitle {
        font-size: 14px;
        color: var(--text-secondary);
        margin-bottom: 20px;
    }

    .content-title {
        font-size: 18px;
        font-weight: 500;
        color: var(--text-primary);
        margin-bottom: 12px;
    }

    /* Smaller link items (desktop-style, compact) */
    .link-item {
        background: var(--white) !important;
        border: 1px solid var(--border) !important; /* Visible border like desktop */
        border-radius: var(--radius) !important;
        padding: 12px !important;
        margin-bottom: 8px !important;
        margin-left: 6px !important; /* Consistent margins */
        margin-right: 6px !important; /* Consistent margins */
        box-shadow: var(--shadow) !important;
        transition: all 0.2s ease !important;
        width: calc(100% - 12px) !important; /* Account for margins */
        max-width: calc(640px - 12px) !important; /* Consistent max width */
        height: 170px !important; /* Fixed height with !important */
        min-height: 170px !important; /* Ensure minimum height */
        max-height: 170px !important; /* Prevent expansion */
        display: flex !important;
        flex-direction: column !important;
        justify-content: space-between !important; /* Distribute content evenly */
        box-sizing: border-box !important;
        position: relative !important;
    }

    .link-item:hover {
        box-shadow: var(--shadow-hover);
        transform: translateY(-1px);
        border-color: var(--primary-red);
    }

    .link-title {
        font-size: 14px !important;
        font-weight: 700 !important;
        line-height: 1.3 !important;
        margin-bottom: 6px !important;
        color: var(--text-primary) !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
        display: -webkit-box !important;
        -webkit-line-clamp: 2 !important; /* Limit to exactly 2 lines */
        -webkit-box-orient: vertical !important;
        height: 36px !important; /* Fixed height for exactly 2 lines */
        max-height: 36px !important;
        word-wrap: break-word !important;
        hyphens: auto !important;
    }

    .link-title a {
        color: var(--text-primary);
        text-decoration: none;
        font-weight: 700;
    }

    /* Completely hide the URL and domain from display */
    .link-url { display: none !important; }
    .link-domain { display: none !important; }

    /* Desktop-style category tags */
    .link-category {
        font-size: 9px !important;
        font-weight: 500 !important;
        padding: 2px 7px !important;
        border-radius: 10px !important;
        background: var(--primary-red) !important;
        color: var(--white) !important;
        text-transform: uppercase !important;
        letter-spacing: 0.4px !important;
        white-space: nowrap !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
        max-width: 120px !important; /* Fixed max width for category */
        display: inline-block !important;
    }

    .link-meta {
        display: flex !important;
        align-items: center !important;
        gap: 6px !important;
        font-size: 12px !important;
        color: var(--text-secondary) !important;
        margin-bottom: 6px !important;
        height: 24px !important; /* Fixed height for meta area */
        flex-shrink: 0 !important;
    }

    .link-domain {
        color: var(--text-secondary);
        font-weight: 500;
    }

    .link-date {
        font-size: 12px !important;
        color: var(--text-secondary) !important;
        margin-bottom: 8px !important; /* Consistent spacing */
        height: 18px !important; /* Fixed height for date */
        flex-shrink: 0 !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
        white-space: nowrap !important;
        max-width: 100% !important;
    }

    .link-content {
        flex: 1 !important;
        display: flex !important;
        flex-direction: column !important;
        justify-content: flex-start !important;
        overflow: hidden !important; /* Prevent content overflow */
        height: calc(100% - 40px) !important; /* Account for button area */
        max-height: calc(100% - 40px) !important;
        min-height: 0 !important; /* Allow shrinking */
    }

    /* Desktop-style form elements */
    .form-group {
        margin-bottom: 12px;
    }

    .form-input, .form-select {
        width: 100%;
        padding: 12px;
        font-size: 16px; /* Prevents zoom on iOS */
        border: 1px solid var(--border);
        border-radius: var(--radius);
        background: var(--white);
        color: var(--text-primary);
        transition: border-color 0.2s ease;
    }

    .form-input:focus, .form-select:focus {
        outline: none;
        border-color: var(--primary-red);
        box-shadow: 0 0 0 2px rgba(239, 64, 86, 0.1);
    }

    .btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 12px 16px;
        font-size: 14px;
        font-weight: 500;
        border-radius: var(--radius);
        border: none;
        cursor: pointer;
        transition: all 0.2s ease;
        text-decoration: none;
        min-height: 40px;
    }

    .btn-primary {
        background: var(--primary-red);
        color: var(--white);
        font-weight: 500;
        padding: 12px 20px;
        min-height: 44px;
    }

    .btn-primary:hover {
        background: var(--primary-red-hover);
    }

    .btn-primary:active {
        background: var(--primary-red-hover);
    }

    /* Smaller action buttons */
    .action-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 8px 12px; /* Smaller padding */
        font-size: 12px; /* Smaller font */
        font-weight: 500;
        border-radius: 15px;
        border: none;
        background: white;
        color: var(--text-primary);
        min-height: 32px; /* Smaller height */
        min-width: 60px; /* Smaller width */
        transition: all 0.2s ease;
    }

    .action-btn:hover {
        background: var(--primary-red);
        color: white;
    }

    .action-btn:active {
        background: var(--border);
    }


    /* Horizontal action buttons row */
    .link-actions {
        display: flex !important;
        flex-direction: row !important;
        gap: 6px !important;
        margin-top: 0px !important; /* No extra margin, directly below date */
        flex-shrink: 0 !important;
        justify-content: space-between !important; /* Distribute evenly */
        width: 100% !important;
        height: 32px !important; /* Fixed height for button area */
        align-items: center !important;
    }

    .link-actions .action-btn {
        flex: 1 !important;
        justify-content: center !important;
        font-weight: 500 !important;
        height: 28px !important; /* Fixed height */
        min-height: 28px !important;
        max-height: 28px !important;
        padding: 4px 6px !important; /* Smaller padding for more space */
        font-size: 10px !important; /* Smaller font */
        background: white !important;
        border: none !important;
        color: var(--text-primary) !important;
        border-radius: 15px !important;
        transition: all 0.2s ease !important;
        box-sizing: border-box !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
        white-space: nowrap !important;
        max-width: 100px !important; /* Fixed max width for buttons */
    }

    .link-actions .action-btn:hover {
        background: var(--primary-red) !important;
        color: white !important;
    }

    /* Desktop-style empty state */
    .empty-state {
        text-align: center;
        padding: 32px 16px;
        color: var(--text-secondary);
    }

    .empty-title {
        font-size: 16px;
        font-weight: 500;
        margin-bottom: 6px;
        color: var(--text-primary);
    }

    .empty-subtitle {
        font-size: 14px;
        color: var(--text-secondary);
    }

    /* Desktop-style links container */
    .links-container {
        padding: 0;
        max-width: 680px; /* keep list width consistent while sections get wider */
        margin: 0 auto;
    }

    /* Desktop-style auth links */
    .auth-toggle-link,
    .reset-password-link,
    .back-to-login-link {
        color: var(--primary-red);
        text-decoration: none;
        font-size: 14px;
        font-weight: 500;
        padding: 6px 4px;
        border-radius: var(--radius);
        transition: background-color 0.2s ease;
    }

    .auth-toggle-link:hover,
    .reset-password-link:hover,
    .back-to-login-link:hover {
        background: rgba(239, 64, 86, 0.05);
    }

    /* Desktop-style pending indicator */
    .pending-indicator {
        background: var(--primary-red);
        color: var(--white);
        font-size: 10px;
        font-weight: 600;
        padding: 2px 4px;
        border-radius: var(--radius);
        text-transform: uppercase;
        letter-spacing: 0.02em;
        margin-left: 6px;
    }

    /* Mobile-specific tab styles */
    .tabs {
        display: flex !important;
        justify-content: center !important;
        margin: 17px 0 10px 0 !important;
        background: #f5f5f5 !important;
        border-radius: 21px !important;
        padding: 3px !important;
        width: fit-content !important;
        margin-left: auto !important;
        margin-right: auto !important;
    }

    .tab-button {
        background: transparent !important;
        border: none !important;
        outline: none !important;
        padding: 8px 17px !important;
        border-radius: 17px !important;
        cursor: pointer !important;
        font-size: 12px !important;
        font-weight: 500 !important;
        color: #666 !important;
        transition: all 0.3s ease !important;
        white-space: nowrap !important;
        min-width: 85px !important;
    }

    .tab-button:hover {
        color: #1a1a1a !important;
        outline: none !important;
    }

    .tab-button:focus {
        outline: none !important;
        border: none !important;
    }

    .tab-button.active {
        background: white !important;
        color: #1a1a1a !important;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1) !important;
        outline: none !important;
        border: none !important;
    }
}

/* Extra small phones - Desktop-inspired design */
@media (max-width: 320px) {
    .auth-card {
        padding: 20px 12px;
        margin: 8px 6px;
        border-radius: var(--radius);
    }

    .container {
        padding: 14px 8px;
        margin: 0 6px 10px;
        border-radius: var(--radius);
    }

    .sidebar {
        padding: 14px;
        margin: 0 6px 12px;
        border-radius: var(--radius);
    }

    .header-content {
        margin: 8px 6px 0;
        border-radius: var(--radius);
        padding: 10px 12px;
    }

    .link-item {
        padding: 10px; /* Even smaller for tiny screens */
        margin-bottom: 6px;
        border-radius: var(--radius);
    }

    .link-title {
        font-size: 13px;
        margin-bottom: 4px;
    }

    .link-meta {
        font-size: 11px;
        margin-bottom: 4px;
        gap: 4px;
    }

    .link-category {
        font-size: 9px;
        padding: 2px 4px;
    }

    .form-input, .form-select {
        padding: 10px 8px;
        border-radius: var(--radius);
    }

    .btn {
        padding: 10px 14px;
        border-radius: var(--radius);
        font-size: 13px;
    }

    .btn-primary {
        padding: 10px 16px;
        min-height: 40px;
    }

    .action-btn {
        padding: 6px 10px;
        font-size: 11px;
        min-width: 55px;
        border-radius: 15px;
        min-height: 30px;
    }

    .link-actions {
        gap: 4px;
        margin-top: 6px;
    }

    .app-title {
        font-size: 16px;
    }

    .auth-title {
        font-size: 22px;
    }

    .content-title {
        font-size: 16px;
    }

    .empty-title {
        font-size: 14px;
    }

    .empty-subtitle {
        font-size: 13px;
    }

    .pending-indicator {
        font-size: 9px;
        padding: 1px 3px;
        margin-left: 4px;
    }
}

/* Landscape orientation adjustments - Desktop-inspired design */
@media (max-height: 500px) and (orientation: landscape) {
    .auth-card {
        padding: 20px 16px;
        margin: 8px auto;
        border-radius: var(--radius);
    }

    .main-content {
        gap: 12px;
    }

    .sidebar {
        padding: 12px;
        border-radius: var(--radius);
        margin-bottom: 12px;
    }

    .container {
        padding: 12px 10px;
        border-radius: var(--radius);
        margin-bottom: 8px;
    }

    .header-content {
        padding: 10px 12px;
        border-radius: var(--radius);
        margin: 8px 8px 0;
    }

    .link-item {
        padding: 10px;
        border-radius: var(--radius);
        margin-bottom: 6px;
    }

    .auth-title {
        font-size: 20px;
    }

    .content-title {
        font-size: 16px;
    }

    .link-actions {
        gap: 4px;
        margin-top: 6px;
    }

    .action-btn {
        padding: 6px 8px;
        min-height: 28px;
        min-width: 50px;
        border-radius: 15px;
    }
}

/* Form improvements for cross-browser compatibility */
select.form-select {
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
    background-image: url("data:image/svg+xml;charset=US-ASCII,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 4 5'><path fill='%23666' d='M2 0L0 2h4zm0 5L0 3h4z'/></svg>");
    background-repeat: no-repeat;
    background-position: right 12px center;
    background-size: 12px;
    padding-right: 40px;
}

input.form-input {
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
}

/* Firefox specific fixes */
input[type="text"], input[type="password"], input[type="url"] {
    -moz-appearance: textfield;
}

/* IE/Edge specific fixes */
input::-ms-clear {
    display: none;
}

/* Focus styles for accessibility */
.btn:focus, .form-input:focus, .form-select:focus, .auth-toggle-link:focus {
    outline: 2px solid var(--primary-red);
    outline-offset: 2px;
}

/* High contrast mode support */
@media (prefers-contrast: high) {
    :root {
        --border: #000000;
        --text-secondary: #000000;
    }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
    }
}`;
}
