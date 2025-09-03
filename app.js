// Dave's Links - Clean, Refactored Version
class LinksApp {
    constructor() {
        this.links = [];
        this.currentUser = null;
        this.isLoginMode = true;
        this.isConfigured = false;
        this.isAuthConfigured = false;
        
        this.init();
    }

    init() {
        this.checkConfiguration();
        this.setupEventListeners();
        this.checkExistingSession();
    }

    checkConfiguration() {
        // Dynamic configuration check - just verify values exist
        this.isConfigured = !!(CONFIG.BIN_ID && CONFIG.API_KEY && 
                              CONFIG.BIN_ID.length > 10 && CONFIG.API_KEY.length > 10);
        this.isAuthConfigured = !!(CONFIG.AUTH_BIN_ID && CONFIG.API_KEY && 
                                  CONFIG.AUTH_BIN_ID.length > 10 && CONFIG.API_KEY.length > 10);
        
        
        if (!this.isConfigured && this.currentUser) {
            document.getElementById('configWarning').style.display = 'block';
        }
    }

    // Utility Methods - Cryptographic
    async createSHA256Hash(input, salt = '') {
        const encoder = new TextEncoder();
        const data = encoder.encode(input + salt);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    async hashPassword(password) {
        return await this.createSHA256Hash(password, 'davelinks_salt_2024');
    }

    async generateUserHash(username, timestamp) {
        const entropy = [
            username, timestamp, Date.now().toString(), Math.random().toString(36),
            crypto.getRandomValues(new Uint8Array(16)).toString(),
            navigator.userAgent.slice(-20), 'davelinks_user_salt_2024'
        ].join('|');
        
        const fullHash = await this.createSHA256Hash(entropy);
        return fullHash.substring(0, 16);
    }

    // Legacy hash method for backward compatibility
    hashPasswordLegacy(password) {
        let hash = 0;
        for (let i = 0; i < password.length; i++) {
            const char = password.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString();
    }





    // Utility Methods - General
    processUrl(url) {
        try {
            const urlObj = new URL(url);
            const domain = urlObj.hostname.replace('www.', '');
            return {
                domain,
                title: domain.charAt(0).toUpperCase() + domain.slice(1),
                isValid: true
            };
        } catch {
            return { domain: url, title: url, isValid: false };
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    timeAgo(timestamp) {
        const diff = Date.now() - new Date(timestamp);
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);
        
        if (minutes < 1) return 'just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        
        return new Date(timestamp).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: new Date().getFullYear() !== new Date(timestamp).getFullYear() ? 'numeric' : undefined
        });
    }

    showStatus(message, type) {
        const status = document.getElementById('status');
        status.textContent = message;
        status.className = `alert alert-${type}`;
        status.classList.add('show');
        
        setTimeout(() => {
            status.classList.remove('show');
        }, 3000);
    }

    // Cloud API Methods
    async makeCloudRequest(binId, method = 'GET', data = null) {
        try {

            
            const options = {
                method,
                headers: {
                    'X-Master-Key': CONFIG.API_KEY,
                    'Content-Type': 'application/json'
                }
            };

            if (data && method !== 'GET') {
                options.body = JSON.stringify(data);

            }

            const url = `https://api.jsonbin.io/v3/b/${binId}`;

            
            const response = await fetch(url, options);

            
            if (!response.ok) {
                const errorText = await response.text();
                this.showStatus(`API Error: ${response.status} - ${errorText}`, 'error');
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            const result = await response.json();
            return method === 'GET' ? result.record : true;
        } catch (error) {
            this.showStatus(`Network Error: ${error.message}`, 'error');
            return null;
        }
    }

    // Authentication Methods
    async fetchUsers() {
        if (this.isAuthConfigured) {
            const cloudUsers = await this.makeCloudRequest(CONFIG.AUTH_BIN_ID);
            if (cloudUsers?.users) {
                // Sync to local backup
                localStorage.setItem('daveLinksUsers', JSON.stringify(cloudUsers.users));
                return cloudUsers.users;
            }
        }
        
        // Fallback to local storage
        return JSON.parse(localStorage.getItem('daveLinksUsers') || '{}');
    }

    async saveUsers(users) {
        // Always save locally
        localStorage.setItem('daveLinksUsers', JSON.stringify(users));
        
        // Try to save to cloud if configured
        if (this.isAuthConfigured) {
            const cloudData = {
                users: users,
                lastUpdated: new Date().toISOString()
            };
            
            return await this.makeCloudRequest(CONFIG.AUTH_BIN_ID, 'PUT', cloudData) !== null;
        }
        
        return false;
    }

    async createUser(username, password) {
        const users = await this.fetchUsers();
        
        if (users[username]) {
            throw new Error('Username already exists');
        }

        const createdAt = new Date().toISOString();
        const userHash = await this.generateUserHash(username, createdAt);
        const hashedPassword = await this.hashPassword(password);

        users[username] = {
            password: hashedPassword,
            userHash: userHash,
            hashVersion: 2, // Mark as new strong hash version
            createdAt: createdAt,
            lastLogin: createdAt
        };

        const cloudSuccess = await this.saveUsers(users);

        return cloudSuccess;
    }

    async authenticateUser(username, password) {
        const users = await this.fetchUsers();
        const user = users[username];
        
        if (!user) return false;
        
        let passwordMatches = false;
        
        // Check if user has new strong hash (version 2) or legacy hash
        if (user.hashVersion === 2) {
            // Use new strong hash method
            const hashedPassword = await this.hashPassword(password);
            passwordMatches = user.password === hashedPassword;
        } else {
            // Use legacy hash method for backward compatibility
            const legacyHash = this.hashPasswordLegacy(password);
            passwordMatches = user.password === legacyHash;
            
            // Upgrade user to new hash system on successful login
            if (passwordMatches) {

                user.password = await this.hashPassword(password);
                user.hashVersion = 2;
                
                // Generate new strong user hash if missing
                if (!user.userHash || user.userHash.length < 16) {
                    user.userHash = await this.generateUserHash(username, user.createdAt || new Date().toISOString());

                }
            }
        }
        
        if (passwordMatches) {
            // Update last login
            user.lastLogin = new Date().toISOString();
            await this.saveUsers(users);
            return true;
        }
        
        return false;
    }

    async checkUserExists(username) {
        const users = await this.fetchUsers();
        return users.hasOwnProperty(username);
    }

    // Session Management
    async getCurrentUserHash() {
        if (!this.currentUser) return null;
        
        const users = await this.fetchUsers();
        const user = users[this.currentUser];
        
        if (!user) {
            this.showStatus(`Debug: User ${this.currentUser} not found in fetchUsers`, 'error');
            return null;
        }
        
        if (!user.userHash) {
            this.showStatus(`Debug: User ${this.currentUser} has no userHash`, 'error');
            return null;
        }
        
        return user.userHash;
    }

    async loginUser(username) {
        this.currentUser = username;
        localStorage.setItem('daveLinksCurrentUser', username);
        

        
        // Update UI
        document.getElementById('authContainer').classList.add('hidden');
        document.getElementById('mainApp').classList.remove('hidden');
        document.getElementById('userGreeting').textContent = `${username}'s List`;
        
        document.getElementById('url').focus();
        
        // Load links from cloud
        await this.loadLinks();
        
        // Show appropriate welcome message based on links count

    }

    logoutUser() {
        this.currentUser = null;
        localStorage.removeItem('daveLinksCurrentUser');
        
        // Update UI
        document.getElementById('authContainer').classList.remove('hidden');
        document.getElementById('mainApp').classList.add('hidden');
        document.getElementById('username').value = '';
        document.getElementById('password').value = '';
        
        this.links = [];
        this.renderLinks();
    }

    async checkExistingSession() {
        const savedUser = localStorage.getItem('daveLinksCurrentUser');
        if (savedUser) {
            // Verify user still exists in AUTH_BIN before logging them in
            const userExists = await this.checkUserExists(savedUser);
            if (userExists) {
                await this.loginUser(savedUser);
            } else {
                // User was deleted from AUTH_BIN, clear local session

                localStorage.removeItem('daveLinksCurrentUser');
                this.showStatus('Session expired. Please login again.', 'error');
            }
        }
    }

    // Links Storage Methods
    getUserStorageKey() {
        return `daveLinks_${this.currentUser}`;
    }

    requireAuth(operation) {
        if (!this.currentUser) {

            return false;
        }
        return true;
    }

    // Local storage methods removed - using cloud-only storage

    async saveLinksToCloud(data) {    
        // Validate prerequisites
        if (!this.currentUser) {
            this.showStatus('Debug: No current user', 'error');
            return false;
        }
        
        if (!CONFIG.BIN_ID || !CONFIG.API_KEY) {
            this.showStatus('Debug: Missing BIN_ID or API_KEY', 'error');
            return false;
        }
        
        // Get user hash for data isolation
        const userHash = await this.getCurrentUserHash();
        if (!userHash) {
            this.showStatus('Debug: Could not get user hash', 'error');
            return false;
        }

        try {
            // Get existing data from cloud (or start with empty object)
            const existingData = await this.makeCloudRequest(CONFIG.BIN_ID) || {};
            
            // Add/update this user's data
            existingData[userHash] = {
                username: this.currentUser,
                links: data,
                lastUpdated: new Date().toISOString()
            };
            
            // Save back to cloud
            const result = await this.makeCloudRequest(CONFIG.BIN_ID, 'PUT', existingData);
            if (result === null) {
                this.showStatus('Debug: makeCloudRequest returned null', 'error');
                return false;
            }
            return true;
            
        } catch (error) {
            this.showStatus(`Debug: Exception - ${error.message}`, 'error');
            return false;
        }
    }

    async loadLinksFromCloud() {
        // Validate prerequisites
        if (!this.currentUser) {
            return [];
        }
        
        if (!CONFIG.BIN_ID || !CONFIG.API_KEY) {
            return [];
        }
        
        const userHash = await this.getCurrentUserHash();
        if (!userHash) {
            return [];
        }

        try {
            const cloudData = await this.makeCloudRequest(CONFIG.BIN_ID);
            if (!cloudData) {
                return [];
            }
            
            const userData = cloudData[userHash];
            if (!userData) {
                return []; // New user, no data yet
            }
            
            // Security check: verify username matches
            if (userData.username !== this.currentUser) {
                return []; // Data integrity violation
            }
            
            return userData.links || [];
            
        } catch (error) {
            return [];
        }
    }

    async saveLinks(data) {
        // Validate user is logged in
        if (!this.currentUser) {
            this.showStatus('❌ Please login to save links', 'error');
            return false;
        }
        
        // Attempt cloud save
        const success = await this.saveLinksToCloud(data);
        
        if (success) {
            this.showStatus('✅ Saved to cloud', 'success');
            return true;
        } else {
            this.showStatus('❌ Failed to save to cloud', 'error');
            return false;
        }
    }

    async loadLinks() {
        if (!this.currentUser) {
            this.links = [];
            this.renderLinks();
            return;
        }
        
        // Load from cloud
        const cloudData = await this.loadLinksFromCloud();
        this.links = cloudData;
        this.renderLinks();
    }

    // UI Methods
    renderLinks() {
        const container = document.getElementById('links');
        
        if (this.links.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📖</div>
                    <div class="empty-title">Your reading list is empty</div>
                    <div class="empty-description">Save your first link to get started</div>
                </div>
            `;
            return;
        }

        container.innerHTML = this.links.map(link => `
            <article class="link-item">
                <div class="link-favicon"></div>
                <div class="link-content">
                    <h3 class="link-title">${this.escapeHtml(link.title)}</h3>
                    <a href="${link.url}" target="_blank" class="link-url">${this.processUrl(link.url).domain}</a>
                    <div class="link-meta">
                        <span class="link-time">${this.timeAgo(link.timestamp)}</span>
                        ${link.category ? `<span class="link-category">${this.escapeHtml(link.category)}</span>` : ''}
                    </div>
                </div>
                <div class="link-actions">
                    <button class="action-btn" onclick="app.copyLink('${this.escapeHtml(link.url)}')" title="Copy link">
                        📋
                    </button>
                    <button class="action-btn delete" onclick="app.deleteLink('${link.id}')" title="Delete">
                        🗑️
                    </button>
                </div>
            </article>
        `).join('');
    }

    async addLink() {
        const urlInput = document.getElementById('url');
        const titleInput = document.getElementById('title');
        const categoryInput = document.getElementById('category');
        const addBtn = document.getElementById('addBtn');
        
        const url = urlInput.value.trim();
        const title = titleInput.value.trim();
        const selectedCategory = categoryInput.value;
        
        if (!url) {
            this.showStatus('Please enter a URL', 'error');
            return;
        }

        const urlInfo = this.processUrl(url);
        if (!urlInfo.isValid) {
            this.showStatus('Please enter a valid URL', 'error');
            return;
        }
        
        // Loading state
        addBtn.classList.add('loading');
        addBtn.disabled = true;
        addBtn.textContent = 'Saving...';
        
        const newLink = {
            id: Date.now().toString(),
            url,
            title: title || urlInfo.title,
            category: selectedCategory || null,
            timestamp: new Date().toISOString()
        };
        
        // Try to save to cloud first
        const tempLinks = [...this.links, newLink];
        const saveSuccess = await this.saveLinks(tempLinks);
        
        if (saveSuccess) {
            // Only update local array if cloud save succeeded
            this.links.unshift(newLink);
            this.renderLinks();
            
            // Clear form
            urlInput.value = '';
            titleInput.value = '';
            categoryInput.value = '';
            urlInput.focus();
        }
        
        // Reset button state
        addBtn.classList.remove('loading');
        addBtn.disabled = false;
        addBtn.textContent = 'Save';
    }

    async deleteLink(id) {
        const linkIndex = this.links.findIndex(link => link.id === id);
        
        if (linkIndex === -1) {
            this.showStatus('Link not found', 'error');
            return;
        }
        
        // Create new array without the deleted link
        const updatedLinks = this.links.filter(link => link.id !== id);
        
        // Try to save to cloud first
        const saveSuccess = await this.saveLinks(updatedLinks);
        
        if (saveSuccess) {
            // Only update local array if cloud save succeeded
            this.links = updatedLinks;
            this.renderLinks();
            this.showStatus('Link removed', 'success');
        }
    }

    async copyLink(url) {
        try {
            await navigator.clipboard.writeText(url);
            this.showStatus('Copied to clipboard', 'success');
        } catch {
            // Fallback for older browsers
            const ta = document.createElement('textarea');
            ta.value = url;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            this.showStatus('Copied to clipboard', 'success');
        }
    }

    toggleAuthMode() {
        this.isLoginMode = !this.isLoginMode;
        const elements = {
            title: document.getElementById('authTitle'),
            subtitle: document.getElementById('authSubtitle'),
            submit: document.getElementById('authSubmit'),
            toggleText: document.getElementById('authToggleText'),
            toggleLink: document.getElementById('authToggleLink')
        };
        
        if (this.isLoginMode) {
            elements.title.textContent = 'Welcome back';
            elements.subtitle.textContent = 'Sign in to your account';
            elements.submit.textContent = 'Sign In';
            elements.toggleText.textContent = "Don't have an account?";
            elements.toggleLink.textContent = 'Sign up';
        } else {
            elements.title.textContent = 'Create account';
            elements.subtitle.textContent = 'Join thousands of users';
            elements.submit.textContent = 'Sign Up';
            elements.toggleText.textContent = 'Already have an account?';
            elements.toggleLink.textContent = 'Sign in';
        }
        
        // Clear form
        document.getElementById('username').value = '';
        document.getElementById('password').value = '';
    }

    // Event Handlers
    setupEventListeners() {
        // Authentication
        document.getElementById('authForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleAuth();
        });

        document.getElementById('authToggleLink').addEventListener('click', () => {
            this.toggleAuthMode();
        });

        document.getElementById('logoutBtn').addEventListener('click', () => {
            this.logoutUser();
            this.showStatus('Logged out', 'success');
        });

        // Links management
        document.getElementById('addLinkForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addLink();
        });

        document.getElementById('url').addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.addLink();
            }
        });
    }

    validateAuthInput(username, password) {
        if (!username || !password) {
            return 'Please fill in all fields';
        }
        if (username.length < 3) {
            return 'Username must be at least 3 characters';
        }
        if (password.length < 6) {
            return 'Password must be at least 6 characters';
        }
        return null;
    }

    async handleAuth() {
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;
        const submitBtn = document.getElementById('authSubmit');
        
        // Validation
        const validationError = this.validateAuthInput(username, password);
        if (validationError) {
            this.showStatus(validationError, 'error');
            return;
        }

        // Loading state
        submitBtn.disabled = true;
        const originalText = submitBtn.textContent;
        submitBtn.textContent = this.isLoginMode ? 'Signing in...' : 'Creating account...';
        
        try {
            if (this.isLoginMode) {
                // Check if user exists
                const userExists = await this.checkUserExists(username);
                
                if (!userExists) {
                    // Auto-redirect to signup

                    this.showStatus('User not found. Redirecting to signup...', 'error');
                    
                    // Auto-switch to signup mode
                    setTimeout(() => {
                        this.isLoginMode = false;
                        this.toggleAuthMode();
                        // Pre-fill username and focus password
                        document.getElementById('username').value = username;
                        document.getElementById('password').value = '';
                        document.getElementById('password').focus();
                        this.showStatus('Please create your account', 'success');
                    }, 1000);
                    return;
                }
                
                // User exists, authenticate
                const isAuthenticated = await this.authenticateUser(username, password);
                
                if (isAuthenticated) {

                    await this.loginUser(username); // This will auto-load links from cloud
                    this.showStatus('Welcome back! Loading your links...', 'success');
                } else {
                    this.showStatus('Invalid password', 'error');
                }
            } else {
                // Signup mode - create new user

                const cloudSuccess = await this.createUser(username, password);
                
                // Auto-redirect to home (new user = empty links)

                await this.loginUser(username); // This will load empty links (new user)
                
                this.showStatus(
                    cloudSuccess ? '✅ Account created! Welcome to your new list.' : '⚠️ Account created locally', 
                    'success'
                );
            }
        } catch (error) {

            this.showStatus(error.message || 'Authentication failed', 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    }
}

// Initialize app
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new LinksApp();
});