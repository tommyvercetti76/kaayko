#!/usr/bin/env node
/**
 * Parses every first-party script under src/js with `node --check`.
 * Node ≥ 22.7 detects ES-module syntax, so page modules and classic scripts
 * both parse without a package.json "type". Vendor bundles are skipped.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..', 'src', 'js');
const files = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { if (entry.name !== 'vendor') walk(full); continue; }
    if (entry.name.endsWith('.js')) files.push(full);
  }
})(root);

let failed = 0;
for (const file of files) {
  const r = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (r.status !== 0) { failed++; console.error(`✗ ${path.relative(process.cwd(), file)}\n${r.stderr.trim()}`); }
}
console.log(`${files.length - failed}/${files.length} scripts parse${failed ? '' : ' — ok'}`);
process.exit(failed ? 1 : 0);
