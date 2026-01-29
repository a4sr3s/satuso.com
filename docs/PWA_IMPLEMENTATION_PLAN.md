# PWA Implementation Plan for Satuso CRM

## Overview

Transform the existing Satuso web app into a Progressive Web App (PWA), enabling mobile users to install it on their home screen with offline support—using the same codebase.

**Timeline:** 2-3 days
**Effort:** Low
**Risk:** Low (no changes to existing functionality)

---

## Current State

| Asset | Status |
|-------|--------|
| Web App Manifest | Missing |
| Service Worker | Missing |
| PWA Meta Tags | Missing |
| App Icons (PNG) | Missing (only SVG) |
| Offline Support | None |
| Install Prompt | None |

---

## Implementation Tasks

### Phase 1: Core PWA Setup (Day 1)

#### 1.1 Install Vite PWA Plugin

The `vite-plugin-pwa` handles manifest generation and service worker automatically.

```bash
cd apps/web
npm install vite-plugin-pwa -D
```

#### 1.2 Update Vite Config

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icon.svg', 'logo.svg'],
      manifest: {
        name: 'Satuso CRM',
        short_name: 'Satuso',
        description: 'Never lose a deal again. AI-powered CRM for sales teams.',
        theme_color: '#171717',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Cache strategies
        runtimeCaching: [
          {
            // Cache API responses
            urlPattern: /^https:\/\/app\.satuso\.com\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24, // 24 hours
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // Cache Google Fonts
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
            },
          },
          {
            // Cache font files
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
            },
          },
          {
            // Cache images
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'image-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
            },
          },
        ],
        // Don't cache these
        navigateFallbackDenylist: [/^\/api/],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // ... rest of existing config
});
```

#### 1.3 Generate App Icons

Create PNG icons from the existing SVG. Create directory `apps/web/public/icons/`:

| File | Size | Purpose |
|------|------|---------|
| `icon-192.png` | 192x192 | Standard PWA icon |
| `icon-512.png` | 512x512 | Large/splash icon |
| `apple-touch-icon.png` | 180x180 | iOS home screen |

**Generate using ImageMagick or online tool:**
```bash
# If ImageMagick is installed
convert -background none -resize 192x192 public/icon.svg public/icons/icon-192.png
convert -background none -resize 512x512 public/icon.svg public/icons/icon-512.png
convert -background none -resize 180x180 public/icon.svg public/icons/apple-touch-icon.png
```

Or use: https://realfavicongenerator.net/

#### 1.4 Update index.html

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/x-icon" href="/favicon.ico" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="description" content="Track leads, automate follow-ups, and close more sales — all in one place." />

    <!-- PWA Meta Tags -->
    <meta name="theme-color" content="#171717" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="Satuso" />

    <!-- iOS Icons -->
    <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />

    <!-- Preconnect -->
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />

    <title>Satuso — Never Lose a Deal Again</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

---

### Phase 2: Install Prompt & Offline UI (Day 2)

#### 2.1 Create Install Prompt Component

```typescript
// src/components/pwa/InstallPrompt.tsx
import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches;

    if (isIOSDevice && !isInStandaloneMode) {
      setIsIOS(true);
      // Show iOS prompt after 30 seconds
      const timer = setTimeout(() => setShowPrompt(true), 30000);
      return () => clearTimeout(timer);
    }

    // Chrome/Android install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    // Don't show again for 7 days
    localStorage.setItem('pwa-prompt-dismissed', Date.now().toString());
  };

  // Check if dismissed recently
  useEffect(() => {
    const dismissed = localStorage.getItem('pwa-prompt-dismissed');
    if (dismissed) {
      const dismissedAt = parseInt(dismissed);
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      if (Date.now() - dismissedAt < sevenDays) {
        setShowPrompt(false);
      }
    }
  }, []);

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 bg-white border border-gray-200 rounded-lg shadow-lg p-4 z-50">
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
      >
        <X className="w-5 h-5" />
      </button>

      <div className="flex items-start gap-3">
        <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
          <Download className="w-6 h-6 text-gray-700" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900">Install Satuso</h3>
          <p className="text-sm text-gray-600 mt-1">
            {isIOS
              ? 'Tap the share button, then "Add to Home Screen"'
              : 'Add to your home screen for quick access'
            }
          </p>
          {!isIOS && (
            <button
              onClick={handleInstall}
              className="mt-3 w-full bg-gray-900 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-gray-800"
            >
              Install App
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

#### 2.2 Create Offline Indicator

```typescript
// src/components/pwa/OfflineIndicator.tsx
import { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';

export function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 bg-amber-500 text-white py-2 px-4 text-center text-sm font-medium z-50 flex items-center justify-center gap-2">
      <WifiOff className="w-4 h-4" />
      You're offline. Some features may be unavailable.
    </div>
  );
}
```

#### 2.3 Create Update Prompt

```typescript
// src/components/pwa/UpdatePrompt.tsx
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw } from 'lucide-react';

export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-gray-900 text-white rounded-lg shadow-lg p-4 z-50 flex items-center gap-3">
      <RefreshCw className="w-5 h-5" />
      <div>
        <p className="font-medium">Update available</p>
        <p className="text-sm text-gray-300">Refresh to get the latest version</p>
      </div>
      <button
        onClick={() => updateServiceWorker(true)}
        className="ml-2 bg-white text-gray-900 py-2 px-4 rounded-md text-sm font-medium hover:bg-gray-100"
      >
        Update
      </button>
      <button
        onClick={() => setNeedRefresh(false)}
        className="text-gray-400 hover:text-white"
      >
        Later
      </button>
    </div>
  );
}
```

#### 2.4 Add PWA Components to App

```typescript
// In src/App.tsx or src/main.tsx
import { InstallPrompt } from '@/components/pwa/InstallPrompt';
import { OfflineIndicator } from '@/components/pwa/OfflineIndicator';
import { UpdatePrompt } from '@/components/pwa/UpdatePrompt';

// Add inside your app layout:
<>
  <OfflineIndicator />
  {/* ... your app content ... */}
  <InstallPrompt />
  <UpdatePrompt />
</>
```

---

### Phase 3: Mobile Optimizations (Day 2-3)

#### 3.1 Add Touch-Friendly Styles

```css
/* In your global CSS */

/* Larger tap targets on mobile */
@media (max-width: 768px) {
  button, a, [role="button"] {
    min-height: 44px;
    min-width: 44px;
  }
}

/* Prevent text selection on interactive elements */
button, [role="button"] {
  -webkit-user-select: none;
  user-select: none;
}

/* Smooth scrolling */
html {
  scroll-behavior: smooth;
}

/* Safe area insets for notched devices */
body {
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
}

/* Prevent overscroll bounce */
html, body {
  overscroll-behavior: none;
}

/* Hide scrollbars on mobile but keep functionality */
@media (max-width: 768px) {
  ::-webkit-scrollbar {
    display: none;
  }
  * {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
}
```

#### 3.2 Add Pull-to-Refresh (Optional)

For a native feel, implement pull-to-refresh on list pages using React Query's refetch:

```typescript
// Already supported via React Query's refetch functionality
// Just add a pull gesture handler if desired
```

---

## File Structure After Implementation

```
apps/web/
├── public/
│   ├── icons/
│   │   ├── icon-192.png        # NEW
│   │   ├── icon-512.png        # NEW
│   │   └── apple-touch-icon.png # NEW
│   ├── favicon.ico
│   ├── favicon.svg
│   └── ...
├── src/
│   ├── components/
│   │   ├── pwa/                 # NEW
│   │   │   ├── InstallPrompt.tsx
│   │   │   ├── OfflineIndicator.tsx
│   │   │   └── UpdatePrompt.tsx
│   │   └── ...
│   └── ...
├── index.html                   # UPDATED
└── vite.config.ts               # UPDATED
```

---

## Testing Checklist

### Desktop (Chrome DevTools)
- [ ] Lighthouse PWA audit passes
- [ ] Manifest loads correctly (Application tab)
- [ ] Service worker registers
- [ ] Offline mode shows cached content
- [ ] Install prompt appears

### iOS (Safari)
- [ ] "Add to Home Screen" works
- [ ] App opens in standalone mode (no browser chrome)
- [ ] Splash screen shows
- [ ] Theme color applies to status bar

### Android (Chrome)
- [ ] Install banner appears
- [ ] App installs to home screen
- [ ] Offline indicator shows when disconnected
- [ ] Update prompt appears on new version

---

## Deployment

```bash
# Build includes PWA assets automatically
cd apps/web && npm run build

# Deploy as usual
npx wrangler pages deploy dist
```

The service worker will be generated at `/sw.js` and the manifest at `/manifest.webmanifest`.

---

## Future: Capacitor for App Store (Week 5+)

When ready for App Store distribution:

```bash
# Install Capacitor
npm install @capacitor/core @capacitor/ios
npx cap init "Satuso" "com.satuso.app" --web-dir dist

# Add iOS platform
npx cap add ios

# Sync web build to native
npm run build && npx cap sync

# Open in Xcode
npx cap open ios
```

Capacitor additions needed:
- Push notification plugin
- Biometric auth plugin
- App icon assets for App Store
- Splash screens for all device sizes

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Lighthouse PWA Score | 100 |
| Install rate | 10% of mobile visitors |
| Offline page loads | Working |
| Load time (cached) | < 1 second |

---

## Summary

| What | Status | Effort |
|------|--------|--------|
| Install vite-plugin-pwa | Todo | 5 min |
| Update vite.config.ts | Todo | 15 min |
| Generate PNG icons | Todo | 10 min |
| Update index.html | Todo | 5 min |
| Create PWA components | Todo | 1 hour |
| Add to App.tsx | Todo | 10 min |
| Mobile CSS tweaks | Todo | 30 min |
| Test on devices | Todo | 1 hour |

**Total: ~4 hours of work**

---

*Document created: January 2026*
*Path to App Store: PWA → Capacitor (add 1-2 weeks when ready)*
