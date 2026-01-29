# Mobile Implementation: Backup & Rollback Plan

## Pre-Implementation Backup

### Git Backup Branch Created
```
Branch: backup/pre-pwa-20260129
Commit: 70081c0d85bbdcd61c4e23d3d1555e51e1974d63
Message: "Apply proper UX widths to Settings form fields"
```

### File Checksums (Before Changes)

Use these to verify files are restored correctly:

```
# Key files - SHA256 checksums
4be575c21eca30720a7e6b9ce29012c06e2dd5448d0d0c7caa12a93b1cba3a60  vite.config.ts
b07cbb5ca0af78d0c4afea9fca9323cd8a3bf08cb53e9ca26916df61d8ba45ed  index.html
f330801ceb1534a8dbc89c0b153c6490fe28e07b4f6eb6f9c43bcae8885996a4  src/main.tsx
c4474dec3a53043a9ede61675e8d82af779445f61ac086d25ac33f81bf2504f1  src/App.tsx
```

### Uncommitted Changes (Not in backup branch)
```
apps/web/functions/api/[[path]].ts              |  2 +
apps/web/functions/api/_routes/ai.ts            | 29 +
apps/web/functions/api/_routes/organizations.ts | 64 +
apps/web/functions/api/_routes/workboards.ts    | 34 +
package.json                                    |  6 -
```

**Action needed:** Commit or stash these before starting mobile work.

---

## Current Mobile Issues (Root Cause Analysis)

### The Problem Is NOT Just PWA

The current app has **zero mobile responsiveness**. Issues found:

| Component | Issue |
|-----------|-------|
| `Layout.tsx` | Fixed `pl-sidebar` (240px) padding, no mobile breakpoint |
| `Sidebar.tsx` | No responsive classes, no mobile menu/hamburger |
| `tailwind.config.js` | `sidebar: '240px'` hardcoded, no responsive variant |
| General | Only 53 responsive breakpoints in entire app |

### What This Means

On mobile, the sidebar takes 240px of a ~375px screen (64%), leaving only ~135px for content. The app is essentially **unusable on mobile**.

**PWA alone will NOT fix this.** We need:
1. **Responsive layout** - Hide sidebar on mobile, show hamburger menu
2. **Mobile navigation** - Bottom tabs or slide-out drawer
3. **Touch-friendly UI** - Larger tap targets, swipe gestures
4. **Then PWA** - Install prompt, offline support

---

## Rollback Procedures

### Level 1: Undo Uncommitted Changes (Instant)

If something breaks during development:

```bash
# Discard all uncommitted changes
git checkout -- .

# Or restore specific file
git checkout -- apps/web/src/components/Layout.tsx
```

### Level 2: Return to Backup Branch (Full Reset)

If deployed changes cause production issues:

```bash
# Switch to backup branch
git checkout backup/pre-pwa-20260129

# Force deploy the old version
cd apps/web && npm run build && npx wrangler pages deploy dist

# Then investigate on main branch
git checkout main
```

### Level 3: Cloudflare Pages Rollback (No Git Needed)

If you can't access git or need immediate rollback:

1. Go to https://dash.cloudflare.com
2. Navigate to Pages → satuso-web
3. Click "Deployments"
4. Find the last working deployment
5. Click "..." → "Rollback to this deployment"

### Level 4: Service Worker Emergency Kill

If PWA service worker causes issues (caching bugs, etc.):

**Option A: Clear via Browser DevTools**
1. Open Chrome DevTools → Application
2. Click "Service Workers"
3. Click "Unregister"
4. Clear Storage → "Clear site data"

**Option B: Deploy Service Worker Kill Switch**

Create and deploy this file:

```javascript
// apps/web/public/sw-kill.js
// Unregisters all service workers
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', () => {
  self.registration.unregister();
  caches.keys().then(keys => {
    keys.forEach(key => caches.delete(key));
  });
});
```

Then temporarily change `vite.config.ts` to serve this as the service worker.

**Option C: Add Clear Cache URL**

Add to your app (we'll include this):
```
https://app.satuso.com/settings?clear-cache=true
```

---

## Implementation Order (Safe Approach)

### Phase 1: Responsive Layout (No PWA Yet)
1. Add mobile sidebar (hamburger + drawer)
2. Make content responsive
3. Test thoroughly on mobile devices
4. **Deploy and verify nothing breaks for desktop**

### Phase 2: PWA (Static Assets Only)
1. Add manifest + icons
2. Add service worker (fonts/images only, NO API caching)
3. Add install prompt
4. **Deploy and verify nothing breaks**

### Phase 3: PWA Enhancements (Optional)
1. Add offline indicator
2. Add update prompt
3. Consider API caching (carefully)

---

## Testing Checklist

### Before Each Deploy

- [ ] Desktop Chrome works
- [ ] Desktop Firefox works
- [ ] Desktop Safari works
- [ ] Mobile Safari (iOS) works
- [ ] Mobile Chrome (Android) works
- [ ] All main flows work: login, view deals, create contact
- [ ] No console errors

### Post-Deploy Verification

```bash
# Verify deployment
curl -I https://app.satuso.com/

# Check service worker (if deployed)
curl https://app.satuso.com/sw.js

# Check manifest (if deployed)
curl https://app.satuso.com/manifest.webmanifest
```

---

## Emergency Contacts

### Cloudflare Status
- https://www.cloudflarestatus.com/

### Clerk Status
- https://status.clerk.com/

### Quick Commands

```bash
# Check current deployment
npx wrangler pages deployment list --project-name=satuso-web

# View deployment logs
npx wrangler pages deployment tail --project-name=satuso-web

# Database backup before any risky changes
npm run db:backup
```

---

## Summary

| Risk | Mitigation |
|------|------------|
| CSS breaks desktop | Test before deploy, git rollback |
| PWA caches stale data | Start with static assets only |
| Service worker bug | Kill switch + Cloudflare rollback |
| Layout breaks mobile | Incremental changes, test on devices |

**Golden Rule:** Deploy small changes, test after each deployment, keep backup branch untouched until mobile launch is complete.

---

*Document created: January 29, 2026*
*Backup branch: backup/pre-pwa-20260129*
*Last verified commit: 70081c0*
