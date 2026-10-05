#!/bin/bash
# Deployment fix for GrantFind
# This script fixes the 404 error by copying build files to the correct location

echo "Building the application..."
npm run build

echo "Copying build files to expected server location..."
mkdir -p server/public
cp -r dist/public/* server/public/

echo "Build files copied successfully!"
echo "Files available in server/public/:"
ls -la server/public/

echo ""
echo "Deployment fix complete!"
echo "Your app should now work correctly when deployed."