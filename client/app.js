// Dave's Links App - Client-side JavaScript
// SECURITY: This client only stores JWT tokens in localStorage.
// No passwords, hashes, or other sensitive data are ever stored on the client side.
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
        
        // Security: Ensure no sensitive data is stored in localStorage
        this.validateLocalStorage();
        this.init();
    }

    validateLocalStorage() {
        // Optimized: Single pass through localStorage
        const allowedKeys = new Set(['authToken']);
        const sensitivePatterns = ['password', 'hash', 'secret', 'davelinks'];
        
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key) continue;
            
            const isAllowed = allowedKeys.has(key);
            const isSensitive = sensitivePatterns.some(pattern => 
                key.toLowerCase().includes(pattern)
            );
            
            if (!isAllowed && isSensitive) {
                localStorage.removeItem(key);
                continue;
            }
            
            // Check value for sensitive data
            if (!isAllowed) {
                const value = localStorage.getItem(key);
                if (value && sensitivePatterns.some(pattern => value.includes(pattern))) {
                    localStorage.removeItem(key);
                }
            }
        }
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
        // Optimized: Pre-construct headers object
        const headers = {
            'Content-Type': 'application/json',
            ...(this.token && { 'Authorization': `Bearer ${this.token}` }),
            ...(options.headers || {})
        };

        const config = {
            ...options,
            headers
        };

        try {
            const response = await fetch(`${this.apiBase}${endpoint}`, config);
            
            // Optimized: Check content type before parsing
            const contentType = response.headers.get('content-type');
            const isJson = contentType && contentType.includes('application/json');
            
            if (!response.ok) {
                const errorText = isJson ? 
                    (await response.json()).error : 
                    `HTTP ${response.status}: ${response.statusText}`;
                throw new Error(errorText);
            }

            return isJson ? await response.json() : { success: true };
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

        // Clear password field immediately for security
        document.getElementById('password').value = '';

        try {
            if (this.isLoginMode) {
                const result = await this.apiRequest('/auth/login', {
                    method: 'POST',
                    body: JSON.stringify({ username, password })
                });
                
                // Clear sensitive data from memory
                password = null;

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
                
                // Clear sensitive data from memory
                password = null;

                if (result.success) {
                    this.token = result.token;
                    this.currentUser = result.user;
                    localStorage.setItem('authToken', this.token);
                    this.showStatus('Account created successfully!', 'success');
                    this.navigateTo('/home');
                }
            }
        } catch (error) {
            this.showStatus('Authentication failed. Please try again.', 'error');
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
            document.getElementById('userGreeting').textContent = `${this.currentUser.username}'s Links`;
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
            // Clear all sensitive data
            this.token = null;
            this.currentUser = null;
            this.links = [];
            this.linksCache.clear();
            this.pendingSaves.clear();
            this.lastSyncTime = 0;
            
            // Clear localStorage completely for security
            localStorage.clear();
            
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
        document.getElementById('favoritesTab').addEventListener('click', () => this.switchTab('favorites'));
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
        linksContainer.innerHTML = `
            <div class="loading-state">
                <div class="loading-spinner"></div>
                <div class="loading-text">Loading your links...</div>
            </div>
        `;
    }

    renderLinks() {
        const linksContainer = document.getElementById('links');
        
        if (this.links.length === 0) {
            linksContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-title">Your links are empty</div>
                    <div class="empty-description">Save your first link to get started</div>
                </div>
            `;
            return;
        }

        // Optimized: Use single pass filtering and sorting
        const filteredAndSorted = this.links
            .filter(link => {
                switch (this.currentTab) {
                    case 'read': return link.isRead === 1;
                    case 'favorites': return link.isFavorite === 1;
                    default: return !link.isRead || link.isRead === 0;
                }
            })
            .sort((a, b) => {
                const dateA = new Date(a.timestamp || a.dateAdded);
                const dateB = new Date(b.timestamp || b.dateAdded);
                return dateB - dateA;
            });

        // Optimized: Use DocumentFragment for better performance
        const fragment = document.createDocumentFragment();
        
        filteredAndSorted.forEach(link => {
            const linkElement = this.createLinkElement(link);
            fragment.appendChild(linkElement);
        });
        
        linksContainer.innerHTML = '';
        linksContainer.appendChild(fragment);
    }

    createLinkElement(link) {
        const div = document.createElement('div');
        div.className = `link-item ${link.isPending ? 'pending' : ''}`;
        div.setAttribute('data-id', link.id);
        
        const isFavorite = link.isFavorite === 1;
        const isPending = link.isPending;
        const dateStr = new Date(link.dateAdded).toLocaleDateString();
        
        div.innerHTML = `
            <div class="link-content">
                <h3 class="link-title">
                    <button class="star-icon ${isFavorite ? 'favorite' : ''}" 
                            onclick="app.toggleFavorite('${link.id}', ${!isFavorite})" 
                            title="${isFavorite ? 'Remove from favorites' : 'Add to favorites'}">★</button>
                    <a href="${link.url}" target="_blank" rel="noopener noreferrer">${link.title}</a>
                    ${isPending ? '<span class="pending-indicator">Saving...</span>' : ''}
                </h3>
                <div class="link-meta">
                    <span class="link-category">${link.category || 'general'}</span>
                </div>
                <p class="link-date">Added ${dateStr}</p>
            </div>
            <div class="link-actions">
                <button class="action-btn mark-read" onclick="app.markAsRead('${link.id}')" title="Mark as read">Mark as read</button>
                <button class="action-btn copy-btn" onclick="app.copyLink('${link.url}')" title="Copy link" ${isPending ? 'disabled' : ''}>
                    Copy
                </button>
                <button class="action-btn delete-btn" onclick="app.deleteLink('${link.id}')" title="Delete link" ${isPending ? 'disabled' : ''}>
                    Delete
                </button>
            </div>
        `;
        
        return div;
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
        document.getElementById('favoritesTab').classList.toggle('active', tab === 'favorites');
        
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

    async toggleFavorite(linkId, isFavorite) {
        const link = this.links.find(l => l.id === linkId);
        if (!link) return;

        const originalFavoriteStatus = link.isFavorite;
        link.isFavorite = isFavorite ? 1 : 0;
        this.renderLinks();

        try {
            const result = await this.apiRequest('/links/toggle-favorite', {
                method: 'POST',
                body: JSON.stringify({ linkId, isFavorite: isFavorite ? 1 : 0 })
            });

            if (!result.success) {
                link.isFavorite = originalFavoriteStatus;
                this.renderLinks();
                this.showStatus('Failed to update favorite status', 'error');
            }
        } catch (error) {
            link.isFavorite = originalFavoriteStatus;
            this.renderLinks();
            this.showStatus('Failed to update favorite status', 'error');
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new LinksApp();
});
