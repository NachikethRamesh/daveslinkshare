// URL Utilities
class UrlUtils {
    static extractTitleFromUrl(url) {
        try {
            const urlObj = new URL(url);
            const domain = urlObj.hostname.replace('www.', '');
            return domain.charAt(0).toUpperCase() + domain.slice(1);
        } catch {
            return 'Untitled Link';
        }
    }

    static getDomainFromUrl(url) {
        try {
            return new URL(url).hostname.replace('www.', '');
        } catch {
            return 'unknown';
        }
    }

    static normalizeUrl(url) {
        try {
            const urlObj = new URL(url);
            // Remove trailing slash and normalize
            return urlObj.href.replace(/\/$/, '');
        } catch {
            return url;
        }
    }

    static isHttpsUrl(url) {
        try {
            return new URL(url).protocol === 'https:';
        } catch {
            return false;
        }
    }
}

module.exports = UrlUtils;
