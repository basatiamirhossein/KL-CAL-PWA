// Copies the static PWA into dist/ — the folder Capacitor bundles into the Android and iOS apps.
import { cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'dist');
const ENTRIES = [
  'index.html', 'manifest.webmanifest', 'sw.js', 'favicon.png',
  'apple-touch-icon-120.png', 'apple-touch-icon-152.png', 'apple-touch-icon-167.png', 'apple-touch-icon-180.png',
  'css', 'js', 'assets',
];

async function build() {
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  await Promise.all(ENTRIES.map((entry) => cp(path.join(root, entry), path.join(out, entry), { recursive: true })));
  console.log(`Built ${ENTRIES.length} entries into dist/`);
}

build().catch((err) => {
  console.error('Web build failed:', err);
  process.exit(1);
});
