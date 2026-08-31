// lem:mrizka by enumerating all labels; the type-level order is in test/generated/lattice.ts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CTXS, type Ctx } from '../src/label.ts';

type L = { i: number; K: Ctx[] };
const LABELS: L[] = [0, 1, 2].flatMap(i =>
  Array.from({ length: 16 }, (_, m) => ({ i, K: CTXS.filter((_, b) => m & (1 << b)) })));
const le = (a: L, b: L): boolean => a.i <= b.i && b.K.every(c => a.K.includes(c));
const join = (a: L, b: L): L => ({ i: Math.max(a.i, b.i), K: a.K.filter(c => b.K.includes(c)) });
const same = (a: L, b: L): boolean => le(a, b) && le(b, a);

test('A1: there are 3 * 2^4 = 48 labels', () => {
  assert.equal(LABELS.length, 48);
});

test('A2: the order is reflexive, antisymmetric and transitive', () => {
  for (const a of LABELS) {
    assert.ok(le(a, a));
    for (const b of LABELS) {
      if (le(a, b) && le(b, a)) assert.equal(a, b);
      for (const c of LABELS) if (le(a, b) && le(b, c)) assert.ok(le(a, c));
    }
  }
});

test('A3: (bot, Ctxs) is the unique least element', () => {
  const least = LABELS.filter(a => LABELS.every(b => le(a, b)));
  assert.deepEqual(least, [{ i: 0, K: [...CTXS] }]);
});

test('A4: the join is the least upper bound', t => {
  let several = 0;
  for (const a of LABELS) {
    for (const b of LABELS) {
      const j = join(a, b);
      const upper = LABELS.filter(c => le(a, c) && le(b, c));
      assert.ok(upper.some(c => same(c, j)));
      assert.ok(upper.every(c => le(j, c)));
      if (upper.length > 1) several++;
    }
  }
  assert.ok(several > 0);
  t.diagnostic(`${several} of ${48 * 48} pairs have more than one upper bound`);
});

test('the join is commutative, associative and idempotent, so the order of joins does not matter', () => {
  for (const a of LABELS) {
    assert.ok(same(join(a, a), a));
    for (const b of LABELS) {
      assert.ok(same(join(a, b), join(b, a)));
      for (const c of LABELS) assert.ok(same(join(join(a, b), c), join(a, join(b, c))));
    }
  }
});
