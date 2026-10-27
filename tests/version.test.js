import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('the page shows the same version as package.json', () => {
  const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
  const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  const shown = [...html.matchAll(/v(\d+\.\d+\.\d+)/g)].map(m => m[1]);
  assert.ok(shown.length >= 1, 'no version on the page');
  for (const v of shown) assert.equal(v, version);
});
