# Cloudflare Pages Setup Instructions

## 🚀 Deploy to Cloudflare Pages

### Step 1: Configure Build Settings in Cloudflare Dashboard

1. **Go to Cloudflare Dashboard**
   - Visit [dash.cloudflare.com](https://dash.cloudflare.com)
   - Click **"Pages"** in the sidebar
   - Find your project **"daves-link-sharing-app"**

2. **Update Build Settings**
   - Go to **Settings** tab
   - Scroll to **"Build settings"**
   - Set the following:

   ```
   Build command: npm run build
   Build output directory: dist
   Root directory: /
   ```

### Step 2: Set Environment Variables

In the **Environment variables** section, add these:

#### Production Environment Variables:
```
NODE_ENV = production
CLIENT_URL = https://daveslinkshare.app
JSONBIN_API_KEY = $2a$10$ny3GTPiENLtRJQfE9RmHb.DjGt06dQlR9QoyPShSzzXjSMWpL15f.
LINKS_BIN_ID = 68b7de25ae596e708fe0ea04
AUTH_BIN_ID = 68b7c443ae596e708fe0d657
JWT_SECRET = 5b452b847b8dd1d2b68af11b176dba87aef2753d59118b30dcab0a4853e48979b2590bfebce52071807ba666d303acb86b17ee0e9256e35082289cf0e420545a
```

**Important:** Set **Environment** to **"Production"** for each variable.

### Step 3: Trigger Deployment

1. **Go to Deployments tab**
2. **Click "Retry deployment"** on the latest deployment
3. **Or push new changes** to trigger auto-deployment

### Step 4: Verify Deployment

Your site should now be accessible at:
- **Primary:** https://daveslinkshare.app
- **Preview:** https://daves-link-sharing-app.pages.dev

## ✅ Expected Result

The site will show a professional setup page explaining:
- This is a full-stack application
- How to deploy the backend API
- Local development instructions

## 🔧 Troubleshooting

If you still see errors:

1. **Check Build Logs** in Cloudflare dashboard
2. **Verify Environment Variables** are set correctly
3. **Ensure Build Command** is `npm run build`
4. **Check Build Output Directory** is `dist`

## 📝 Notes

- No `wrangler.jsonc` file needed for Pages deployment
- Environment variables are managed through Cloudflare dashboard
- Build process creates static files in `dist/` directory
- Pages deployment handles routing automatically via `_redirects` file
