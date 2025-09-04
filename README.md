# Dave's Link Sharing App

A secure, full-stack link sharing application with user authentication and cloud synchronization.

## 🏗️ Architecture

### Client-Server Split
- **Frontend**: Vanilla JavaScript SPA in `/client`
- **Backend**: Node.js/Express API server in `/server`
- **Database**: JSONBin.io for cloud storage
- **Authentication**: JWT tokens with bcrypt password hashing

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Secure Environment Setup
```bash
# Run the interactive setup script
npm run setup

# This will:
# - Prompt for your JSONBin credentials securely
# - Generate a strong JWT secret automatically
# - Create .env file with secure permissions
# - Validate all inputs
```

### 3. Verify Environment Setup
```bash
# Test that environment variables are loaded correctly
npm run test-env
```

### 4. Run Development Server
```bash
npm run dev
```

Visit `http://localhost:3000` to access the application.

## 📁 Project Structure

```
├── client/                 # Frontend application
│   ├── index.html         # Main HTML file
│   ├── styles.css         # Pocket-inspired styling
│   └── app.js            # Client-side JavaScript
├── server/                # Backend API
│   ├── config.js         # Server configuration
│   ├── server.js         # Main server file
│   ├── middleware/       # Express middleware
│   │   └── auth.js       # Authentication middleware
│   ├── routes/           # API routes
│   │   ├── auth.js       # Authentication endpoints
│   │   └── links.js      # Links CRUD endpoints
│   └── services/         # Business logic
│       ├── auth.js       # Authentication service
│       ├── jsonbin.js    # JSONBin API service
│       └── links.js      # Links management service
├── package.json          # Dependencies and scripts
├── env.template          # Environment variables template
└── README.md            # This file
```

## 🔐 Security Features

- **Password Security**: bcrypt hashing with salt rounds
- **JWT Authentication**: Secure token-based authentication
- **User Isolation**: Each user's data is completely isolated
- **Rate Limiting**: API rate limiting to prevent abuse
- **CORS Protection**: Configurable CORS policies
- **Helmet.js**: Security headers and XSS protection

## 🌐 API Endpoints

### Authentication
- `POST /api/auth/register` - Create new user
- `POST /api/auth/login` - User login
- `GET /api/auth/check/:username` - Check if user exists
- `GET /api/auth/verify` - Verify JWT token
- `POST /api/auth/logout` - User logout

### Links Management
- `GET /api/links` - Get user's links
- `POST /api/links` - Add new link
- `PUT /api/links/:id` - Update link
- `DELETE /api/links/:id` - Delete link
- `GET /api/links/categories` - Get available categories

### System
- `GET /api/health` - Health check

## 🎨 Features

- ✅ **Secure Authentication** - JWT-based with bcrypt
- ✅ **User Isolation** - Complete data separation per user
- ✅ **Link Management** - Add, edit, delete, categorize
- ✅ **Cloud Sync** - JSONBin.io integration
- ✅ **Modern UI** - Pocket-inspired design
- ✅ **Mobile Responsive** - Works on all devices
- ✅ **Real-time Updates** - Immediate UI feedback
- ✅ **Error Handling** - Comprehensive error management
- ✅ **Rate Limiting** - API protection
- ✅ **Security Headers** - Helmet.js protection

## 🔧 Development

### Available Scripts
- `npm start` - Production server
- `npm run dev` - Development with nodemon
- `npm run setup` - Interactive environment setup
- `npm run test-env` - Test environment variables
- `npm run build` - No build needed (static files)
- `npm test` - Run tests (not implemented yet)

### Environment Variables
All configuration is handled through environment variables. See `env.template` for required variables.

## 🚢 Deployment

### Option 1: Cloudflare (Recommended)

#### Setup Cloudflare
```bash
# Install Wrangler CLI
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Deploy the application
npm run deploy
```

#### Environment Variables in Cloudflare
Set these in your Cloudflare dashboard:
- `JSONBIN_API_KEY` - Your JSONBin API key
- `LINKS_BIN_ID` - Links storage bin ID
- `AUTH_BIN_ID` - Authentication bin ID  
- `JWT_SECRET` - Strong JWT secret
- `NODE_ENV` - Set to "production"

#### Deployment Options
```bash
# Deploy everything (recommended)
npm run deploy

# Deploy only static files to Pages
npm run deploy:pages

# Deploy only API to Workers
npm run deploy:worker
```

### Option 2: Traditional Hosting
1. Set up Node.js hosting (Heroku, Railway, DigitalOcean, etc.)
2. Configure environment variables
3. Run `npm start`

### Option 3: Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

## 📝 JSONBin Setup

1. Go to [jsonbin.io](https://jsonbin.io) and create an account
2. Create two bins:
   - **Links Bin**: `{"links":[]}`
   - **Auth Bin**: `{"users":{}}`
3. Get your API key from the dashboard
4. Update `.env` with your credentials

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

---

Built with ❤️ by Dave | Inspired by Pocket's clean design