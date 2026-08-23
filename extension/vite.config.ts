import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import fs from 'fs';

// ─────────────────────────────────────────────────────────────────────────────
// Build mode is controlled by the VITE_BUILD_TARGET env variable:
//   VITE_BUILD_TARGET=pages  → builds popup.html + options.html (ES module output)
//   VITE_BUILD_TARGET=content → builds content.js as a standalone IIFE bundle
//   VITE_BUILD_TARGET=background → builds background.js as a standalone IIFE bundle
// The "build" npm script in package.json runs all three in sequence.
// ─────────────────────────────────────────────────────────────────────────────

const target = process.env.VITE_BUILD_TARGET ?? 'pages';

// Plugin that copies manifest.json + creates icons/ dir after each bundle pass
function copyManifestPlugin() {
  return {
    name: 'copy-manifest-plugin',
    closeBundle() {
      const distDir = resolve(__dirname, 'dist');
      if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });

      const manifestSrc = resolve(__dirname, 'manifest.json');
      if (fs.existsSync(manifestSrc)) {
        fs.copyFileSync(manifestSrc, resolve(distDir, 'manifest.json'));
      }

      const iconsDir = resolve(distDir, 'icons');
      if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true });
    }
  };
}

// ── Build: popup.html + options.html (ES module chunks, safe for HTML pages) ──
function pagesConfig() {
  return defineConfig({
    plugins: [react(), copyManifestPlugin()],
    build: {
      outDir: 'dist',
      emptyOutDir: false,  // Don't wipe content.js written by another pass
      rollupOptions: {
        input: {
          popup: resolve(__dirname, 'popup.html'),
          options: resolve(__dirname, 'options.html'),
        },
        output: {
          entryFileNames: 'assets/[name]-[hash].js',
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash].[ext]',
        }
      }
    }
  });
}

// ── Build: content.js — MUST be a plain IIFE, Chrome rejects ES modules ──────
// Content scripts are injected as classic <script> tags and cannot use
// `import` / `export`. Rollup's `iife` format wraps everything in a
// self-executing function with all dependencies inlined.
function contentConfig() {
  return defineConfig({
    plugins: [react(), copyManifestPlugin()],
    define: {
      // Inline React's development/production flag so the IIFE doesn't try to
      // read process.env at runtime (which doesn't exist in content scripts).
      'process.env.NODE_ENV': JSON.stringify('production'),
    },
    build: {
      outDir: 'dist',
      emptyOutDir: false,
      rollupOptions: {
        input: { content: resolve(__dirname, 'src/content/index.tsx') },
        output: {
          format: 'iife',           // ← Key fix: self-contained, no imports
          entryFileNames: '[name].js',
          inlineDynamicImports: true, // Prevent any dynamic import() calls
        }
      }
    }
  });
}

// ── Build: background.js — service worker supports ES module via manifest ─────
// The manifest declares `"type": "module"` for the background service worker,
// so it CAN use ES module format. We keep it as a separate pass for clarity.
function backgroundConfig() {
  return defineConfig({
    plugins: [copyManifestPlugin()],
    define: {
      'process.env.NODE_ENV': JSON.stringify('production'),
    },
    build: {
      outDir: 'dist',
      emptyOutDir: false,
      rollupOptions: {
        input: { background: resolve(__dirname, 'src/background/index.ts') },
        output: {
          format: 'es',
          entryFileNames: '[name].js',
        }
      }
    }
  });
}

// Export the right config based on the build target
export default target === 'content'
  ? contentConfig()
  : target === 'background'
  ? backgroundConfig()
  : pagesConfig();
