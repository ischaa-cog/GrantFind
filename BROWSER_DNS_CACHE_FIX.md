# Browser DNS Cache Issue - Quick Fix

## Problem
Same browser (Chrome), different instances showing different results:
- One instance: grantfind.io works ✅
- Another instance: grantfind.io shows 404 ❌

## Cause
Browser DNS caching - each instance cached DNS at different times during propagation.

## Immediate Solutions

### Method 1: Clear Chrome DNS Cache
1. In the non-working Chrome instance
2. Type: `chrome://net-internals/#dns`
3. Click "Clear host cache"
4. Refresh grantfind.io page

### Method 2: Hard Refresh
1. Go to grantfind.io in non-working instance
2. Press: `Ctrl + Shift + R` (or `Cmd + Shift + R` on Mac)
3. This bypasses cache completely

### Method 3: Incognito Mode
1. Open new Incognito window
2. Visit grantfind.io
3. Should work (no cached DNS)

### Method 4: Restart Browser
1. Close all Chrome instances
2. Reopen Chrome
3. Fresh DNS lookup will occur

## Expected Result
All Chrome instances should work consistently after clearing DNS cache.

## Why This Happens
- Browser 1: Cached DNS when domain was broken
- Browser 2: Cached DNS after relinking worked
- Solution: Clear cache to get fresh DNS lookup