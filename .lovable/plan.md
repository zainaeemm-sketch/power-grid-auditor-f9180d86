

# PWA: Add to Home Screen Support

## What this does
Adds a web app manifest so users on mobile (iOS/Android) and desktop (Chrome) can tap "Add to Home Screen" and launch GridArena as a standalone app with its own icon — no browser chrome.

## Approach: Manifest-only (no service worker)
Since offline support isn't needed, we skip `vite-plugin-pwa` and service workers entirely. This avoids caching issues in the Lovable preview and keeps things simple.

## Changes

### 1. Create `public/manifest.json`
```json
{
  "name": "GridArena — LLM Agent Research Platform",
  "short_name": "GridArena",
  "description": "Evaluate and audit LLM agents on power-system tasks",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0a0e1a",
  "theme_color": "#10b981",
  "icons": [...]
}
```

### 2. Generate app icons
Create simple SVG-based PNG icons at 192x192 and 512x512 in `public/icons/` using a script. The icon will use the GridArena gradient style (emerald-to-cyan) with "GA" text.

### 3. Update `src/routes/__root.tsx`
Add manifest and theme-color meta links to the `head()` function:
```ts
links: [
  { rel: "stylesheet", href: appCss },
  { rel: "manifest", href: "/manifest.json" },
  { rel: "apple-touch-icon", href: "/icons/icon-192.png" },
],
meta: [
  ...,
  { name: "theme-color", content: "#10b981" },
  { name: "apple-mobile-web-app-capable", content: "yes" },
  { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
]
```

### 4. No service worker
No `vite-plugin-pwa`, no service worker registration. This ensures the Lovable preview stays stable and no caching issues occur.

## How users install it
- **Android (Chrome)**: Menu → "Add to Home Screen" or automatic install prompt
- **iOS (Safari)**: Share → "Add to Home Screen"
- **Desktop (Chrome/Edge)**: Address bar install icon

## Files touched
| File | Change |
|------|--------|
| `public/manifest.json` | New: web app manifest |
| `public/icons/icon-192.png` | New: generated app icon |
| `public/icons/icon-512.png` | New: generated app icon |
| `src/routes/__root.tsx` | Add manifest + apple meta tags |

No database changes. No new dependencies.

