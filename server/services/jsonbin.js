// JSONBin Service - Handles all external API calls
const axios = require('axios');
const config = require('../config');

class JSONBinService {
    constructor() {
        this.apiKey = config.jsonbin.apiKey;
        this.baseUrl = config.jsonbin.baseUrl;
        this.linksBinId = config.jsonbin.linksBinId;
        this.authBinId = config.jsonbin.authBinId;
    }

    async makeRequest(binId, method = 'GET', data = null) {
        try {
            const options = {
                method,
                url: `${this.baseUrl}/${binId}`,
                headers: {
                    'X-Master-Key': this.apiKey,
                    'Content-Type': 'application/json'
                }
            };

            if (data && method !== 'GET') {
                options.data = data;
            }

            const response = await axios(options);
            return method === 'GET' ? response.data.record : { success: true };
        } catch (error) {
            console.error(`JSONBin API Error (${method} ${binId}):`, {
                status: error.response?.status,
                statusText: error.response?.statusText,
                data: error.response?.data,
                message: error.message
            });
            
            throw new Error(`JSONBin API Error: ${error.response?.status || 'Network Error'}`);
        }
    }

    // User Authentication Methods
    async getUsers() {
        return await this.makeRequest(this.authBinId, 'GET');
    }

    async saveUsers(users) {
        return await this.makeRequest(this.authBinId, 'PUT', users);
    }

    // Links Storage Methods
    async getLinks() {
        return await this.makeRequest(this.linksBinId, 'GET');
    }

    async saveLinks(links) {
        return await this.makeRequest(this.linksBinId, 'PUT', links);
    }
}

module.exports = new JSONBinService();
