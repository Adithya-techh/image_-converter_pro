# Image Converter Pro 🖼️✨

> **Interactive 3D Three.js Image Converter** — 100% Browser-based, Zero Server, Zero Dependencies to install.  
> Convert Apple HEIC, JPG, PNG, WebP, AVIF, GIF, and BMP directly on your device with complete privacy.

---

## 🚀 Live Demo / Web Browser Access

You can host this project on **GitHub Pages** for free in seconds:

1. Push this repository to GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial commit - Image Converter Pro"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-repo-name>.git
   git push -u origin main
   ```
2. On GitHub, go to **Settings** > **Pages**.
3. Under **Branch**, select `main` and root `/`, then click **Save**.
4. Your website will be live at:
   `https://<your-username>.github.io/<your-repo-name>/`

---

## 💻 Offline & Local Usage

No server or npm is required:
- Simply double-click **`index.html`** to open it in Chrome, Edge, Brave, or Firefox.

---

## ✨ Features

- 🌐 **Interactive 3D Three.js Background** — Real-time particle neural-network with mouse parallax effects.
- 🍎 **Apple HEIC/HEIF Conversion** — Convert iPhone HEIC/HEIF photos right in the browser.
- ⚡ **Batch Processing** — Convert multiple images simultaneously.
- 📦 **One-Click ZIP Export** — Download all converted files together as a single ZIP archive.
- 📐 **Smart Resizing** — Choose between `Contain`, `Cover` (center crop), and `Fill`.
- 🔄 **Transformations** — Rotate 90°, 180°, 270°, or flip horizontally and vertically.
- 🎨 **Visual Filters** — Apply grayscale or 3×3 unsharp-mask sharpen.
- 🔒 **100% Private & Secure** — No files are uploaded to any server. All processing runs locally via the HTML5 Canvas API and JavaScript.

---

## 📊 Supported Formats

| Input Formats | Output Formats |
|---|---|
| **HEIC / HEIF** (Apple iOS) | **JPG / JPEG** |
| **JPG / JPEG** | **PNG** (Lossless + Transparency) |
| **PNG** | **WebP** (Modern Web) |
| **WebP** | **AVIF** (Next-Gen High Compression) |
| **AVIF** | **GIF** (Single Frame) |
| **GIF** | **BMP** (24-bit Uncompressed) |
| **BMP** | |

---

## 🛠️ Built With

- [Three.js](https://threejs.org/) — 3D interactive graphics
- [heic2any](https://github.com/alexcorvi/heic2any) — Client-side HEIC decoding
- [JSZip](https://stuk.github.io/jszip/) — Client-side ZIP generation
- HTML5 Canvas 2D API & Vanilla JavaScript
