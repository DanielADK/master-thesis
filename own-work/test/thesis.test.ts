// Compiles test/thesis/listing.ts; errors must appear exactly on the lines marked `expect TSxxxx`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const listing = readFileSync(new URL('thesis/listing.ts', import.meta.url), 'utf8');
const thesis = new URL('../../parts/practical.tex', import.meta.url);

test('test/thesis/listing.ts contains the current listings of parts/practical.tex', { skip: !existsSync(thesis) }, () => {
  const tex = readFileSync(thesis, 'utf8');
  const section = tex.slice(tex.indexOf('\\label{sec:model-typescript}'), tex.indexOf('\\label{sec:model-hranice}'));
  const blocks = [...section.matchAll(/\\begin\{minted\}\{typescript\}\n([\s\S]*?)\\end\{minted\}/g)].map(m => m[1] ?? '');
  assert.equal(blocks.length, 2);
  for (const b of blocks) assert.ok(listing.includes(b), b);
});

test('the listings compile, the vulnerable call gives TS2769, each claim fails with its marked code', t => {
  const r = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'test/thesis', '--pretty', 'false'],
    { cwd: root, encoding: 'utf8' });
  const errors = [...r.stdout.matchAll(/^(?:(\S+)\((\d+),\d+\): )?error (TS\d+)/gm)].map(m => `${m[1]}:${m[2]} ${m[3]}`);
  const expected = listing.split('\n').flatMap((l, i) => {
    const m = /\/\/ expect (TS\d+)$/.exec(l);
    return m ? [`test/thesis/listing.ts:${i + 1} ${m[1]}`] : [];
  });
  assert.deepEqual(errors, expected);
  t.diagnostic(errors.join('\n'));
});
