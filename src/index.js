// Dave's Links App - Cloudflare Worker with D1 Database
// Clean, consolidated implementation without JSONBin dependencies

import { handleAuthLogin, handleAuthRegister, handlePasswordReset, handleAuthLogout } from './auth.js';
import { handleLinks, handleMarkRead } from './links.js';
import { checkDatabaseHealth } from './database.js';

// Common response headers
const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

function createResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: CORS_HEADERS
  });
}

function createErrorResponse(message, status = 400) {
  return createResponse({ success: false, error: message }, status);
}

// Health check handler
async function handleHealth(request, env) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  try {
    const dbHealth = await checkDatabaseHealth(env.DB);
    
    return new Response(JSON.stringify({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '2.0.0',
      environment: {
        hasDatabase: !!env.DB,
        hasJwtSecret: !!env.JWT_SECRET,
        nodeEnv: env.NODE_ENV || 'production'
      },
      database: dbHealth
    }), {
      status: 200,
      headers
    });

  } catch (error) {
    return new Response(JSON.stringify({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message
    }), {
      status: 500,
      headers
    });
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 200, headers: CORS_HEADERS });
    }

    // API Routes
    if (path === '/api/health') {
      return handleHealth(request, env);
    }

    if (path === '/api/auth/login') {
      return handleAuthLogin(request, env);
    }

    if (path === '/api/auth/register') {
      return handleAuthRegister(request, env);
    }

    if (path === '/api/auth/reset-password') {
      return handlePasswordReset(request, env);
    }

    if (path === '/api/auth/logout') {
      return handleAuthLogout(request, env);
    }

    if (path === '/api/links') {
      return handleLinks(request, env);
    }

    if (path === '/api/links/mark-read') {
      return handleMarkRead(request, env);
    }

    // Static file serving
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
  }
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
                <a id="backToLoginLink" class="auth-toggle-link">← Back to Sign In</a>
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
</html>
`;
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
    color: var(--text-secondary);
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

.hidden {
    display: none !important;
}

/* Responsive Design */
@media (max-width: 768px) {
    .main-content {
        grid-template-columns: 1fr;
        gap: 16px;
    }
    
    .sidebar {
        position: static;
        order: 1;
    }
    
    .content-area {
        order: 2;
    }
    
    .link-item {
        flex-direction: column;
        gap: 12px;
    }
    
    .link-actions {
        margin-left: 0;
        margin-top: 8px;
        flex-direction: row;
    }
    
    .action-btn {
        flex: 1;
        text-align: center;
    }
}
`;
}

function getAppJS() {
  return `// Dave's Links App - Client-side JavaScript
class LinksApp {
    constructor() {
        this.links = [];
        this.currentUser = null;
        this.token = localStorage.getItem('authToken');
        this.isLoginMode = true;
        this.apiBase = '/api';
        this.linksCache = new Map();
        this.pendingSaves = new Set();
        this.lastSyncTime = 0;
        this.currentRoute = '/';
        this.currentTab = 'unread';
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupRouting();
        this.handleRoute();
    }

    setupRouting() {
        window.addEventListener('popstate', () => {
            this.handleRoute();
        });
    }

    navigateTo(path) {
        if (this.currentRoute !== path) {
            this.currentRoute = path;
            window.history.pushState({}, '', path);
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
                this.showMainApp();
                break;
        }
    }

    async handleRoute() {
        const path = window.location.pathname;
        this.currentRoute = path;

        let isAuthenticated = false;
        if (this.token) {
            try {
                const tokenData = JSON.parse(atob(this.token));
                if (tokenData && tokenData.username) {
                    this.currentUser = { username: tokenData.username };
                    isAuthenticated = true;
                }
            } catch (error) {
                localStorage.removeItem('authToken');
                this.token = null;
                this.currentUser = null;
            }
        }

        switch (path) {
            case '/':
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
                if (isAuthenticated) {
                    this.navigateTo('/home');
                } else {
                    this.navigateTo('/login');
                }
                break;
        }
    }

    async apiRequest(endpoint, options = {}) {
        const url = \\\`\\\${this.apiBase}\\\${endpoint}\\\`;
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                ...(this.token && { 'Authorization': \\\`Bearer \\\${this.token}\\\` })
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
                    error: response.ok ? 'Invalid response format' : \\\`HTTP \\\${response.status}: \\\${response.statusText}\\\`,
                    details: text.substring(0, 200)
                };
            }

            if (!response.ok) {
                throw new Error(data.error || \\\`HTTP \\\${response.status}: \\\${response.statusText}\\\`);
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
            document.getElementById('userGreeting').textContent = \\\`\\\${this.currentUser.username}'s Links\\\`;
        }
        this.clearAddLinkForm();
        this.links = [];
        this.renderLinks();
    }

    async showMainApp() {
        this.showMainAppSync();
        await this.loadLinks(); 
    }

    clearAddLinkForm() {
        document.getElementById('addLinkForm').reset();
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
            this.linksCache.clear();
            this.pendingSaves.clear();
            this.lastSyncTime = 0;
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

        document.getElementById('addLinkForm').addEventListener('submit', (e) => this.handleAddLink(e));
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

        const optimisticLink = {
            id: 'temp_' + Date.now(),
            url: url,
            title: title || this.extractDomainFromUrl(url),
            category: category,
            dateAdded: new Date().toISOString(),
            domain: this.extractDomainFromUrl(url),
            isPending: true
        };

        this.links.unshift(optimisticLink);
        this.renderLinks();
        this.clearAddLinkForm();
        this.showStatus('Saving link...', 'info');

        if (this.currentUser) {
            this.linksCache.set(this.currentUser.username, [...this.links]);
        }

        try {
            const result = await this.apiRequest('/links', {
                method: 'POST',
                body: JSON.stringify({ url, title, category })
            });

            if (result.success) {
                const linkIndex = this.links.findIndex(link => link.id === optimisticLink.id);
                if (linkIndex !== -1) {
                    this.links[linkIndex] = result.link;
                    this.renderLinks();
                    
                    if (this.currentUser) {
                        this.linksCache.set(this.currentUser.username, [...this.links]);
                    }
                }
                this.showStatus('Link saved successfully!', 'success');
            } else {
                this.links = this.links.filter(link => link.id !== optimisticLink.id);
                this.renderLinks();
                this.showStatus(result.error || 'Failed to save link', 'error');
            }
        } catch (error) {
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
        
        if (!forceRefresh && this.linksCache.has(cacheKey) && (now - this.lastSyncTime) < 30000) {
            this.links = this.linksCache.get(cacheKey);
            this.renderLinks();
            return;
        }

        try {
            if (!this.linksCache.has(cacheKey)) {
                this.showLoadingState();
            }

            const result = await this.apiRequest('/links');
            if (result.success) {
                if (this.currentUser && this.currentUser.username === cacheKey) {
                    this.links = result.links || [];
                    this.linksCache.set(cacheKey, this.links);
                    this.lastSyncTime = now;
                    this.renderLinks();
                } else {
                    this.links = [];
                    this.renderLinks();
                }
            } else {
                this.showStatus(result.error || 'Failed to load links', 'error');
            }
        } catch (error) {
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
        linksContainer.innerHTML = \\\`
            <div class="loading-state">
                <div class="loading-spinner"></div>
                <div class="loading-text">Loading your links...</div>
            </div>
        \\\`;
    }

    renderLinks() {
        const linksContainer = document.getElementById('links');
        
        if (this.links.length === 0) {
            linksContainer.innerHTML = \\\`
                <div class="empty-state">
                    <div class="empty-title">Your links are empty</div>
                    <div class="empty-description">Save your first link to get started</div>
                </div>
            \\\`;
            return;
        }

        const filteredLinks = this.links.filter(link => {
            if (this.currentTab === 'read') {
                return link.isRead === 1;
            } else {
                return !link.isRead || link.isRead === 0;
            }
        });

        const sortedLinks = filteredLinks.sort((a, b) => new Date(b.timestamp || b.dateAdded) - new Date(a.timestamp || a.dateAdded));

        linksContainer.innerHTML = sortedLinks.map(link => \\\`
            <div class="link-item \\\${link.isPending ? 'pending' : ''}" data-id="\\\${link.id}">
                <div class="link-content">
                    <h3 class="link-title">
                        <a href="\\\${link.url}" target="_blank" rel="noopener noreferrer">\\\${link.title}</a>
                        \\\${link.isPending ? '<span class="pending-indicator">Saving...</span>' : ''}
                    </h3>
                    <div class="link-meta">
                        <span class="link-category">\\\${link.category || 'general'}</span>
                    </div>
                    <p class="link-date">Added \\\${new Date(link.dateAdded).toLocaleDateString()}</p>
                </div>
                <div class="link-actions">
                    <button class="action-btn mark-read" onclick="app.markAsRead('\\\${link.id}')" title="Mark as read">Mark as read</button>
                    <button class="action-btn copy-btn" onclick="app.copyLink('\\\${link.url}')" title="Copy link" \\\${link.isPending ? 'disabled' : ''}>
                        Copy
                    </button>
                    <button class="action-btn delete-btn" onclick="app.deleteLink('\\\${link.id}')" title="Delete link" \\\${link.isPending ? 'disabled' : ''}>
                        Delete
                    </button>
                </div>
            </div>
        \\\`).join('');
    }

    async copyLink(url) {
        try {
            await navigator.clipboard.writeText(url);
            this.showStatus('Link copied to clipboard', 'success');
        } catch (error) {
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
        const linkIndex = this.links.findIndex(link => link.id === linkId);
        if (linkIndex === -1) return;

        const linkToDelete = this.links[linkIndex];
        
        this.links.splice(linkIndex, 1);
        this.renderLinks();
        this.showStatus('Deleting link...', 'info');

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
                this.links.splice(linkIndex, 0, linkToDelete);
                this.renderLinks();
                this.showStatus(result.error || 'Failed to delete link', 'error');
            }
        } catch (error) {
            this.links.splice(linkIndex, 0, linkToDelete);
            this.renderLinks();
            this.showStatus('Failed to delete link', 'error');
        }
    }

    switchTab(tab) {
        this.currentTab = tab;
        
        document.getElementById('unreadTab').classList.toggle('active', tab === 'unread');
        document.getElementById('readTab').classList.toggle('active', tab === 'read');
        
        this.renderLinks();
    }

    async markAsRead(linkId) {
        const link = this.links.find(l => l.id === linkId);
        if (!link) return;

        const originalReadStatus = link.isRead;
        link.isRead = 1;
        this.renderLinks();

        try {
            const result = await this.apiRequest('/links/mark-read', {
                method: 'POST',
                body: JSON.stringify({ linkId, isRead: 1 })
            });

            if (!result.success) {
                link.isRead = originalReadStatus;
                this.renderLinks();
                this.showStatus('Failed to mark as read', 'error');
            }
        } catch (error) {
            link.isRead = originalReadStatus;
            this.renderLinks();
            this.showStatus('Failed to mark as read', 'error');
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new LinksApp();
});
`;
}
