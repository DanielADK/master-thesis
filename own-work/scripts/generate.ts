// Generates test/generated: lattice.ts (label order, claim:join), literals.ts (types agree with
// run time), adequacy.ts (claim:adekvatnost), tpl.ts (templates).
import { mkdirSync, writeFileSync } from 'node:fs';
import fc from 'fast-check';
import { CTXS } from '../src/label.ts';
import { ctxOf, dOf } from '../src/contexts.ts';
import { arbLiteral, arbProgram, label, LITERALS, PAYLOADS, SCHEMAS, toTs, tsString, wellTyped } from '../test/model.ts';

const dir = new URL('../test/generated/', import.meta.url);
mkdirSync(dir, { recursive: true });
const write = (name: string, lines: string[]): void => writeFileSync(new URL(name, dir), lines.join('\n') + '\n');
const EXPECT_ERROR = '// @ts-expect-error';
const union = (cs: readonly string[]): string => cs.map(c => `'${c}'`).join(' | ') || 'never';

// --- lattice.ts ---
const LEVELS = ["'lit'", "'lit' | 'val'", 'Level'];
const labels = LEVELS.flatMap((enc, i) => Array.from({ length: 1 << CTXS.length }, (_, m) =>
  ({ i, K: CTXS.filter((_, b) => m & (1 << b)), enc })));
const le = (a: (typeof labels)[number], b: (typeof labels)[number]): boolean =>
  a.i <= b.i && b.K.every(c => a.K.includes(c));
const lattice = [
  "import { cat, type Level, type Str } from '../../src/index.ts';",
  ...labels.map((l, n) => `type L${n} = Str<${l.enc}, ${union(l.K)}>;`),
  ...labels.map((_, n) => `declare const l${n}: L${n};`),
];
let order = 0;
let joins = 0;
labels.forEach((a, x) => labels.forEach((b, y) => {
  if (!le(a, b)) lattice.push(EXPECT_ERROR);
  lattice.push(`{ const v: L${y} = l${x}; }`);
  order++;
}));
// claim:join for every pair and target as type-level checks; the value-level variant takes minutes.
lattice.push(
  'type Le<A, B> = [A] extends [B] ? true : false;',
  `type Ls = [${labels.map((_, n) => `L${n}`).join(', ')}];`,
  'type Row<U, Ts extends unknown[] = Ls> = { [T in keyof Ts]: Le<U, Ts[T]> };',
);
labels.forEach((a, x) => labels.forEach((b, y) => {
  if (y < x) return;
  const j = { i: Math.max(a.i, b.i), K: a.K.filter(c => b.K.includes(c)) };
  const row = labels.map(t => j.i <= t.i && t.K.every(c => j.K.includes(c)));
  lattice.push(`export const j${x}_${y}: Row<ReturnType<typeof cat<L${x}, L${y}>>> = [${row.join(', ')}];`);
  joins += row.length;
}));
write('lattice.ts', lattice);

// --- literals.ts ---
const randomLiterals = fc.sample(arbLiteral, { seed: 1, numRuns: 10_000 });
const literals = [...new Set([...LITERALS, ...PAYLOADS, ...randomLiterals])];
const enums = SCHEMAS.flatMap(S => (S.values ? [S.values] : []));
write('literals.ts', [
  "import type { CtxOf, D } from '../../src/index.ts';",
  'type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;',
  ...literals.map((s, n) => `export const c${n}: Same<CtxOf<${tsString(s)}>, ${union(ctxOf(s))}> = true;`),
  ...enums.map((vals, n) => `export const d${n}: Same<D<${vals.map(tsString).join(' | ')}>, ${union(dOf(vals))}> = true;`),
]);

// --- adequacy.ts ---
const programs = fc.sample(arbProgram, { seed: 2, numRuns: 10_000 });
const adequacy = [
  "import { z } from 'zod';",
  "import { cat, h, out, parse, sanitize, send, type Res } from '../../src/index.ts';",
  ...SCHEMAS.map((S, n) => `const S${n} = ${S.ts};`),
  'export function programs(res: Res, src0: string, src1: string): void {',
];
let accepted = 0;
let hiddenD = 0;
for (const { c, e } of programs) {
  const ok = wellTyped(c, e, true);
  if (ok) accepted++;
  else adequacy.push(`  ${EXPECT_ERROR}`);
  if (!ok && wellTyped(c, e)) hiddenD++;
  adequacy.push(`  ${c === 'html' ? 'send(res, ' : `out('${c}', `}${toTs(e)});`);
}
adequacy.push('}');
write('adequacy.ts', adequacy);

const sanFails = programs.filter(p => label(p.e, true) === undefined).length;
console.log(`lattice.ts: ${labels.length} labels, ${order} order assignments, ${joins} join assignments`);
console.log(`literals.ts: ${literals.length} literals, ${enums.length} enum schemas`);
console.log(`adequacy.ts: ${programs.length} programs, ${accepted} well typed, ${programs.length - accepted} ill typed `
  + `(${sanFails} by T-San); ${hiddenD} well typed in the model only because D(S) of a regex schema is invisible to TS`);
