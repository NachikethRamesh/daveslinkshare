# 🚀 Dave's Links - Deployment Guide

## Automated Deployment with GitHub Actions

This repository includes automated deployment scripts that will:
- ✅ Create Cloudflare D1 database automatically
- ✅ Migrate existing data from JSONBin (if available)
- ✅ Deploy to Cloudflare Workers
- ✅ Verify the deployment

### 📋 Prerequisites

1. **Cloudflare Account** with Workers plan
2. **GitHub Repository** with this code
3. **GitHub Secrets** configured (see below)

### 🔑 Required GitHub Secrets

Go to your GitHub repository → Settings → Secrets and variables → Actions, and add these secrets:

#### **Required for all deployments:**
```
CLOUDFLARE_API_TOKEN
```
- Get from: [Cloudflare Dashboard → My Profile → API Tokens](https://dash.cloudflare.com/profile/api-tokens)
- Permissions needed: `Cloudflare Workers:Edit`, `Zone:Read`, `Account:Read`

#### **Optional for data migration:**
```
JSONBIN_API_KEY
AUTH_BIN_ID  
LINKS_BIN_ID
```
- Only needed if migrating from existing JSONBin setup
- If not provided, deployment will create empty database

### 🚀 Automatic Deployment

Once secrets are configured, deployment happens automatically:

1. **Push to main/master branch** → Triggers deployment
2. **GitHub Actions will:**
   - Check if D1 database exists
   - Create database if needed (runs `scripts/setup-d1.js`)
   - Migrate data from JSONBin if credentials provided (runs `scripts/migrate-from-jsonbin.js`)
   - Build and deploy application
   - Verify deployment health

### 📱 Manual Deployment (Local)

If you prefer manual deployment:

```bash
# 1. Install dependencies
npm install

# 2. Authenticate with Cloudflare
npx wrangler login

# 3. Run complete deployment (includes D1 setup + migration)
npm run deploy:complete

# OR run steps individually:
npm run setup:d1           # Create D1 database
npm run migrate:jsonbin    # Migrate from JSONBin (optional)
npm run verify:migration   # Verify database setup
npm run deploy            # Deploy to Cloudflare
```

### 🔧 Individual Scripts

| Script | Purpose | Usage |
|--------|---------|--------|
| `npm run setup:d1` | Create D1 database and schema | First-time setup |
| `npm run migrate:jsonbin` | Migrate data from JSONBin | Data migration |
| `npm run verify:migration` | Verify database integrity | Post-migration check |
| `npm run deploy:complete` | Complete deployment process | All-in-one deployment |
| `npm run deploy` | Deploy to Cloudflare only | Code updates only |

### 📊 What Gets Migrated

From your existing JSONBin setup:

#### **Users (from AUTH_BIN_ID):**
- ✅ Usernames
- ✅ Password hashes
- ✅ User hashes (for compatibility)
- ✅ Creation timestamps

#### **Links (from LINKS_BIN_ID):**
- ✅ URLs and titles
- ✅ Categories
- ✅ Read/unread status
- ✅ Timestamps
- ✅ Domain extraction

### 🔍 Verification

After deployment, verify everything works:

1. **Health Check:** https://daveslinkshare.workers.dev/api/health
2. **Application:** https://daveslinkshare.workers.dev
3. **Database Status:** Run `npm run verify:migration`

### 🛠️ Troubleshooting

#### **Authentication Issues:**
```bash
npx wrangler login
```

#### **Database Issues:**
```bash
# Check database exists
npx wrangler d1 list

# Check database contents
npx wrangler d1 execute daves-links-db --command="SELECT COUNT(*) FROM users;"
```

#### **Migration Issues:**
- Check JSONBin credentials are correct
- Verify JSONBin data is accessible
- Run migration manually: `npm run migrate:jsonbin`

#### **Deployment Issues:**
- Check Cloudflare API token permissions
- Verify wrangler.toml configuration
- Check GitHub Actions logs

### 📁 File Structure

```
scripts/
├── setup-d1.js           # D1 database creation
├── migrate-from-jsonbin.js # JSONBin data migration
├── verify-migration.js    # Migration verification
└── deploy.js             # Complete deployment process

.github/workflows/
└── deploy.yml            # GitHub Actions workflow

wrangler.toml             # Cloudflare configuration
schema.sql               # Database schema
```

### 🎯 Environment Variables

The scripts automatically handle these environment variables:

| Variable | Source | Purpose |
|----------|--------|---------|
| `CLOUDFLARE_API_TOKEN` | GitHub Secrets | Cloudflare authentication |
| `JSONBIN_API_KEY` | GitHub Secrets | JSONBin data access |
| `AUTH_BIN_ID` | GitHub Secrets | JSONBin users data |
| `LINKS_BIN_ID` | GitHub Secrets | JSONBin links data |

### 🔄 Continuous Deployment

Every push to `main`/`master` triggers:
1. ✅ Database setup (if needed)
2. ✅ Data migration (if credentials available)
3. ✅ Application build
4. ✅ Cloudflare deployment
5. ✅ Health verification

### 🎉 Success!

After successful deployment:
- 🌐 **App URL:** https://daveslinkshare.workers.dev
- 🔍 **Health Check:** https://daveslinkshare.workers.dev/api/health
- 📊 **Database:** Cloudflare D1 with full data
- 🚀 **Performance:** Native D1 queries (faster than JSONBin)
- 💰 **Cost:** FREE tier (100K operations/day)

---

**Need help?** Check the GitHub Actions logs or run `npm run verify:migration` for detailed diagnostics.
