# Security Guidelines

## 🔐 Environment Variables

### Critical Security Rules

1. **NEVER commit `.env` files to version control**
2. **Use the secure setup script**: `npm run setup`
3. **Rotate secrets regularly** in production
4. **Use different secrets** for development/production

### Environment File Locations

```
✅ SECURE:   server/.env.example  (template only)
❌ NEVER:    server/.env          (contains secrets)
❌ NEVER:    .env                 (root level secrets)
```

### File Permissions

The setup script automatically sets secure permissions:
- **Unix/Linux/Mac**: `600` (owner read/write only)
- **Windows**: Relies on NTFS permissions

## 🔑 JWT Secrets

- **Auto-generated**: 64-byte cryptographically secure
- **Unique per environment**: Never reuse between dev/prod
- **Rotation**: Change regularly in production

## 🛡️ JSONBin Security

### API Key Protection
- Store in environment variables only
- Never log or expose in error messages
- Use different bins for different environments

### Data Isolation
- Each user gets a unique hash for data separation
- Passwords are bcrypt hashed with salt
- No plain text storage anywhere

## 🚨 Security Checklist

### Before Deployment
- [ ] Environment variables properly configured
- [ ] JWT secret is strong and unique
- [ ] API keys are not in source code
- [ ] `.env` files are in `.gitignore`
- [ ] HTTPS enabled in production
- [ ] CORS properly configured
- [ ] Rate limiting enabled

### Regular Maintenance
- [ ] Rotate JWT secrets monthly
- [ ] Monitor for failed login attempts
- [ ] Update dependencies regularly
- [ ] Review access logs
- [ ] Backup authentication data

## 🔍 Security Monitoring

### Log What Matters
- Failed authentication attempts
- Unusual API usage patterns
- Rate limit violations
- JWT token validation failures

### Don't Log Secrets
- Never log passwords (even hashed)
- Never log JWT tokens
- Never log API keys
- Never log full request bodies with auth data

## 📞 Reporting Security Issues

If you discover a security vulnerability:

1. **DO NOT** open a public issue
2. Email security concerns privately
3. Include detailed reproduction steps
4. Allow reasonable time for fixes

## 🛠️ Development Security

### Local Development
```bash
# Use the setup script
npm run setup

# Never commit your .env
git status  # Check before commits
```

### Production Deployment
```bash
# Set environment variables via hosting platform
# Never upload .env files to servers
# Use secrets management systems when available
```

## 📚 Security Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Checklist](https://blog.risingstack.com/node-js-security-checklist/)
- [JWT Security Best Practices](https://auth0.com/blog/a-look-at-the-latest-draft-for-jwt-bcp/)
- [bcrypt vs other hashing](https://auth0.com/blog/hashing-in-action-understanding-bcrypt/)

---

**Remember**: Security is not a feature, it's a foundation. 🏗️
