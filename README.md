# OptiCode Studio

OptiCode Studio is an all-in-one, privacy-first QR, barcode and optical file-transfer workspace built with React, Vite, TypeScript and Framer Motion.

## What it includes

- QR Code Generator with live preview and PNG / SVG / JPEG export
- Photo → QR encoding with automatic single-QR sizing
- Lossless Multi-QR photo/file framing for larger payloads
- Smart QR + barcode scanner using camera, gallery and drag/drop images
- QR, EAN, UPC, Code 128/39, Data Matrix, PDF417 and other supported scan formats
- Barcode Lab for local UPC/EAN/ISBN normalization and check-digit validation
- Scan Library with search, tags, favorites, backup and restore
- Local Scan Analytics
- OptiTransfer 2.0 with four-lane QR streaming, fountain recovery and SHA-256 verification
- Worker-based QR encoding with a four-group prefetch pipeline and synchronous browser fallback
- Experimental OptiFrame v1 codec: 16-level grayscale optical symbols with finder patterns and CRC integrity checks
- 10-second physical optical benchmark for measured receiver performance
- Browser-side protocol diagnostics and recovery stress tests
- Dark, light and system themes with contrast-aware light-mode styling
- Installable PWA with GitHub Pages deployment

## Stack

- React 18
- Vite
- TypeScript
- Framer Motion
- React Router
- Lucide React
- Sonner
- qrcode
- jsQR
- @zxing/browser

## Privacy model

Camera frames, generated QR payloads and scan history are processed locally by the browser. The app does not require an account or a server-side scan database. External actions such as opening a website, search, email, map or payment URI are controlled by the device/browser after you choose them.

## Development

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
```

The GitHub repository remains `Mahin98250/OR-Generator` so the existing GitHub Pages URL stays stable while the product branding is OptiCode Studio.
