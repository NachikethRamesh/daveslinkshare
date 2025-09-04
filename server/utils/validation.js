// Validation Utilities
class ValidationUtils {
    static isValidUrl(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }

    static isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    static isValidUsername(username) {
        return username && 
               typeof username === 'string' && 
               username.length >= 3 && 
               username.length <= 30 &&
               /^[a-zA-Z0-9_-]+$/.test(username);
    }

    static isValidPassword(password) {
        return password && 
               typeof password === 'string' && 
               password.length >= 6;
    }

    static validateApiKey(apiKey) {
        return apiKey && apiKey.length > 20 && apiKey.startsWith('$2');
    }

    static validateBinId(binId) {
        return binId && binId.length === 24 && /^[a-f0-9]{24}$/.test(binId);
    }

    static sanitizeInput(input) {
        if (typeof input !== 'string') return input;
        return input.trim().replace(/[<>]/g, '');
    }

    static isValidCategory(category, validCategories) {
        return !category || validCategories.includes(category);
    }
}

module.exports = ValidationUtils;
