# PWA Icons

Place the following icon files in this directory before building for production:

| File | Size | Purpose |
|------|------|---------|
| `icon-192.png` | 192x192 px | Standard PWA icon (home screen, splash screen) |
| `icon-512.png` | 512x512 px | High-resolution PWA icon (splash screen, app store) |

## Requirements

- Format: PNG with transparency support
- Both icons should use `purpose: "any maskable"` — design the icon with a safe zone
  (roughly the inner 80% of the canvas) so Android's adaptive icon system can crop it safely.
- Brand colors: `#1a1a2e` (dark navy background), accent `#e94560` (red/coral)

## Recommended tools

- [PWA Asset Generator](https://github.com/elegantapp/pwa-asset-generator): auto-generate all sizes from a source SVG
- [Maskable.app](https://maskable.app): preview how your icon looks with adaptive masking

## Temporary placeholder

During development, you can use any 192x192 and 512x512 PNG. The app will still install
as a PWA; the icon will just show a placeholder image on the home screen.
