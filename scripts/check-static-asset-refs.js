#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const srcRoot = path.join(repoRoot, 'src');

const htmlFiles = [];
const failures = [];

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.html')) {
      htmlFiles.push(fullPath);
    }
  }
}

function normalizeAssetRef(ref) {
  if (!ref) return null;
  if (/^(https?:)?\/\//i.test(ref)) return null;
  if (/^(data|mailto|tel):/i.test(ref)) return null;

  const cleaned = ref.split('#')[0].split('?')[0].trim();
  if (!cleaned.startsWith('/')) return null;

  return cleaned;
}

function collectRefs(filePath, html) {
  const refs = [];
  const scriptRegex = /<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
  const linkRegex = /<link\b[^>]*\bhref=["']([^"']+)["'][^>]*>/gi;

  let match;
  while ((match = scriptRegex.exec(html))) {
    refs.push({ kind: 'script', ref: match[1] });
  }

  while ((match = linkRegex.exec(html))) {
    refs.push({ kind: 'link', ref: match[1] });
  }

  for (const item of refs) {
    const normalized = normalizeAssetRef(item.ref);
    if (!normalized) continue;

    const absoluteTarget = path.join(srcRoot, normalized.replace(/^\/+/, ''));
    if (!fs.existsSync(absoluteTarget)) {
      failures.push({
        file: path.relative(repoRoot, filePath),
        kind: item.kind,
        ref: normalized,
      });
    }
  }
}

walk(srcRoot);

for (const filePath of htmlFiles) {
  const html = fs.readFileSync(filePath, 'utf8');
  collectRefs(filePath, html);
}

if (failures.length) {
  console.error('Broken static asset references found:\n');
  for (const failure of failures) {
    console.error(`- ${failure.file}: missing ${failure.kind} target ${failure.ref}`);
  }
  process.exit(1);
}

console.log(`Static asset reference check passed for ${htmlFiles.length} HTML files.`);
