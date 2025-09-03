@echo off
echo Setting Cloudflare environment variables...

wrangler pages secret put JSONBIN_API_KEY --project-name=daves-link-sharing-app
wrangler pages secret put LINKS_BIN_ID --project-name=daves-link-sharing-app  
wrangler pages secret put AUTH_BIN_ID --project-name=daves-link-sharing-app
wrangler pages secret put JWT_SECRET --project-name=daves-link-sharing-app

echo Environment variables set!
echo Note: You'll be prompted to enter each value securely.
pause
