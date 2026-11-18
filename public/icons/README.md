# App icons

`icon.svg` is the source. The PNGs beside it are generated — edit the SVG, then:

```bash
npm run icons
```

| File               | Size    | Purpose                                      |
| ------------------ | ------- | -------------------------------------------- |
| `icon-192.png`     | 192×192 | Android home screen                           |
| `icon-512.png`     | 512×512 | install prompt / splash                       |
| `icon-180.png`     | 180×180 | iOS apple-touch-icon (iOS ignores the manifest for this) |
| `maskable-512.png` | 512×512 | Android adaptive icon — artwork inset into the centre 80% so a circular mask cannot clip it |

Rendering goes through the Chromium that Playwright provides. On a machine
where it is not on the default path, point at it:

```bash
CHROMIUM_PATH=/path/to/chrome npm run icons
```

Keep the artwork legible at 48px, and avoid anything that reads as a medical
device mark — this is a 衛教 tool, not a regulated diagnostic.
