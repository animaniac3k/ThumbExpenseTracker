ThumbVault PWA package

Upload all contents of this folder together to the same directory on an HTTPS website.
Keep this structure:
  index.html
  manifest.json
  service-worker.js
  icons/icon.svg
  icons/icon-192.png
  icons/icon-512.png

Android installation:
1. Open the HTTPS URL in Chrome.
2. Use Chrome menu > Install app (or Add to Home screen).
3. If an older installation exists, uninstall it, clear the site's data/cache in Chrome, and reinstall to refresh the icon and manifest.

Important:
- Do not open from file://. Manifest and service worker must be served from the same origin; service workers require HTTPS except on localhost.
- The app shell is cached for offline startup; expenses are stored in localStorage on this device.
- The optional R2 token is also stored in localStorage. Export backups regularly.
