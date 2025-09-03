// Links Service - Handles link operations
const jsonbinService = require('./jsonbin');
const authService = require('./auth');
const ValidationUtils = require('../utils/validation');
const UrlUtils = require('../utils/url');

class LinksService {
    constructor() {
        this.categories = [
            'Sports', 'Entertainment', 'Work', 'Business', 
            'Reading', 'Technology', 'Education', 'Other'
        ];
    }

    // Utility methods
    isValidUrl(url) {
        return ValidationUtils.isValidUrl(url);
    }

    extractTitleFromUrl(url) {
        return UrlUtils.extractTitleFromUrl(url);
    }

    getDomainFromUrl(url) {
        return UrlUtils.getDomainFromUrl(url);
    }

    validateCategory(category) {
        return ValidationUtils.isValidCategory(category, this.categories);
    }

    // Links CRUD operations
    async getUserLinks(username) {
        try {
            const userHash = await authService.getUserHash(username);
            const allData = await jsonbinService.getLinks();
            
            const userData = allData[userHash];
            if (!userData || userData.username !== username) {
                return [];
            }

            return userData.links || [];
        } catch (error) {
            console.error('Error fetching user links:', error);
            return [];
        }
    }

    async saveUserLinks(username, links) {
        try {
            const userHash = await authService.getUserHash(username);
            const allData = await jsonbinService.getLinks();

            const updatedData = {
                ...allData,
                [userHash]: {
                    username,
                    links,
                    lastUpdated: new Date().toISOString()
                }
            };

            await jsonbinService.saveLinks(updatedData);
            return true;
        } catch (error) {
            console.error('Error saving user links:', error);
            throw error;
        }
    }

    async addLink(username, linkData) {
        try {
            const { url, title, category } = linkData;

            // Validation
            if (!this.isValidUrl(url)) {
                throw new Error('Invalid URL format');
            }

            if (!this.validateCategory(category)) {
                throw new Error('Invalid category');
            }

            // Get current links
            const currentLinks = await this.getUserLinks(username);

            // Check for duplicates
            const existingLink = currentLinks.find(link => link.url === url);
            if (existingLink) {
                throw new Error('Link already exists');
            }

            // Create new link
            const newLink = {
                id: Date.now().toString(),
                url,
                title: title || this.extractTitleFromUrl(url),
                category: category || 'Other',
                domain: this.getDomainFromUrl(url),
                timestamp: new Date().toISOString()
            };

            // Add to links array
            const updatedLinks = [newLink, ...currentLinks];

            // Save to cloud
            await this.saveUserLinks(username, updatedLinks);

            return newLink;
        } catch (error) {
            throw error;
        }
    }

    async deleteLink(username, linkId) {
        try {
            const currentLinks = await this.getUserLinks(username);
            const linkIndex = currentLinks.findIndex(link => link.id === linkId);

            if (linkIndex === -1) {
                throw new Error('Link not found');
            }

            const updatedLinks = currentLinks.filter(link => link.id !== linkId);
            await this.saveUserLinks(username, updatedLinks);

            return true;
        } catch (error) {
            throw error;
        }
    }

    async updateLink(username, linkId, updateData) {
        try {
            const currentLinks = await this.getUserLinks(username);
            const linkIndex = currentLinks.findIndex(link => link.id === linkId);

            if (linkIndex === -1) {
                throw new Error('Link not found');
            }

            // Validate updates
            if (updateData.url && !this.isValidUrl(updateData.url)) {
                throw new Error('Invalid URL format');
            }

            if (updateData.category && !this.validateCategory(updateData.category)) {
                throw new Error('Invalid category');
            }

            // Update link
            const updatedLink = {
                ...currentLinks[linkIndex],
                ...updateData,
                updatedAt: new Date().toISOString()
            };

            const updatedLinks = [...currentLinks];
            updatedLinks[linkIndex] = updatedLink;

            await this.saveUserLinks(username, updatedLinks);

            return updatedLink;
        } catch (error) {
            throw error;
        }
    }
}

module.exports = new LinksService();
