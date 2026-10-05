#!/bin/bash

echo "🔍 Checking deployment configuration..."

# Check if we're in production mode
echo "NODE_ENV: ${NODE_ENV:-'not set'}"

# Check if dist/index.js exists
if [ -f "dist/index.js" ]; then
    echo "✅ dist/index.js exists"
else
    echo "❌ dist/index.js missing"
fi

# Check if server/public/index.html exists
if [ -f "server/public/index.html" ]; then
    echo "✅ server/public/index.html exists"
else
    echo "❌ server/public/index.html missing"
fi

# Check if server/public/assets exists
if [ -d "server/public/assets" ]; then
    echo "✅ server/public/assets exists"
    echo "Assets count: $(ls server/public/assets | wc -l)"
else
    echo "❌ server/public/assets missing"
fi

# Check the first few lines of index.html to verify build
echo ""
echo "📄 Index.html content (first 10 lines):"
head -10 server/public/index.html

echo ""
echo "🔗 Asset references in index.html:"
grep -E "(src=|href=)" server/public/index.html || echo "No asset references found"

echo ""
echo "📁 Directory structure:"
echo "server/public/:"
ls -la server/public/
echo ""
echo "dist/:"
ls -la dist/ 2>/dev/null || echo "dist/ directory not found"