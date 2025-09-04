// Simple static file serving without KV

// Import API handlers
async function handleAuthLogin(request, env) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers });
  }

  if (request.method === 'GET') {
    return new Response(JSON.stringify({
      message: 'Login endpoint ready',
      method: 'GET',
      timestamp: new Date().toISOString()
    }), { status: 200, headers });
  }

  if (request.method === 'POST') {
    try {
      const requestData = await request.json();
      const { username, password } = requestData;

      if (!username || !password) {
        return new Response(JSON.stringify({ 
          error: 'Username and password required' 
        }), { status: 400, headers });
      }

      const apiKey = env.JSONBIN_API_KEY;
      const authBinId = env.AUTH_BIN_ID;

      if (!apiKey || !authBinId) {
        return new Response(JSON.stringify({
          error: 'Server configuration error'
        }), { status: 500, headers });
      }

      // Check JSONBin for user
      const response = await fetch(`https://api.jsonbin.io/v3/b/${authBinId}/latest`, {
        headers: {
          'X-Master-Key': apiKey,
          'X-Bin-Meta': 'false'
        }
      });

      if (!response.ok) {
        return new Response(JSON.stringify({
          error: 'Authentication service error'
        }), { status: 503, headers });
      }

      const authData = await response.json();
      const userData = authData && authData[username];

      if (!userData) {
        return new Response(JSON.stringify({
          error: 'Invalid credentials'
        }), { status: 401, headers });
      }

      // Verify password if user has hashed password
      if (userData.password) {
        const passwordHash = await generatePasswordHash(password);
        if (userData.password !== passwordHash) {
          return new Response(JSON.stringify({
            error: 'Invalid credentials'
          }), { status: 401, headers });
        }
      }

      const token = btoa(JSON.stringify({ username, timestamp: Date.now() }));

      return new Response(JSON.stringify({
        success: true,
        message: 'Login successful!',
        user: { username },
        token: token,
        timestamp: new Date().toISOString()
      }), { status: 200, headers });

    } catch (error) {
      return new Response(JSON.stringify({ 
        error: 'Internal server error' 
      }), { status: 500, headers });
    }
  }

  return new Response(JSON.stringify({
    error: 'Method not allowed'
  }), { status: 405, headers });
}

async function handleAuthRegister(request, env) {
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
      const { username, password } = requestData;

      if (!username || !password) {
        return new Response(JSON.stringify({ 
          error: 'Username and password required' 
        }), { status: 400, headers });
      }

      // Basic validation
      if (username.length < 3) {
        return new Response(JSON.stringify({ 
          error: 'Username must be at least 3 characters long' 
        }), { status: 400, headers });
      }

      if (password.length < 6) {
        return new Response(JSON.stringify({ 
          error: 'Password must be at least 6 characters long' 
        }), { status: 400, headers });
      }

      const apiKey = env.JSONBIN_API_KEY;
      const authBinId = env.AUTH_BIN_ID;

      if (!apiKey || !authBinId) {
        return new Response(JSON.stringify({
          error: 'Server configuration error'
        }), { status: 500, headers });
      }

      // First, check if user already exists
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
      
      if (existingData && existingData[username]) {
        return new Response(JSON.stringify({
          error: 'Username already exists'
        }), { status: 409, headers });
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
          error: 'Failed to create user account'
        }), { status: 503, headers });
      }

      // Generate token for immediate login
      const token = btoa(JSON.stringify({ username, timestamp: Date.now() }));

      return new Response(JSON.stringify({
        success: true,
        message: 'Account created successfully!',
        user: { username },
        token: token,
        timestamp: new Date().toISOString()
      }), { status: 201, headers });

    } catch (error) {
      return new Response(JSON.stringify({ 
        error: 'Internal server error' 
      }), { status: 500, headers });
    }
  }

  return new Response(JSON.stringify({
    error: 'Method not allowed'
  }), { status: 405, headers });
}

// Simple password hashing function
async function generatePasswordHash(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'salt_2025');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Simple user hash function
async function generateUserHash(username) {
  const encoder = new TextEncoder();
  const data = encoder.encode(username + Date.now());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
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
      hasLinksBin: !!env.LINKS_BIN_ID,
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
    
    if (path.startsWith('/api/health')) {
      return handleHealth(request, env);
    }

    // Serve static HTML directly
    if (path === '/' || path === '/index.html') {
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
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
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
        </div>
    </div>

    <!-- Main Application -->
    <div id="mainApp" class="app hidden">
        <!-- Header -->
        <header class="app-header">
            <div class="header-content">
                <h1 class="app-title">
                    🔗 <span id="userGreeting">My List</span>
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
                        <h2 class="content-title">My List</h2>
                    </div>
                    <div id="links" class="links-container">
                        <div class="empty-state">
                            <div class="empty-icon">📖</div>
                            <div class="empty-title">Your reading list is empty</div>
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
  return `/* CSS content would go here - simplified for now */
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; }
.auth-container { display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #f5f5f5; }
.auth-card { background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); width: 100%; max-width: 400px; }
.form-group { margin-bottom: 1rem; }
.form-label { display: block; margin-bottom: 0.5rem; font-weight: 500; }
.form-input { width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 4px; }
.btn { padding: 0.75rem 1rem; border: none; border-radius: 4px; cursor: pointer; }
.btn-primary { background: #007cba; color: white; }
.btn-full { width: 100%; }
.hidden { display: none; }
.app-header { background: white; border-bottom: 1px solid #eee; padding: 1rem 0; }
.header-content { max-width: 1200px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; padding: 0 1rem; }
.container { max-width: 1200px; margin: 0 auto; padding: 2rem 1rem; }
.main-content { display: grid; grid-template-columns: 350px 1fr; gap: 2rem; }
.sidebar { background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
.content-area { background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
.empty-state { text-align: center; padding: 3rem 1rem; color: #666; }
.alert { position: fixed; top: 1rem; right: 1rem; padding: 1rem; border-radius: 4px; z-index: 1000; }`;
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
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkAuthStatus();
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

    async checkAuthStatus() {
        if (this.token) {
            try {
                const response = await this.apiRequest('/health');
                if (response) {
                    this.showMainApp();
                    return;
                }
            } catch (error) {
                localStorage.removeItem('authToken');
                this.token = null;
            }
        }
        this.showAuthContainer();
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
                    this.showMainApp();
                    this.showStatus('Login successful!', 'success');
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
                    this.showMainApp();
                    this.showStatus('Account created successfully!', 'success');
                }
            }
        } catch (error) {
            this.showStatus(error.message, 'error');
        }
    }

    showAuthContainer() {
        document.getElementById('authContainer').classList.remove('hidden');
        document.getElementById('mainApp').classList.add('hidden');
    }

    showMainApp() {
        document.getElementById('authContainer').classList.add('hidden');
        document.getElementById('mainApp').classList.remove('hidden');
        if (this.currentUser) {
            document.getElementById('userGreeting').textContent = \`\${this.currentUser.username}'s List\`;
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
            localStorage.removeItem('authToken');
            this.showAuthContainer();
        }
    }

    showStatus(message, type = 'info') {
        const statusEl = document.getElementById('status');
        statusEl.textContent = message;
        statusEl.className = \`alert alert-\${type}\`;
        statusEl.style.display = 'block';
        
        setTimeout(() => {
            statusEl.style.display = 'none';
        }, 5000);
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
        document.getElementById('logoutBtn').addEventListener('click', () => this.logout());
        document.getElementById('authToggleLink').addEventListener('click', (e) => {
            e.preventDefault();
            if (this.isLoginMode) {
                this.switchToSignup();
            } else {
                this.switchToLogin();
            }
        });
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new LinksApp();
});`;
}
