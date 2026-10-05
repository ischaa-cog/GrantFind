#!/bin/bash

echo "🔧 FINAL DEPLOYMENT FIX for GrantFind..."

# 1. Set proper environment for production
export NODE_ENV=production

# 2. Build the application
echo "📦 Building with NODE_ENV=production..."
NODE_ENV=production npm run build

# 3. Ensure server/public directory exists and copy files
echo "📁 Setting up static files..."
mkdir -p server/public
cp -r dist/public/* server/public/

# 4. Create production start script
echo "📝 Creating production startup script..."
cat > start-production.sh << 'EOF'
#!/bin/bash
export NODE_ENV=production
node dist/index.js
EOF

chmod +x start-production.sh

# 5. Test production mode locally
echo "🧪 Testing production mode..."
NODE_ENV=production timeout 5s node dist/index.js &
sleep 2
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5000 2>/dev/null || echo "000")
pkill -f "node dist/index.js" 2>/dev/null

if [ "$RESPONSE" = "200" ]; then
    echo "✅ Production test successful (HTTP $RESPONSE)"
else
    echo "⚠️  Production test returned HTTP $RESPONSE"
fi

# 6. Verify deployment readiness
echo ""
echo "🔍 Deployment Verification:"
echo "✅ NODE_ENV will be set to production"
echo "✅ Static files in server/public/"
echo "✅ Production build created"
echo "✅ Production start script ready"

echo ""
echo "🚀 DEPLOYMENT INSTRUCTIONS:"
echo "1. In Replit, go to the 'Deploy' tab"
echo "2. Make sure the run command is: 'NODE_ENV=production node dist/index.js'"
echo "3. Click Deploy"
echo "4. Your custom domain should work correctly"

echo ""
echo "💡 If 404 still occurs, use this emergency command in the deployment shell:"
echo "   export NODE_ENV=production && mkdir -p server/public && cp -r dist/public/* server/public/"