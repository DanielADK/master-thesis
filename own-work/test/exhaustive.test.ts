// lem:stitky, thm:konfinace and thm:audit on every small expression (test/enumerate.ts).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CTXS, type Ctx } from '../src/label.ts';
import { evaluate, hasSource, label, PAYLOADS, toTs, wellTyped, type Marked } from './model.ts';
import { countUpTo, enumerate, POOL } from './enumerate.ts';
import { injected, suitable } from './oracle.ts';

const MAX_SIZE = 3;

const perCtx = (): Record<Ctx, number> => ({ html: 0, script: 0, url: 0, res: 0, text: 0 });
const show = (r: Record<Ctx, number>): string => CTXS.map(c => `${c} ${r[c]}`).join(', ');

// Verdicts cached per (result, context): many expressions evaluate to the same string.
const memo = new Map<string, boolean>();
function cached(kind: 'suitable' | 'injected', m: Marked, c: Ctx): boolean {
  const key = `${kind}\0${c}\0${m.s}\0${m.u.map(b => (b ? 1 : 0)).join('')}\0${(m.strings ?? []).join(',')}`;
  let v = memo.get(key);
  if (v === undefined) {
    v = kind === 'suitable' ? suitable(m, c) : injected(c, m);
    memo.set(key, v);
  }
  return v;
}

test(`every expression of size up to ${MAX_SIZE} over the pool satisfies lem:stitky, thm:konfinace and thm:audit`, t => {
  const exprs = enumerate(MAX_SIZE);
  const bySize = new Map<number, number>();
  for (const { size } of exprs) bySize.set(size, (bySize.get(size) ?? 0) + 1);
  const typed = perCtx();
  const sends = perCtx();
  const attacker = perCtx();
  let bot = 0;
  let suitability = 0;
  let traced = 0;
  for (const { e, size: _size } of exprs) {
    const l = label(e);
    for (const c of l?.K ?? []) {
      traced++;
      assert.ok(hasSource(e, c), `${c}: ${toTs(e)}`);
    }
    const typedCtxs = CTXS.filter(c => wellTyped(c, e));
    for (const c of typedCtxs) typed[c]++;
    for (const p of PAYLOADS) {
      const m = evaluate(e, [p]);
      if (!m) continue;
      if (l) {
        if (l.i === 0) {
          bot++;
          assert.ok(!m.u.includes(true), toTs(e));
        }
        for (const c of l.K) {
          suitability++;
          assert.ok(cached('suitable', m, c), `${c}: ${toTs(e)} with ${JSON.stringify(p)}`);
        }
      }
      for (const c of typedCtxs) {
        sends[c]++;
        if (m.u.includes(true)) attacker[c]++;
        assert.ok(!cached('injected', m, c), `${c}: ${toTs(e)} with ${JSON.stringify(p)}`);
      }
    }
  }
  t.diagnostic(`pool: ${POOL.literals.length} literals, ${POOL.payloads.length} payloads, ${POOL.schemas.length} schemas, `
    + `${POOL.sanitizers.length} sanitizers, ${POOL.templates.length} templates`);
  assert.equal(countUpTo(MAX_SIZE), exprs.length);
  t.diagnostic(`expressions by size: ${[...bySize].map(([n, k]) => `${n}: ${k}`).join(', ')} (${exprs.length} in all); `
    + `up to ${MAX_SIZE + 1} nodes there would be ${countUpTo(MAX_SIZE + 1)}`);
  t.diagnostic(`well typed per context: ${show(typed)}`);
  t.diagnostic(`sends checked: ${show(sends)}; of them with attacker characters: ${show(attacker)}`);
  t.diagnostic(`lem:stitky checked on ${bot} bot results and ${suitability} pairs (result, context in K); thm:audit on ${traced} contexts`);
});
