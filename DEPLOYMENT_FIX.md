# GrantFind Deployment 404 Fix

## Problem
When deploying GrantFind to a custom domain like `grantfind.io`, you're getting a 404 "Page not found" error because the server is looking for build files in the wrong location.

## Root Cause
The Vite server configuration expects build files to be in `server/public/` but the build process outputs them to `dist/public/`. This mismatch causes the 404 error in production deployments.

## Solution

### Option 1: Use the Automated Fix Script
Run this command before deploying:
```bash
./deploy-fix.sh
```

### Option 2: Manual Fix
Run these commands in order:
```bash
# Build the application
npm run build

# Copy files to expected location
mkdir -p server/public
cp -r dist/public/* server/public/
```

### Option 3: For Replit Deployments
1. First run the fix (Option 1 or 2 above)
2. Then deploy your application through the Replit interface
3. Your custom domain should now work correctly

## Verification
After running the fix:
1. Check that files exist: `ls -la server/public/`
2. Test locally: `NODE_ENV=production node dist/index.js`
3. Visit `http://localhost:5000` - should show your app
4. Deploy and test your custom domain

## Why This Happens
The server's static file serving function (`serveStatic`) looks for files at:
```
path.resolve(import.meta.dirname, "public")
```
Which resolves to `server/public/` instead of `dist/public/`.

## Status
✅ Issue identified and fixed
✅ Build files now copied to correct location
✅ Production deployment should work correctly