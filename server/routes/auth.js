// Authentication Routes
const express = require('express');
const router = express.Router();
const authService = require('../services/auth');
const { authenticateToken } = require('../middleware/auth');
const ValidationUtils = require('../utils/validation');

// Register new user
router.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;

        // Validation
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }

        if (!ValidationUtils.isValidUsername(username)) {
            return res.status(400).json({ 
                error: 'Username must be 3-30 characters, alphanumeric, dash, or underscore only' 
            });
        }

        if (!ValidationUtils.isValidPassword(password)) {
            return res.status(400).json({ 
                error: 'Password must be at least 6 characters' 
            });
        }

        // Check if user exists
        const userExists = await authService.userExists(username);
        if (userExists) {
            return res.status(409).json({ error: 'User already exists' });
        }

        // Create user
        const result = await authService.createUser(username, password);
        const token = authService.generateToken({ 
            username: result.username, 
            userHash: result.userHash 
        });

        res.status(201).json({
            message: 'User created successfully',
            user: { username: result.username },
            token
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Login user
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        // Validation
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }

        // Sanitize input
        const sanitizedUsername = ValidationUtils.sanitizeInput(username);

        // Authenticate
        const result = await authService.authenticateUser(username, password);

        res.json({
            message: 'Login successful',
            user: { username: result.username },
            token: result.token
        });
    } catch (error) {
        console.error('Login error:', error);
        
        if (error.message === 'User not found' || error.message === 'Invalid password') {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        res.status(500).json({ error: 'Login failed' });
    }
});

// Check if user exists
router.get('/check/:username', async (req, res) => {
    try {
        const { username } = req.params;
        const exists = await authService.userExists(username);
        
        res.json({ exists });
    } catch (error) {
        console.error('User check error:', error);
        res.status(500).json({ error: 'Failed to check user' });
    }
});

// Verify token (protected route)
router.get('/verify', authenticateToken, (req, res) => {
    res.json({
        message: 'Token valid',
        user: { username: req.user.username }
    });
});

// Logout (client-side token removal, server just confirms)
router.post('/logout', authenticateToken, (req, res) => {
    res.json({ message: 'Logout successful' });
});

module.exports = router;
