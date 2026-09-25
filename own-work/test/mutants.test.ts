// Every mutant of scripts/mutants.ts matches the realization at exactly one place.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MUTANTS } from '../scripts/mutants.ts';

test('every mutant matches exactly one place of its file and changes it', () => {
  assert.ok(MUTANTS.length >= 8);
  for (const m of MUTANTS) {
    for (const e of m.edits) {
      const src = readFileSync(new URL(`../${e.file}`, import.meta.url), 'utf8');
      assert.equal(src.split(e.find).length - 1, 1, `${m.name}: ${e.file} must contain the text once`);
      assert.notEqual(e.find, e.replace, m.name);
    }
  }
});
