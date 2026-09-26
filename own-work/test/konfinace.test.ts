// thm:konfinace, lem:stitky and thm:audit on generated programs, in the browser model.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { CTXS, type Ctx } from '../src/label.ts';
import { walk, type San } from '../src/index.ts';
import { arbExpr, arbInput, arbProgram, evaluate, hasSource, label, PAYLOADS, toTs, wellTyped, type Expr, type Marked } from './model.ts';
import { injected, suitable } from './oracle.ts';
import { routes } from './compile/running-example.ts';

const perCtx = (): Record<Ctx, number> => ({ html: 0, script: 0, url: 0, res: 0, text: 0 });
const show = (r: Record<Ctx, number>): string => CTXS.map(c => `${c} ${r[c]}`).join(', ');

/** Response body of a route; undefined when validation rejects the input. */
function run(path: string, q: string): string | undefined {
  let body: string | undefined;
  try {
    routes.get(path)?.({ query: { q } }, { send: b => { body = b; } });
  } catch {
    return undefined;
  }
  return body;
}

/** The body with the characters between the two literals marked as the attacker's. */
function between(body: string, pre: string, post: string): Marked {
  assert.ok(body.startsWith(pre) && body.endsWith(post));
  const n = body.length - pre.length - post.length;
  return { s: body, u: [...Array<boolean>(pre.length).fill(false), ...Array<boolean>(n).fill(true), ...Array<boolean>(post.length).fill(false)] };
}

test('running example: the compiling handler never injects, the rejected handlers do', t => {
  let sent = 0;
  for (const q of PAYLOADS) {
    const body = run('/hledat', q);
    if (body === undefined) continue;
    sent++;
    assert.ok(!injected('html', between(body, '<h1>Výsledky pro: ', '</h1>')), q);
  }
  const vulnerable = PAYLOADS.filter(q => injected('html', between(run('/zranitelne', q) ?? '', '<h1>', '</h1>')));
  const original = PAYLOADS.filter(q => injected('html', between(run('/puvodni', q) ?? '', '<h1>Výsledky pro: ', '</h1>')));
  assert.ok(vulnerable.length > 0 && original.length > 0);
  t.diagnostic(`/hledat: ${sent} payloads sent, none injected; /zranitelne: ${vulnerable.length} and /puvodni: `
    + `${original.length} of ${PAYLOADS.length} payloads injected, e.g. ${JSON.stringify(vulnerable[0])}`);
});

// Coverage of the sample and when each feature first appeared.
const coverage = {
  rules: { lit: 0, src: 0, cat: 0, val: 0, san: 0, tpl: 0 } as Record<Expr['k'], number>,
  sans: { html: 0, script: 0, url: 0 } as Record<San, number>,
  schemas: new Map<string, number>(),
  holes: perCtx(),
  first: new Map<string, number>(),
  samples: 0,
};
const seen = (feature: string): void => { if (!coverage.first.has(feature)) coverage.first.set(feature, coverage.samples); };
function depth(e: Expr): number {
  switch (e.k) {
    case 'lit': case 'src': return 1;
    case 'cat': return 1 + Math.max(depth(e.a), depth(e.b));
    case 'val': case 'san': return 1 + depth(e.e);
    case 'tpl': return 1 + Math.max(0, ...e.holes.map(depth));
  }
}
function count(e: Expr, parent = 'out'): void {
  coverage.rules[e.k]++;
  seen(`${parent} > ${e.k}`);
  switch (e.k) {
    case 'cat': count(e.a, 'cat'); count(e.b, 'cat'); break;
    case 'val': coverage.schemas.set(e.S.ts, (coverage.schemas.get(e.S.ts) ?? 0) + 1); seen(e.S.ts); count(e.e, 'val'); break;
    case 'san': coverage.sans[e.c]++; seen(`san ${e.c}`); count(e.e, 'san'); break;
    case 'tpl': {
      const w = walk(e.statics);
      if (!('error' in w)) for (const c of w.holes) { coverage.holes[c]++; seen(`hole ${c}`); }
      e.holes.forEach(h => count(h, 'tpl'));
      break;
    }
    default:
  }
}

test('thm:konfinace: no well-typed program sends an executed attacker character', t => {
  const typed = perCtx();
  const runs = perCtx();
  const attacker = perCtx();
  let rejected = 0;
  fc.assert(fc.property(arbProgram, fc.tuple(arbInput, arbInput), ({ c, e }, inputs) => {
    coverage.samples++;
    seen(`out ${c} ${e.k}`);
    seen(`depth ${depth(e)}`);
    count(e);
    if (!wellTyped(c, e)) return;
    typed[c]++;
    for (const xs of [inputs, ...PAYLOADS.map(p => [p, p])]) {
      const m = evaluate(e, xs);
      if (!m) {
        rejected++;
        continue;
      }
      runs[c]++;
      if (m.u.includes(true)) attacker[c]++;
      assert.ok(!injected(c, m), `${c}: ${toTs(e)} with ${JSON.stringify(xs)}`);
    }
  }), { numRuns: 100_000, seed: 3 });
  t.diagnostic(`100000 programs; well typed: ${show(typed)}`);
  t.diagnostic(`sends checked: ${show(runs)} (${rejected} runs stopped by validation)`);
  t.diagnostic(`of them with attacker characters in the output: ${show(attacker)}`);
  // every rule, sanitizer, schema and hole context occurs; the sample saturates long before its end
  for (const [k, n] of Object.entries(coverage.rules)) assert.ok(n > 0, k);
  for (const [c, n] of Object.entries(coverage.sans)) assert.ok(n > 0, c);
  assert.equal(coverage.schemas.size, 8);
  for (const c of CTXS) assert.ok(coverage.holes[c] > 0, c);
  const firsts = [...coverage.first].sort((a, b) => b[1] - a[1]);
  const shapes = firsts.filter(([f]) => !f.startsWith('depth'));
  assert.ok((firsts[0]?.[1] ?? Infinity) < coverage.samples / 2);
  t.diagnostic(`coverage: rules ${Object.entries(coverage.rules).map(([k, n]) => `${k} ${n}`).join(', ')}`);
  t.diagnostic(`coverage: sanitizers ${Object.entries(coverage.sans).map(([c, n]) => `${c} ${n}`).join(', ')}; `
    + `schemas ${[...coverage.schemas].map(([s, n]) => `${s} ${n}`).join(', ')}; template holes ${show(coverage.holes)}`);
  t.diagnostic(`saturation: ${shapes.length} combinations of rule, sanitizer, schema and hole context all seen by sample `
    + `${shapes[0]?.[1]} (last: ${shapes[0]?.[0]}); deepest shape (${firsts[0]?.[0]}) by sample ${firsts[0]?.[1]}`);
});

/** How request input reaches the result. */
function input(e: Expr): 'none' | 'sanitized' | 'raw' {
  switch (e.k) {
    case 'lit': return 'none';
    case 'src': return 'raw';
    case 'val': return input(e.e);
    case 'san': return input(e.e) === 'none' ? 'none' : 'sanitized';
    case 'cat': {
      const both = [input(e.a), input(e.b)];
      return both.includes('raw') ? 'raw' : both.includes('sanitized') ? 'sanitized' : 'none';
    }
    case 'tpl': {
      const all = e.holes.map(input);
      return all.includes('raw') ? 'raw' : all.includes('sanitized') ? 'sanitized' : 'none';
    }
  }
}

const TYPICAL: Record<Ctx, string> = {
  html: '<img src=x onerror=alert(1)>', script: '";alert(1)//', url: 'javascript:alert(1)', res: 'https://evil.example/x.js',
  text: '" onmouseover="alert(1)',
};

test('the checker is not vacuous: ill-typed programs inject', t => {
  const ill = perCtx();
  const hit = perCtx();
  const hitSan = perCtx();
  const best: Partial<Record<string, { rank: number; text: string }>> = {};
  let sanFails = 0;
  for (const { c, e } of fc.sample(arbProgram, { seed: 4, numRuns: 50_000 })) {
    if (wellTyped(c, e)) continue;
    ill[c]++;
    if (!label(e)) sanFails++;
    const hits = PAYLOADS.filter(x => {
      const m = evaluate(e, [x, x]);
      return m !== undefined && injected(c, m);
    });
    if (hits.length === 0) continue;
    hit[c]++;
    const key = input(e) === 'sanitized' ? `${c}, all input sanitized` : c;
    if (input(e) === 'sanitized') hitSan[c]++;
    // report the typical payload of the context in the shortest program
    const p = hits.includes(TYPICAL[c]) ? TYPICAL[c] : hits[0];
    const text = `${c === 'html' ? 'send(res, ' : `out('${c}', `}${toTs(e)}) with src = ${JSON.stringify(p)}`;
    const rank = (p === TYPICAL[c] ? 0 : 1000) + text.length;
    if ((best[key]?.rank ?? Infinity) > rank) best[key] = { rank, text };
  }
  for (const c of CTXS) assert.ok(hit[c] > 0, c);
  t.diagnostic(`50000 programs; ill typed: ${show(ill)} (${sanFails} violate T-San)`);
  t.diagnostic(`of them injecting with some payload: ${show(hit)}; of those with all input sanitized: ${show(hitSan)}`);
  for (const [key, ex] of Object.entries(best)) t.diagnostic(`example (${key}): ${ex?.text}`);
});

test('lem:stitky: the result of a typable expression corresponds to its label', t => {
  let bot = 0;
  let suitability = 0;
  fc.assert(fc.property(arbExpr, fc.tuple(arbInput, arbInput), (e, inputs) => {
    const l = label(e);
    if (!l) return;
    for (const xs of [inputs, ['<img src=x onerror=alert(1)>', 'javascript:alert(1)'], ['asc', '123']]) {
      const m = evaluate(e, xs);
      if (!m) continue;
      if (l.i === 0) {
        bot++;
        assert.ok(!m.u.includes(true), toTs(e));
      }
      for (const c of l.K) {
        suitability++;
        assert.ok(suitable(m, c), `${c}: ${toTs(e)} with ${JSON.stringify(xs)}`);
      }
    }
  }), { numRuns: 20_000, seed: 5 });
  t.diagnostic(`20000 expressions; (a) checked on ${bot} bot results, (b) on ${suitability} pairs (result, context in K)`);
});

test('thm:audit: every context in a label has a source in the derivation', t => {
  let checked = 0;
  fc.assert(fc.property(arbExpr, e => {
    for (const c of label(e)?.K ?? []) {
      checked++;
      assert.ok(hasSource(e, c), `${c}: ${toTs(e)}`);
    }
  }), { numRuns: 100_000, seed: 6 });
  t.diagnostic(`100000 expressions, ${checked} contexts traced to T-Lit, T-San or T-Val`);
});
