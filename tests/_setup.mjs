/**
 * Test bootstrap: page modules import each other by site-absolute URL
 * ("/js/kit.js"), which the browser resolves against the origin. Node would
 * read the filesystem root, so this hook maps "/js/…" onto src/js/….
 * Run: node --import ./tests/_setup.mjs --test tests/
 */
import { register } from 'node:module';
register('./_loader.mjs', import.meta.url);
