// Authentication Service
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const config = require('../config');
const jsonbinService = require('./jsonbin');

class AuthService {
    constructor() {
        this.saltRounds = 12;
        this.jwtSecret = config.jwt.secret;
        this.jwtExpiresIn = config.jwt.expiresIn;
    }

    // Password hashing
    async hashPassword(password) {
        return await bcrypt.hash(password, this.saltRounds);
    }

    async verifyPassword(password, hashedPassword) {
        return await bcrypt.compare(password, hashedPassword);
    }

    // User hash generation (for data isolation)
    generateUserHash(username, timestamp) {
        const entropy = [
            username,
            timestamp,
            Date.now().toString(),
            Math.random().toString(36),
            crypto.randomBytes(16).toString('hex'),
            'davelinks_user_salt_2024'
        ].join('|');
        
        return crypto.createHash('sha256').update(entropy).digest('hex').substring(0, 16);
    }

    // JWT token management
    generateToken(payload) {
        return jwt.sign(payload, this.jwtSecret, { expiresIn: this.jwtExpiresIn });
    }

    verifyToken(token) {
        try {
            return jwt.verify(token, this.jwtSecret);
        } catch (error) {
            throw new Error('Invalid token');
        }
    }

    // User management
    async createUser(username, password) {
        try {
            const users = await jsonbinService.getUsers();
            
            // Check if user already exists
            if (users.users && users.users[username]) {
                throw new Error('User already exists');
            }

            const timestamp = Date.now();
            const hashedPassword = await this.hashPassword(password);
            const userHash = this.generateUserHash(username, timestamp);

            const newUser = {
                password: hashedPassword,
                userHash,
                createdAt: new Date().toISOString(),
                hashVersion: 3 // bcrypt version
            };

            const updatedUsers = {
                users: {
                    ...(users.users || {}),
                    [username]: newUser
                }
            };

            await jsonbinService.saveUsers(updatedUsers);
            return { username, userHash };
        } catch (error) {
            throw error;
        }
    }

    async authenticateUser(username, password) {
        try {
            const users = await jsonbinService.getUsers();
            const user = users.users?.[username];

            if (!user) {
                throw new Error('User not found');
            }

            const isValidPassword = await this.verifyPassword(password, user.password);
            if (!isValidPassword) {
                throw new Error('Invalid password');
            }

            return {
                username,
                userHash: user.userHash,
                token: this.generateToken({ username, userHash: user.userHash })
            };
        } catch (error) {
            throw error;
        }
    }

    async getUserHash(username) {
        try {
            const users = await jsonbinService.getUsers();
            const user = users.users?.[username];
            
            if (!user) {
                throw new Error('User not found');
            }

            return user.userHash;
        } catch (error) {
            throw error;
        }
    }

    async userExists(username) {
        try {
            const users = await jsonbinService.getUsers();
            return !!(users.users && users.users[username]);
        } catch (error) {
            return false;
        }
    }
}

module.exports = new AuthService();
