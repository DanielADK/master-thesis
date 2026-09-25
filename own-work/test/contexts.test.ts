// T-Lit, T-Val, T-San and lem:monoid against def:inertnost in the browser model.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { CTXS, type Ctx } from '../src/label.ts';
import { ctxOf, dOf } from '../src/contexts.ts';
import { HOLE, SAN, SAN_CTXS, type San } from '../src/index.ts';
import { arbInput, arbLiteral, LITERALS, PAYLOADS, SCHEMAS, type Marked } from './model.ts';
import { endsInHole, executed, P, stringStartOf, suitable } from './oracle.ts';

const mark = (s: string, u: boolean): Marked => ({ s, u: Array<boolean>(s.length).fill(u) });
const SANS: San[] = ['html', 'script', 'url'];

test('ass:parse: every prefix of P and every sink prefix ends in its data hole, typical traps do not', () => {
  for (const c of CTXS) {
    for (const p of [...P[c], HOLE[c][0]]) assert.ok(endsInHole(p, c, c === 'script' ? stringStartOf(p) : undefined), `${c}: ${p}`);
  }
  for (const p of ['<div title=', '<div title="', '<script>', '<svg>', '<template>', '<!--', '<textarea>', '<a href="x">x<'])
    assert.ok(!endsInHole(p, 'html'), p);
  assert.ok(!endsInHole('<a href="java', 'url'));
  assert.ok(!endsInHole('<script>var x = "a\\', 'script', 17));
  // controlling places of ass:parse that the oracle marks as executed
  const obj = '<object data="https://evil/x"></object><embed src="https://evil/y">';
  assert.ok(executed(obj).slice(14, 28).every(Boolean), 'object data is a controlling place');
  assert.ok(executed(obj).slice(51, 65).every(Boolean), 'embed src is a controlling place');
  // several string holes: the content of every listed string is left unmarked
  const two = '<script>var a = "x"; var b = "y";</script>';
  assert.deepEqual(executed(two, [17, 30]).slice(17, 19), [false, true]);
  assert.deepEqual(executed(two, [17, 30]).slice(30, 32), [false, true]);
  // a value made of whitespace only is not url-suitable (a continuation can start with javascript:)
  assert.ok(!suitable({ s: ' ', u: [true] }, 'url'));
  // the data hole of context text: title and textarea content, text attributes outside code elements
  // (the last two: inside select the parser drops the title tag and reads its content as text)
  for (const p of ['<title>', '<title>a&', '<textarea name="b">x', '<input value="', "<p class='a ", '<div data-x="', '<span aria-label="',
    '<select><option><title>', '<select><option><title>a &amp; b'])
    assert.ok(endsInHole(p, 'text'), p);
  for (const p of ['<a href="', '<param value="', '<object name="', '<svg><a title="', '<button onclick="', '<p>', '<style>',
    '<select><option><title>x</title>', '<select><option><title><script>'])
    assert.ok(!endsInHole(p, 'text'), p);
  // url and res holes are precise about the attribute and the element
  assert.ok(!endsInHole('<div title="', 'url'));
  assert.ok(!endsInHole('<object data="', 'url'));
  assert.ok(!endsInHole('<a onclick="', 'url'));
  assert.ok(!endsInHole('<a href="', 'res'));
  // a dangerous scheme in a text attribute is not executed, in a navigational one it is
  assert.ok(!executed('<input value="javascript:alert(1)">').includes(true));
  assert.ok(executed('<a href="javascript:alert(1)">').includes(true));
  // a text value with '<' leaves the html hole where the title tag is dropped (found by exhaustive.test.ts)
  assert.ok(!suitable(mark('<title><script></title>', false), 'html'));
  assert.ok(suitable(mark('<title>a > b</title>', false), 'html'));
  assert.ok(!ctxOf('<script>').includes('text'));
});

test('def:prameny: the examples of the thesis hold in the browser model, the realization grants a subset', () => {
  // literal, ctx(s) by the thesis and the oracle, CtxOf of the realization
  const examples: [string, Ctx[], Ctx[]][] = [
    ['Dobrý den', [...CTXS], [...CTXS]],
    ['<h1>', [...CTXS], ['html']],
    ['<div title=', ['script', 'url', 'res'], []],
    ['<script>', ['script', 'url', 'res'], []],
    ['<script>init()</script>', ['html', 'url', 'res', 'text'], ['html']],
    ["it's", ['html'], ['html']],
  ];
  for (const [s, model, realized] of examples) {
    assert.deepEqual(CTXS.filter(c => suitable(mark(s, false), c)), model, s);
    assert.deepEqual(ctxOf(s), realized, s);
  }
  const d = CTXS.filter(c => c !== 'res' && ['asc', 'desc'].every(v => suitable(mark(v, true), c)));
  assert.deepEqual(d, ['html', 'script', 'url', 'text']);
  assert.deepEqual(dOf(['asc', 'desc']), d);
  assert.deepEqual(dOf(["it's", 'ok']), ['html']);
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

test('ass:san: the output of every sanitizer is suitable for every context it declares', t => {
  let n = 0;
  for (const x of [...PAYLOADS, ...fc.sample(arbInput, { seed: 12, numRuns: 10_000 })]) {
    for (const s of SANS) {
      for (const c of SAN_CTXS[s]) {
        n++;
        assert.ok(suitable(mark(SAN[s](x), true), c), `${s} for ${c}: ${JSON.stringify(x)} -> ${JSON.stringify(SAN[s](x))}`);
      }
    }
  }
  t.diagnostic(`${n} (sanitizer output, declared context) pairs checked`);
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
