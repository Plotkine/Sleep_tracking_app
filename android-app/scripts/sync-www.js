#!/usr/bin/env node
// Copies ../frontend into ./www, from which Capacitor builds the app.
//
// Source is never modified: the only adaptation is the entry file name. Capacitor
// requires an `index.html` at the root of webDir, while the project serves
// `sleep_agenda.html`, so it is renamed as it is copied.
//
// Re-run after every frontend change: `npm run sync`.

const fs = require('fs');
const path = require('path');

const SRC   = path.resolve(__dirname, '..', '..', 'frontend');
const DEST  = path.resolve(__dirname, '..', 'www');
const ENTRY = 'sleep_agenda.html';

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const item of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, item.name);
    // The entry file becomes index.html; everything else keeps its name.
    const to = path.join(dest, item.name === ENTRY ? 'index.html' : item.name);
    if (item.isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

if (!fs.existsSync(path.join(SRC, ENTRY))) {
  console.error(`✗ Introuvable : ${path.join(SRC, ENTRY)}`);
  process.exit(1);
}

fs.rmSync(DEST, { recursive: true, force: true });   // repartir propre : pas de fichier orphelin
copyDir(SRC, DEST);

// Guard rail: without index.html, Capacitor would build a blank app.
if (!fs.existsSync(path.join(DEST, 'index.html'))) {
  console.error('✗ index.html absent après la copie.');
  process.exit(1);
}

const count = (function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true })
    .reduce((n, e) => n + (e.isDirectory() ? walk(path.join(dir, e.name)) : 1), 0);
})(DEST);

console.log(`✓ ${count} fichiers copiés vers www/ (${ENTRY} → index.html)`);
