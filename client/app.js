// Dave's Links - Client-Side Application
class LinksApp {
    constructor() {
        this.links = [];
        this.currentUser = null;
        this.token = localStorage.getItem('authToken');
        this.isLoginMode = true;
        this.apiBase = '/api';
        this.currentTab = 'unread'; // Default to 'To be read' tab
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkAuthStatus();
    }

    // API Methods
    async apiRequest(endpoint, options = {}) {
        // Use standard API paths for Cloudflare Functions
        const url = `${this.apiBase}${endpoint}`;
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                ...(this.token && { 'Authorization': `Bearer ${this.token}` })
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
            
            // Check if response is JSON
            const contentType = response.headers.get('content-type');
            let data;
            
            if (contentType && contentType.includes('application/json')) {
                data = await response.json();
            } else {
                // If not JSON, get text response
                const text = await response.text();
                
                // Create a generic error response
                data = {
                    error: response.ok ? 'Invalid response format' : `HTTP ${response.status}: ${response.statusText}`,
                    details: text.substring(0, 200)
                };
            }

            if (!response.ok) {
                throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`);
            }

            return data;
        } catch (error) {
            // Handle network errors or JSON parsing errors
            if (error.name === 'SyntaxError' && error.message.includes('JSON')) {
                throw new Error('Server returned invalid response format');
            }
            throw error;
        }
    }

    // Authentication Methods
    async checkAuthStatus() {
        if (!this.token) {
            this.showAuthContainer();
            return;
        }

        try {
            const result = await this.apiRequest('/auth/verify');
            this.currentUser = result.user.username;
            this.showMainApp();
            await this.loadLinks();
        } catch (error) {
            // Token invalid, clear it
            localStorage.removeItem('authToken');
            this.token = null;
            this.showAuthContainer();
        }
    }

    async handleAuth(event) {
        event.preventDefault();
        
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;

        if (!this.validateAuthInput(username, password)) return;

        try {
            this.showStatus('Processing...', 'info');

            if (this.isLoginMode) {
                // Try login first
                try {
                    const result = await this.apiRequest('/auth/login', {
                        method: 'POST',
                        body: JSON.stringify({ username, password })
                    });

                    this.handleAuthSuccess(result);
                } catch (error) {
                    if (error.message === 'Invalid credentials') {
                        // Check if user exists
                        const checkResult = await this.apiRequest(`/auth/check/${username}`);
                        
                        if (!checkResult.exists) {
                            // User doesn't exist, switch to signup
                            this.switchToSignup(username);
                            this.showStatus('User not found. Please sign up.', 'info');
                        } else {
                            this.showStatus('Invalid password', 'error');
                        }
                    } else {
                        throw error;
                    }
                }
            } else {
                // Register new user
                const result = await this.apiRequest('/auth/register', {
                    method: 'POST',
                    body: JSON.stringify({ username, password })
                });

                this.handleAuthSuccess(result);
                this.showStatus('Account created successfully!', 'success');
            }
        } catch (error) {
            this.showStatus(error.message, 'error');
        }
    }

    handleAuthSuccess(result) {
        this.token = result.token;
        this.currentUser = result.user.username;
        localStorage.setItem('authToken', this.token);
        
        document.getElementById('userGreeting').textContent = `${this.currentUser}'s List`;
        this.showMainApp();
        this.loadLinks();
    }

    switchToSignup(username = '') {
        this.isLoginMode = false;
        document.getElementById('authTitle').textContent = 'Create Account';
        document.getElementById('authSubtitle').textContent = 'Sign up for a new account';
        document.getElementById('authSubmit').textContent = 'Sign Up';
        document.getElementById('authToggleText').textContent = 'Already have an account?';
        document.getElementById('authToggleLink').textContent = 'Sign in';
        
        if (username) {
            document.getElementById('username').value = username;
            document.getElementById('password').focus();
        }
    }

    switchToLogin() {
        this.isLoginMode = true;
        document.getElementById('authTitle').textContent = 'Welcome back';
        document.getElementById('authSubtitle').textContent = 'Sign in to your account';
        document.getElementById('authSubmit').textContent = 'Sign In';
        document.getElementById('authToggleText').textContent = "Don't have an account?";
        document.getElementById('authToggleLink').textContent = 'Sign up';
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

    // Links Methods
    async loadLinks() {
        try {
            const result = await this.apiRequest('/links');
            this.links = result.links || [];
            this.renderLinks();
        } catch (error) {
            this.showStatus('Failed to load links', 'error');
            this.links = [];
            this.renderLinks();
        }
    }

    async addLink(event) {
        event.preventDefault();
        
        const url = document.getElementById('url').value.trim();
        const title = document.getElementById('title').value.trim();
        const category = document.getElementById('category').value;

        if (!url) {
            this.showStatus('URL is required', 'error');
            return;
        }

        try {
            this.showStatus('Saving link...', 'info');
            
            const result = await this.apiRequest('/links', {
                method: 'POST',
                body: JSON.stringify({ url, title, category })
            });

            // Add to local array for immediate UI update
            this.links.unshift(result.link);
            this.renderLinks();
            
            // Clear form
            document.getElementById('addLinkForm').reset();
            document.getElementById('url').focus();
            
            this.showStatus('Link saved successfully!', 'success');
        } catch (error) {
            this.showStatus(error.message, 'error');
        }
    }

    async deleteLink(linkId) {
        if (!confirm('Are you sure you want to delete this link?')) {
            return;
        }

        try {
            await this.apiRequest(`/links/${linkId}`, {
                method: 'DELETE'
            });

            // Remove from local array for immediate UI update
            this.links = this.links.filter(link => link.id !== linkId);
            this.renderLinks();
            
            this.showStatus('Link deleted', 'success');
        } catch (error) {
            this.showStatus('Failed to delete link', 'error');
        }
    }

    // UI Methods
    renderLinks() {
        const linksContainer = document.getElementById('links');
        
        if (this.links.length === 0) {
            linksContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📖</div>
                    <div class="empty-title">Your reading list is empty</div>
                    <div class="empty-description">Save your first link to get started</div>
                </div>
            `;
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
        const sortedLinks = filteredLinks.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        const linksHTML = sortedLinks.map(link => `
            <div class="link-item" data-id="${link.id}">
                <div class="link-content">
                    <div class="link-header">
                        <h3 class="link-title">
                            <a href="${link.url}" target="_blank" rel="noopener noreferrer">
                                ${this.escapeHtml(link.title)}
                            </a>
                        </h3>
                        <div class="link-actions">
                            <button class="action-btn mark-read" onclick="app.markAsRead('${link.id}')" title="Mark as read">Mark as read</button>
                            <button class="btn-icon copy-btn" onclick="app.copyToClipboard('${link.url}')" title="Copy URL">
                                📋
                            </button>
                            <button class="btn-icon delete-btn" onclick="app.deleteLink('${link.id}')" title="Delete">
                                🗑️
                            </button>
                        </div>
                    </div>
                    <div class="link-meta">
                        ${link.category ? `<span class="link-category">${link.category}</span>` : ''}
                        <span class="link-date">${this.formatDate(link.timestamp)}</span>
                    </div>
                </div>
            </div>
        `).join('');

        linksContainer.innerHTML = linksHTML;
    }

    showAuthContainer() {
        document.getElementById('authContainer').classList.remove('hidden');
        document.getElementById('mainApp').classList.add('hidden');
        document.getElementById('username').focus();
    }

    showMainApp() {
        document.getElementById('authContainer').classList.add('hidden');
        document.getElementById('mainApp').classList.remove('hidden');
        document.getElementById('url').focus();
    }

    // Utility Methods
    validateAuthInput(username, password) {
        if (!username || !password) {
            this.showStatus('Username and password are required', 'error');
            return false;
        }

        if (username.length < 3) {
            this.showStatus('Username must be at least 3 characters', 'error');
            return false;
        }

        if (password.length < 6) {
            this.showStatus('Password must be at least 6 characters', 'error');
            return false;
        }

        return true;
    }

    copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            this.showStatus('URL copied to clipboard!', 'success');
        }).catch(() => {
            this.showStatus('Failed to copy URL', 'error');
        });
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        
        return date.toLocaleDateString();
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showStatus(message, type = 'info') {
        const statusEl = document.getElementById('status');
        statusEl.textContent = message;
        statusEl.className = `alert alert-${type}`;
        statusEl.style.display = 'block';

        setTimeout(() => {
            statusEl.style.display = 'none';
        }, type === 'error' ? 5000 : 3000);
    }

    // Event Listeners
    setupEventListeners() {
        // Auth form
        document.getElementById('authForm').addEventListener('submit', (e) => this.handleAuth(e));
        
        // Auth toggle
        document.getElementById('authToggleLink').addEventListener('click', (e) => {
            e.preventDefault();
            if (this.isLoginMode) {
                this.switchToSignup();
            } else {
                this.switchToLogin();
            }
        });

        // Add link form
        document.getElementById('addLinkForm').addEventListener('submit', (e) => this.addLink(e));
        
        // Logout button
        document.getElementById('logoutBtn').addEventListener('click', () => this.logout());

        // URL input auto-focus on paste
        document.getElementById('url').addEventListener('paste', () => {
            setTimeout(() => {
                const url = document.getElementById('url').value.trim();
                if (url && !document.getElementById('title').value.trim()) {
                    document.getElementById('title').focus();
                }
            }, 100);
        });

        // Tab switching
        document.getElementById('unreadTab').addEventListener('click', () => this.switchTab('unread'));
        document.getElementById('readTab').addEventListener('click', () => this.switchTab('read'));
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

    // Mark link as read
    async markAsRead(linkId) {
        try {
            const result = await this.apiRequest('/links/mark-read', {
                method: 'POST',
                body: JSON.stringify({ linkId, isRead: 1 })
            });

            if (result.success) {
                // Update local link
                const link = this.links.find(l => l.id === linkId);
                if (link) {
                    link.isRead = 1;
                    this.renderLinks();
                    this.showStatus('Link marked as read', 'success');
                }
            } else {
                this.showStatus('Failed to mark as read', 'error');
            }
        } catch (error) {
            this.showStatus('Failed to mark as read', 'error');
        }
    }

}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new LinksApp();
});
