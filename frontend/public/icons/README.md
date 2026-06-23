# PWA Icons

These are the PWA app icons referenced by `manifest.json` and `index.html`.
Full set: `icon-{72,96,128,144,152,180,192,256,384,512}x<same>.png`.

## Requirements

- Format: PNG. The MoverHero mark sits on a **white tile** with a safe zone
  (inner ~80% of the canvas) so Android's adaptive (maskable) cropping is clean.
- `manifest.json` declares 192 + 512 with `purpose: "maskable"` in addition to `any`.
- Brand colors: `#121212` (graphite background), accent `#ff7a18` (Hero Orange).

## Recommended tools

- [PWA Asset Generator](https://github.com/elegantapp/pwa-asset-generator): auto-generate all sizes from a source SVG
- [Maskable.app](https://maskable.app): preview how your icon looks with adaptive masking

## Temporary placeholder

During development, you can use any 192x192 and 512x512 PNG. The app will still install
as a PWA; the icon will just show a placeholder image on the home screen.
