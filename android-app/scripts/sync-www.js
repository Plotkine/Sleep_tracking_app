#!/usr/bin/env node
// Copie ../frontend vers ./www, d'où Capacitor construit l'application.
//
// Le code source n'est jamais modifié : la seule adaptation est le nom du fichier
// d'entrée. Capacitor exige un `index.html` à la racine du webDir, alors que le
// projet sert `sleep_agenda.html`. On le renomme donc à la copie.
//
// À relancer après chaque modification du frontend : `npm run sync`.

const fs = require('fs');
const path = require('path');

const SRC   = path.resolve(__dirname, '..', '..', 'frontend');
const DEST  = path.resolve(__dirname, '..', 'www');
const ENTRY = 'sleep_agenda.html';

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const item of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, item.name);
    // Le fichier d'entrée devient index.html ; tout le reste garde son nom.
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

// Garde-fou : sans index.html, Capacitor construirait une app blanche.
if (!fs.existsSync(path.join(DEST, 'index.html'))) {
  console.error('✗ index.html absent après la copie.');
  process.exit(1);
}

const count = (function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true })
    .reduce((n, e) => n + (e.isDirectory() ? walk(path.join(dir, e.name)) : 1), 0);
})(DEST);

console.log(`✓ ${count} fichiers copiés vers www/ (${ENTRY} → index.html)`);
