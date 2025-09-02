// Dave's Link Sharing App Configuration
// Replace these with your actual JSONBin credentials

const CONFIG = {
    // Get these from https://jsonbin.io
    // 1. Create account and new bin with: {"links":[]}  
    // 2. Copy bin ID from URL after /b/
    // 3. Get API key from API Keys tab
    
    BIN_ID: '68b66dc6d0ea881f406eefe6',           // e.g., '507f1f77bcf86cd799439011'
    API_KEY: '$2a$10$ny3GTPiENLtRJQfE9RmHb.DjGt06dQlR9QoyPShSzzXjSMWpL15f.',         // e.g., '$2a$10$abc123...'
    
    // Fallback to local storage if cloud fails
    USE_LOCAL_FALLBACK: true
};

// Instructions:
// 1. Go to https://jsonbin.io and create free account
// 2. Create new bin with content: {"links":[]}
// 3. Replace YOUR_BIN_ID_HERE with your actual bin ID
// 4. Replace YOUR_API_KEY_HERE with your actual API key
// 5. Deploy to GitHub Pages
