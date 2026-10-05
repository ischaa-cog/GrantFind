#!/bin/bash

# Permanent Deployment Fix for GrantFind
# This script ensures static files are in the correct location for production

echo "🔧 Starting deployment fix..."

# 1. Build the application
echo "📦 Building application..."
npm run build

# 2. Ensure server/public directory exists
echo "📁 Creating server/public directory..."
mkdir -p server/public

# 3. Copy build files to server/public
echo "📋 Copying build files to server/public..."
if [ -d "dist/public" ]; then
    cp -r dist/public/* server/public/
    echo "✅ Files copied successfully"
else
    echo "❌ dist/public directory not found. Build may have failed."
    exit 1
fi

# 4. Verify files are in place
echo "🔍 Verifying deployment files..."
if [ -f "server/public/index.html" ]; then
    echo "✅ index.html found in server/public"
else
    echo "❌ index.html not found in server/public"
    exit 1
fi

if [ -d "server/public/assets" ]; then
    echo "✅ assets directory found in server/public"
else
    echo "❌ assets directory not found in server/public"
    exit 1
fi

echo "🎉 Deployment fix completed successfully!"
echo "📝 Your application is now ready for production deployment."
echo "🌐 Custom domain should work correctly after deployment."