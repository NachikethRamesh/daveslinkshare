# 🚀 Quick Setup Guide

## 1. GitHub Repository Setup

1. **Push this code to GitHub:**
   ```bash
   git add .
   git commit -m "Add D1 migration and deployment scripts"
   git push origin main
   ```

2. **Configure GitHub Secrets:**
   - Go to: Repository → Settings → Secrets and variables → Actions
   - Add these secrets:

### **Required Secret:**
```
CLOUDFLARE_API_TOKEN
```
- Get from: [Cloudflare Dashboard → API Tokens](https://dash.cloudflare.com/profile/api-tokens)
- Click "Create Token" → "Custom token"
- Permissions: `Cloudflare Workers:Edit`, `Account:Read`, `Zone:Read`

### **Optional Secrets (for JSONBin migration):**
```
JSONBIN_API_KEY=$2a$10$ny3GTPiENLtRJQfE9RmHb.DjGt06dQlR9QoyPShSzzXjSMWpL15f.
AUTH_BIN_ID=68b7c443ae596e708fe0d657
LINKS_BIN_ID=68b7de25ae596e708fe0ea04
```

## 2. Automatic Deployment

Once secrets are configured:

1. **Push to main branch** → GitHub Actions automatically:
   - Creates D1 database
   - Migrates JSONBin data (if credentials provided)
   - Deploys to Cloudflare Workers
   - Verifies deployment

2. **Check deployment:**
   - GitHub Actions tab for deployment status
   - App URL: https://daveslinkshare.workers.dev
   - Health check: https://daveslinkshare.workers.dev/api/health

## 3. Manual Setup (Alternative)

If you prefer manual setup:

```bash
# Install dependencies
npm install

# Authenticate with Cloudflare
npx wrangler login

# Complete deployment (creates DB + migrates + deploys)
npm run deploy:complete
```

## 4. Verification

After deployment, verify:

```bash
# Check database
npm run verify:migration

# Test health endpoint
curl https://daveslinkshare.workers.dev/api/health
```

## 🎉 Done!

Your app is now running on Cloudflare with:
- ✅ D1 database (free, fast, secure)
- ✅ Migrated data from JSONBin
- ✅ Automatic deployments
- ✅ Zero downtime updates

**Next push to main branch = automatic deployment! 🚀**
