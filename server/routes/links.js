// Links Routes
const express = require('express');
const router = express.Router();
const linksService = require('../services/links');
const { authenticateToken } = require('../middleware/auth');

// Get user's links
router.get('/', authenticateToken, async (req, res) => {
    try {
        const links = await linksService.getUserLinks(req.user.username);
        res.json({ links });
    } catch (error) {
        console.error('Get links error:', error);
        res.status(500).json({ error: 'Failed to fetch links' });
    }
});

// Add new link
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { url, title, category } = req.body;

        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }

        const newLink = await linksService.addLink(req.user.username, {
            url,
            title,
            category
        });

        res.status(201).json({
            message: 'Link added successfully',
            link: newLink
        });
    } catch (error) {
        console.error('Add link error:', error);
        
        if (error.message === 'Invalid URL format') {
            return res.status(400).json({ error: 'Invalid URL format' });
        }
        
        if (error.message === 'Link already exists') {
            return res.status(409).json({ error: 'Link already exists' });
        }
        
        if (error.message === 'Invalid category') {
            return res.status(400).json({ error: 'Invalid category' });
        }
        
        res.status(500).json({ error: 'Failed to add link' });
    }
});

// Update link
router.put('/:linkId', authenticateToken, async (req, res) => {
    try {
        const { linkId } = req.params;
        const updateData = req.body;

        const updatedLink = await linksService.updateLink(
            req.user.username, 
            linkId, 
            updateData
        );

        res.json({
            message: 'Link updated successfully',
            link: updatedLink
        });
    } catch (error) {
        console.error('Update link error:', error);
        
        if (error.message === 'Link not found') {
            return res.status(404).json({ error: 'Link not found' });
        }
        
        if (error.message === 'Invalid URL format' || error.message === 'Invalid category') {
            return res.status(400).json({ error: error.message });
        }
        
        res.status(500).json({ error: 'Failed to update link' });
    }
});

// Delete link
router.delete('/:linkId', authenticateToken, async (req, res) => {
    try {
        const { linkId } = req.params;
        
        await linksService.deleteLink(req.user.username, linkId);
        
        res.json({ message: 'Link deleted successfully' });
    } catch (error) {
        console.error('Delete link error:', error);
        
        if (error.message === 'Link not found') {
            return res.status(404).json({ error: 'Link not found' });
        }
        
        res.status(500).json({ error: 'Failed to delete link' });
    }
});

// Get available categories
router.get('/categories', (req, res) => {
    res.json({ 
        categories: linksService.categories 
    });
});

module.exports = router;
