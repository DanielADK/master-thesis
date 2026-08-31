// T-Lit, T-Val, T-San and lem:monoid against def:inertnost in the browser model.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { CTXS, type Ctx } from '../src/label.ts';
import { ctxOf, dOf } from '../src/contexts.ts';
import { HOLE, SAN, type SanCtx } from '../src/index.ts';
import { arbInput, arbLiteral, LITERALS, PAYLOADS, SCHEMAS, type Marked } from './model.ts';
import { endsInHole, P, stringStartOf, suitable } from './oracle.ts';

const mark = (s: string, u: boolean): Marked => ({ s, u: Array<boolean>(s.length).fill(u) });
const SANS: SanCtx[] = ['html', 'script', 'url'];

test('ass:parse: every prefix of P and every sink prefix ends in its data hole, typical traps do not', () => {
  for (const c of CTXS) {
    for (const p of [...P[c], HOLE[c][0]]) assert.ok(endsInHole(p, c, c === 'script' ? stringStartOf(p) : undefined), `${c}: ${p}`);
  }
  for (const p of ['<div title=', '<div title="', '<script>', '<svg>', '<template>', '<!--', '<textarea>', '<a href="x">x<'])
    assert.ok(!endsInHole(p, 'html'), p);
  assert.ok(!endsInHole('<a href="java', 'url'));
  assert.ok(!endsInHole('<script>var x = "a\\', 'script', 17));
});

test('def:prameny: the examples of the thesis hold in the browser model, the realization grants a subset', () => {
  // literal, ctx(s) by the thesis and the oracle, CtxOf of the realization
  const examples: [string, Ctx[], Ctx[]][] = [
    ['Dobrý den', [...CTXS], [...CTXS]],
    ['<h1>', [...CTXS], ['html']],
    ['<div title=', ['script', 'url', 'res'], []],
    ['<script>', ['script', 'url', 'res'], []],
    ['<script>init()</script>', ['html', 'url', 'res'], ['html']],
  ];
  for (const [s, model, realized] of examples) {
    assert.deepEqual(CTXS.filter(c => suitable(mark(s, false), c)), model, s);
    assert.deepEqual(ctxOf(s), realized, s);
  }
  const d = CTXS.filter(c => c !== 'res' && ['asc', 'desc'].every(v => suitable(mark(v, true), c)));
  assert.deepEqual(d, ['html', 'script', 'url']);
  assert.deepEqual(dOf(['asc', 'desc']), d);
});

test('def:prameny: no non-empty string of attacker characters is suitable for res', t => {
  const inputs = [...new Set([...PAYLOADS, ...fc.sample(arbInput, { seed: 15, numRuns: 10_000 })])].filter(x => x !== '');
  for (const x of inputs) assert.ok(!suitable(mark(x, true), 'res'), JSON.stringify(x));
  t.diagnostic(`${inputs.length} non-empty attacker strings, none suitable for res`);
});

test('T-Lit: ctx(s) is sound and conservative', t => {
  const literals = [...new Set([...LITERALS, ...PAYLOADS, ...fc.sample(arbLiteral, { seed: 11, numRuns: 10_000 })])];
  const granted = Object.fromEntries(CTXS.map(c => [c, 0])) as Record<Ctx, number>;
  const missed = Object.fromEntries(CTXS.map(c => [c, 0])) as Record<Ctx, number>;
  for (const s of literals) {
    const k = ctxOf(s);
    for (const c of CTXS) {
      const ok = suitable(mark(s, false), c);
      if (k.includes(c)) {
        granted[c]++;
        assert.ok(ok, `${c}: ${JSON.stringify(s)}`);
      } else if (ok) missed[c]++;
    }
  }
  t.diagnostic(`${literals.length} literals; contexts granted: ${CTXS.map(c => `${c} ${granted[c]}`).join(', ')}`);
  t.diagnostic(`suitable by the oracle but not granted (conservativeness): ${CTXS.map(c => `${c} ${missed[c]}`).join(', ')}`);
});

test('ass:san: the output of every sanitizer is suitable for its context', t => {
  let n = 0;
  for (const x of [...PAYLOADS, ...fc.sample(arbInput, { seed: 12, numRuns: 10_000 })]) {
    for (const c of SANS) {
      n++;
      assert.ok(suitable(mark(SAN[c](x), true), c), `${c}: ${JSON.stringify(x)} -> ${JSON.stringify(SAN[c](x))}`);
    }
  }
  t.diagnostic(`${n} sanitizer outputs checked`);
});

test('D(S): every accepted value is suitable for each context of D(S)', t => {
  let n = 0;
  const values = [...PAYLOADS, '0', '42', '1234567890', ...fc.sample(arbInput, { seed: 13, numRuns: 10_000 })];
  for (const S of SCHEMAS) {
    for (const x of values.filter(v => S.zod.safeParse(v).success)) {
      for (const c of S.d) {
        n++;
        assert.ok(suitable(mark(x, true), c), `${S.ts} ${c}: ${JSON.stringify(x)}`);
      }
    }
  }
  t.diagnostic(`${n} (value, context) pairs checked`);
});

// Pieces: literals, sanitized and raw attacker strings, and their concatenations.
const arbPiece: fc.Arbitrary<Marked> = fc.oneof(
  arbLiteral.map(s => mark(s, false)),
  fc.tuple(fc.constantFrom(...SANS), arbInput).map(([c, x]) => mark(SAN[c](x), true)),
  arbInput.map(x => mark(x, true)),
);
const arbMarked = fc.array(arbPiece, { minLength: 1, maxLength: 3 })
  .map(ps => ({ s: ps.map(p => p.s).join(''), u: ps.flatMap(p => p.u) }));

test('lem:monoid: the empty string is suitable everywhere and suitable strings concatenate', t => {
  for (const c of CTXS) assert.ok(suitable(mark('', false), c));
  const both = Object.fromEntries(CTXS.map(c => [c, 0])) as Record<Ctx, number>;
  fc.assert(fc.property(arbMarked, arbMarked, (a, b) => {
    for (const c of CTXS) {
      if (!suitable(a, c) || !suitable(b, c)) continue;
      both[c]++;
      assert.ok(suitable({ s: a.s + b.s, u: [...a.u, ...b.u] }, c), `${c}: ${JSON.stringify(a.s)} + ${JSON.stringify(b.s)}`);
    }
  }), { numRuns: 20_000, seed: 14 });
  t.diagnostic(`20000 pairs; pairs suitable on both sides: ${CTXS.map(c => `${c} ${both[c]}`).join(', ')}`);
});
