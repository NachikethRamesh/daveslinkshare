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
     <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🔗</text></svg>">
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
                     🔗 <span id="userGreeting">My Links</span>
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
                             <div class="empty-icon">📖</div>
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

    setupRouting() {
        // Handle browser back/forward buttons
        window.addEventListener('popstate', () => {
            this.handleRoute();
        });
    }

    navigateTo(path) {
        if (this.currentRoute !== path) {
            this.currentRoute = path;
            window.history.pushState({}, '', path);
            // Don't call handleRoute here to avoid recursion
            // Instead, directly handle the navigation
            this.handleNavigation(path);
        }
    }

    handleNavigation(path) {
        switch (path) {
            case '/':
            case '/login':
                this.isLoginMode = true;
                this.updateAuthUI();
                this.showAuthContainer();
                break;
            case '/signup':
                this.isLoginMode = false;
                this.updateAuthUI();
                this.showAuthContainer();
                break;
            case '/reset-password':
                this.showResetContainer();
                break;
            case '/home':
            case '/dashboard':
                // For navigation after login, load links asynchronously
                this.showMainApp();
                break;
        }
    }

    async handleRoute() {
        const path = window.location.pathname;
        this.currentRoute = path;

        // First, check authentication status
        let isAuthenticated = false;
        if (this.token) {
            try {
                const tokenData = JSON.parse(atob(this.token));
                if (tokenData && tokenData.username) {
                    this.currentUser = { username: tokenData.username };
                    // Quick check without API call for initial routing
                    isAuthenticated = true;
                }
            } catch (error) {
                localStorage.removeItem('authToken');
                this.token = null;
                this.currentUser = null;
            }
        }

        // Route based on path and auth status
        switch (path) {
            case '/':
                // Root path - redirect based on auth
                if (isAuthenticated) {
                    this.navigateTo('/home');
                } else {
                    this.navigateTo('/login');
                }
                break;
                
            case '/login':
                if (isAuthenticated) {
                    this.navigateTo('/home');
                } else {
                    this.isLoginMode = true;
                    this.updateAuthUI();
                    this.showAuthContainer();
                }
                break;
                
            case '/signup':
                if (isAuthenticated) {
                    this.navigateTo('/home');
                } else {
                    this.isLoginMode = false;
                    this.updateAuthUI();
                    this.showAuthContainer();
                }
                break;
            
            case '/reset-password':
                this.showResetContainer();
                break;
                
            case '/home':
            case '/dashboard':
                if (!isAuthenticated) {
                    this.navigateTo('/login');
                } else {
                    await this.showMainApp();
                }
                break;
                
            default:
                // Handle unknown routes - redirect to appropriate page
                if (isAuthenticated) {
                    this.navigateTo('/home');
                } else {
                    this.navigateTo('/login');
                }
                break;
        }
    }

    async apiRequest(endpoint, options = {}) {
        const url = \`\${this.apiBase}\${endpoint}\`;
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                ...(this.token && { 'Authorization': \`Bearer \${this.token}\` })
            }
        };

        const config = {
            ...defaultOptions,
            ...options,
            headers: {
                ...defaultOptions.headers,
                ...(options.headers || {})
            }
        };

        try {
            const response = await fetch(url, config);
            const contentType = response.headers.get('content-type');
            let data;
            
            if (contentType && contentType.includes('application/json')) {
                data = await response.json();
            } else {
                const text = await response.text();
                data = {
                    error: response.ok ? 'Invalid response format' : \`HTTP \${response.status}: \${response.statusText}\`,
                    details: text.substring(0, 200)
                };
            }

            if (!response.ok) {
                throw new Error(data.error || \`HTTP \${response.status}: \${response.statusText}\`);
            }

            return data;
        } catch (error) {
            if (error.name === 'SyntaxError' && error.message.includes('JSON')) {
                throw new Error('Server returned invalid response format');
            }
            throw error;
        }
    }

    async handleAuth(event) {
        event.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        if (!username || !password) {
            this.showStatus('Please enter both username and password', 'error');
            return;
        }

        try {
            if (this.isLoginMode) {
                const result = await this.apiRequest('/auth/login', {
                    method: 'POST',
                    body: JSON.stringify({ username, password })
                });

                if (result.success) {
                    this.token = result.token;
                    this.currentUser = result.user;
                    localStorage.setItem('authToken', this.token);
                    this.showStatus('Login successful!', 'success');
                    this.navigateTo('/home');
                } else if (result.error === 'User not found') {
                    // If user doesn't exist, automatically switch to signup mode
                    this.switchToSignup();
                    this.navigateTo('/signup');
                    this.showStatus('User not found. Please create an account.', 'info');
                    return;
                } else if (result.error === 'Invalid credentials') {
                    this.showStatus('Incorrect password. Please try again.', 'error');
                    return;
                }
            } else {
                const result = await this.apiRequest('/auth/register', {
                    method: 'POST',
                    body: JSON.stringify({ username, password })
                });

                if (result.success) {
                    this.token = result.token;
                    this.currentUser = result.user;
                    localStorage.setItem('authToken', this.token);
                    this.showStatus('Account created successfully!', 'success');
                    this.navigateTo('/home');
                }
            }
        } catch (error) {
            this.showStatus(error.message, 'error');
        }
    }

    showAuthContainer() {
        document.getElementById('authContainer').classList.remove('hidden');
        document.getElementById('resetContainer').classList.add('hidden');
        document.getElementById('mainApp').classList.add('hidden');
        
        // Clear any existing links when showing auth screen
        this.links = [];
    }

    showResetContainer() {
        document.getElementById('resetContainer').classList.remove('hidden');
        document.getElementById('authContainer').classList.add('hidden');
        document.getElementById('mainApp').classList.add('hidden');
    }

    showMainAppSync() {
        document.getElementById('authContainer').classList.add('hidden');
        document.getElementById('resetContainer').classList.add('hidden');
        document.getElementById('mainApp').classList.remove('hidden');
        if (this.currentUser) {
            document.getElementById('userGreeting').textContent = \`\${this.currentUser.username}'s Links\`;
        }
        this.clearAddLinkForm(); // Clear form when showing main app
        
        // Clear previous user's links and show empty state
        this.links = [];
        this.renderLinks(); // Show empty state immediately
    }

    async showMainApp() {
        this.showMainAppSync();
        // Load current user's links asynchronously
        await this.loadLinks(); 
    }

    clearAddLinkForm() {
        // Clear all form fields
        document.getElementById('addLinkForm').reset();
        
        // Ensure category dropdown is reset to default
        const categorySelect = document.getElementById('category');
        if (categorySelect) {
            categorySelect.selectedIndex = 0;
        }
    }

    async handlePasswordReset(event) {
        event.preventDefault();
        const username = document.getElementById('resetUsername').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (!username || !newPassword || !confirmPassword) {
            this.showStatus('Please fill in all fields', 'error');
            return;
        }

        if (newPassword !== confirmPassword) {
            this.showStatus('Passwords do not match', 'error');
            return;
        }

        if (newPassword.length < 6) {
            this.showStatus('Password must be at least 6 characters long', 'error');
            return;
        }

        try {
            const result = await this.apiRequest('/auth/reset-password', {
                method: 'POST',
                body: JSON.stringify({ username, newPassword })
            });

            if (result.success) {
                this.token = result.token;
                this.currentUser = result.user;
                localStorage.setItem('authToken', this.token);
                this.showStatus('Password reset successfully! You are now logged in.', 'success');
                this.navigateTo('/home');
            }
        } catch (error) {
            this.showStatus(error.message, 'error');
        }
    }

    async logout() {
        try {
            if (this.token) {
                await this.apiRequest('/auth/logout', { method: 'POST' });
            }
        } catch (error) {
            // Silent error handling
        } finally {
            this.token = null;
            this.currentUser = null;
            this.links = [];
            this.linksCache.clear(); // Clear all cached links
            this.pendingSaves.clear(); // Clear pending saves
            this.lastSyncTime = 0; // Reset sync time
            localStorage.removeItem('authToken');
            this.navigateTo('/login');
        }
    }

    showStatus(message, type = 'info') {
        // Notifications disabled site-wide per request
        return;
    }

    switchToSignup() {
        this.isLoginMode = false;
        this.updateAuthUI();
    }

    switchToLogin() {
        this.isLoginMode = true;
        this.updateAuthUI();
    }

    updateAuthUI() {
        const authTitle = document.getElementById('authTitle');
        const authSubtitle = document.getElementById('authSubtitle');
        const authSubmit = document.getElementById('authSubmit');
        const authToggleText = document.getElementById('authToggleText');
        const authToggleLink = document.getElementById('authToggleLink');

        if (this.isLoginMode) {
            authTitle.textContent = 'Welcome back';
            authSubtitle.textContent = 'Sign in to your account';
            authSubmit.textContent = 'Sign In';
            authToggleText.textContent = "Don't have an account?";
            authToggleLink.textContent = 'Sign up';
        } else {
            authTitle.textContent = 'Create Account';
            authSubtitle.textContent = 'Sign up for a new account';
            authSubmit.textContent = 'Sign Up';
            authToggleText.textContent = 'Already have an account?';
            authToggleLink.textContent = 'Sign in';
        }
    }

    setupEventListeners() {
        document.getElementById('authForm').addEventListener('submit', (e) => this.handleAuth(e));
        document.getElementById('resetForm').addEventListener('submit', (e) => this.handlePasswordReset(e));
        document.getElementById('logoutBtn').addEventListener('click', () => this.logout());
        
        document.getElementById('authToggleLink').addEventListener('click', (e) => {
            e.preventDefault();
            if (this.isLoginMode) {
                this.switchToSignup();
                this.navigateTo('/signup');
            } else {
                this.switchToLogin();
                this.navigateTo('/login');
            }
        });

        document.getElementById('resetPasswordLink').addEventListener('click', (e) => {
            e.preventDefault();
            this.navigateTo('/reset-password');
        });

        document.getElementById('backToLoginLink').addEventListener('click', (e) => {
            e.preventDefault();
            this.isLoginMode = true;
            this.updateAuthUI();
            this.navigateTo('/login');
        });

        // Add link form handler
        document.getElementById('addLinkForm').addEventListener('submit', (e) => this.handleAddLink(e));
        
        // Tab switching
        document.getElementById('unreadTab').addEventListener('click', () => this.switchTab('unread'));
        document.getElementById('readTab').addEventListener('click', () => this.switchTab('read'));
    }

    async handleAddLink(event) {
        event.preventDefault();
        
        const url = document.getElementById('url').value.trim();
        const title = document.getElementById('title').value.trim();
        const category = document.getElementById('category').value || 'general';

        if (!url) {
            this.showStatus('URL is required', 'error');
            return;
        }

        // Create optimistic link object
        const optimisticLink = {
            id: 'temp_' + Date.now(),
            url: url,
            title: title || this.extractDomainFromUrl(url),
            category: category,
            dateAdded: new Date().toISOString(),
            domain: this.extractDomainFromUrl(url),
            isPending: true // Mark as pending
        };

        // Optimistic update - add to UI immediately
        this.links.unshift(optimisticLink);
        this.renderLinks();
        this.clearAddLinkForm();
        this.showStatus('Saving link...', 'info');

        // Update cache
        if (this.currentUser) {
            this.linksCache.set(this.currentUser.username, [...this.links]);
        }

        try {
            const result = await this.apiRequest('/links', {
                method: 'POST',
                body: JSON.stringify({ url, title, category })
            });

            if (result.success) {
                // Replace optimistic link with real one
                const linkIndex = this.links.findIndex(link => link.id === optimisticLink.id);
                if (linkIndex !== -1) {
                    this.links[linkIndex] = result.link;
                    this.renderLinks();
                    
                    // Update cache
                    if (this.currentUser) {
                        this.linksCache.set(this.currentUser.username, [...this.links]);
                    }
                }
                this.showStatus('Link saved successfully!', 'success');
            } else {
                // Remove optimistic link on failure
                this.links = this.links.filter(link => link.id !== optimisticLink.id);
                this.renderLinks();
                this.showStatus(result.error || 'Failed to save link', 'error');
            }
        } catch (error) {
            // Remove optimistic link on error
            this.links = this.links.filter(link => link.id !== optimisticLink.id);
            this.renderLinks();
            this.showStatus('Failed to save link', 'error');
        }
    }

    extractDomainFromUrl(url) {
        try {
            return new URL(url).hostname.replace('www.', '');
        } catch {
            return 'Unknown';
        }
    }

    async loadLinks(forceRefresh = false) {
        if (!this.token || !this.currentUser) {
            this.links = [];
            this.renderLinks();
            return;
        }

        const cacheKey = this.currentUser.username;
        const now = Date.now();
        
        // Use cache if available and not forcing refresh (cache valid for 30 seconds)
        if (!forceRefresh && this.linksCache.has(cacheKey) && (now - this.lastSyncTime) < 30000) {
            this.links = this.linksCache.get(cacheKey);
            this.renderLinks();
            return;
        }

        try {
            // Show loading state only if no cached data
            if (!this.linksCache.has(cacheKey)) {
                this.showLoadingState();
            }

            const result = await this.apiRequest('/links');
            if (result.success) {
                // Double-check we still have the same user (prevent race conditions)
                if (this.currentUser && this.currentUser.username === cacheKey) {
                    this.links = result.links || [];
                    this.linksCache.set(cacheKey, this.links); // Cache the results
                    this.lastSyncTime = now;
                    this.renderLinks();
                } else {
                    // User logged out while request was in progress
                    this.links = [];
                    this.renderLinks();
                }
            } else {
                this.showStatus(result.error || 'Failed to load links', 'error');
            }
        } catch (error) {
            // If user not found, redirect to signup
            if (error.message && error.message.includes('User not found')) {
                this.logout();
                this.switchToSignup();
                this.navigateTo('/signup');
                this.showStatus('Account not found. Please create an account.', 'info');
                return;
            }
            this.showStatus('Failed to load links', 'error');
        }
    }

    showLoadingState() {
        const linksContainer = document.getElementById('links');
        linksContainer.innerHTML = \`
            <div class="loading-state">
                <div class="loading-spinner"></div>
                <div class="loading-text">Loading your links...</div>
            </div>
        \`;
    }

    renderLinks() {
        const linksContainer = document.getElementById('links');
        
        if (this.links.length === 0) {
            linksContainer.innerHTML = \`
                <div class="empty-state">
                    <div class="empty-title">Your links are empty</div>
                    <div class="empty-description">Save your first link to get started</div>
                </div>
            \`;
            return;
        }

        // Filter links based on current tab
        const filteredLinks = this.links.filter(link => {
            if (this.currentTab === 'read') {
                return link.isRead === 1;
            } else {
                return !link.isRead || link.isRead === 0;
            }
        });

        // Sort links by timestamp (newest first)
        const sortedLinks = filteredLinks.sort((a, b) => new Date(b.timestamp || b.dateAdded) - new Date(a.timestamp || a.dateAdded));

        linksContainer.innerHTML = sortedLinks.map(link => \`
            <div class="link-item \${link.isPending ? 'pending' : ''}" data-id="\${link.id}">
                <div class="link-content">
                    <h3 class="link-title">
                        <a href="\${link.url}" target="_blank" rel="noopener noreferrer">\${link.title}</a>
                        \${link.isPending ? '<span class="pending-indicator">Saving...</span>' : ''}
                    </h3>
                    <div class="link-meta">
                        <span class="link-category">\${link.category || 'general'}</span>
                    </div>
                    <p class="link-date">Added \${new Date(link.dateAdded).toLocaleDateString()}</p>
                </div>
                <div class="link-actions">
                    <button class="action-btn mark-read" onclick="app.markAsRead('\${link.id}')" title="Mark as read">Mark as read</button>
                    <button class="action-btn copy-btn" onclick="app.copyLink('\${link.url}')" title="Copy link" \${link.isPending ? 'disabled' : ''}>
                        Copy
                    </button>
                    <button class="action-btn delete-btn" onclick="app.deleteLink('\${link.id}')" title="Delete link" \${link.isPending ? 'disabled' : ''}>
                        Delete
                    </button>
                </div>
            </div>
        \`).join('');
    }

    async copyLink(url) {
        try {
            await navigator.clipboard.writeText(url);
            this.showStatus('Link copied to clipboard', 'success');
        } catch (error) {
            // Fallback for browsers that don't support clipboard API
            const textArea = document.createElement('textarea');
            textArea.value = url;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            this.showStatus('Link copied to clipboard', 'success');
        }
    }

    async deleteLink(linkId) {
        // Find the link to delete
        const linkIndex = this.links.findIndex(link => link.id === linkId);
        if (linkIndex === -1) return;

        const linkToDelete = this.links[linkIndex];
        
        // Optimistic delete - remove from UI immediately
        this.links.splice(linkIndex, 1);
        this.renderLinks();
        this.showStatus('Deleting link...', 'info');

        // Update cache
        if (this.currentUser) {
            this.linksCache.set(this.currentUser.username, [...this.links]);
        }

        try {
            const result = await this.apiRequest('/links?id=' + linkId, {
                method: 'DELETE'
            });

            if (result.success) {
                this.showStatus('Link deleted successfully', 'success');
            } else {
                // Restore link on failure
                this.links.splice(linkIndex, 0, linkToDelete);
                this.renderLinks();
                this.showStatus(result.error || 'Failed to delete link', 'error');
            }
        } catch (error) {
            // Restore link on error
            this.links.splice(linkIndex, 0, linkToDelete);
            this.renderLinks();
            this.showStatus('Failed to delete link', 'error');
        }
    }

    // Tab switching functionality
    switchTab(tab) {
        this.currentTab = tab;
        
        // Update tab button styles
        document.getElementById('unreadTab').classList.toggle('active', tab === 'unread');
        document.getElementById('readTab').classList.toggle('active', tab === 'read');
        
        // Re-render links with new filter
        this.renderLinks();
    }

    // Mark link as read (with optimistic updates for better performance)
    async markAsRead(linkId) {
        // Find the link
        const link = this.links.find(l => l.id === linkId);
        if (!link) return;

        // Optimistic update - mark as read immediately for instant UI response
        const originalReadStatus = link.isRead;
        link.isRead = 1;
        this.renderLinks(); // Instantly move to "Read" tab

        try {
            const result = await this.apiRequest('/links/mark-read', {
                method: 'POST',
                body: JSON.stringify({ linkId, isRead: 1 })
            });

            if (!result.success) {
                // Revert on failure
                link.isRead = originalReadStatus;
                this.renderLinks();
                this.showStatus('Failed to mark as read', 'error');
            }
        } catch (error) {
            // Revert on error
            link.isRead = originalReadStatus;
            this.renderLinks();
            this.showStatus('Failed to mark as read', 'error');
        }
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new LinksApp();
});`;
}
