// Every expression up to a given number of nodes over the building blocks of test/model.ts.
import type { San } from '../src/index.ts';
import { LITERALS, PAYLOADS, SCHEMAS, TEMPLATES, type Expr } from './model.ts';

export const POOL = {
  literals: LITERALS,
  payloads: PAYLOADS,
  schemas: SCHEMAS,
  sanitizers: ['html', 'script', 'url'] as const satisfies readonly San[],
  templates: TEMPLATES,
};

export type Sized = { e: Expr; size: number };

/** All ways to split `total` into `parts` positive summands, in order. */
function compositions(total: number, parts: number): number[][] {
  if (parts === 0) return total === 0 ? [[]] : [];
  const out: number[][] = [];
  for (let first = 1; first <= total - (parts - 1); first++) {
    for (const rest of compositions(total - first, parts - 1)) out.push([first, ...rest]);
  }
  return out;
}

/** The size of enumerate(maxSize), computed without building the expressions. */
export function countUpTo(maxSize: number): number {
  const counts: number[] = [0, POOL.literals.length + 1];
  for (let n = 2; n <= maxSize; n++) {
    let c = (POOL.schemas.length + POOL.sanitizers.length) * (counts[n - 1] ?? 0);
    for (const [i = 0, j = 0] of compositions(n - 1, 2)) c += (counts[i] ?? 0) * (counts[j] ?? 0);
    for (const statics of POOL.templates) {
      for (const sizes of compositions(n - 1, statics.length - 1)) c += sizes.reduce((p, s) => p * (counts[s] ?? 0), 1);
    }
    counts[n] = c;
  }
  return counts.reduce((a, b) => a + b, 0);
}

/** Every expression whose size is at most `maxSize`; the single request value is src 0. */
export function enumerate(maxSize: number): Sized[] {
  const bySize: Expr[][] = [[]];
  bySize[1] = [...POOL.literals.map((s): Expr => ({ k: 'lit', s })), { k: 'src', n: 0 }];
  for (let n = 2; n <= maxSize; n++) {
    const level: Expr[] = [];
    for (const e of bySize[n - 1] ?? []) {
      for (const S of POOL.schemas) level.push({ k: 'val', S, e });
      for (const c of POOL.sanitizers) level.push({ k: 'san', c, e });
    }
    for (const [i = 0, j = 0] of compositions(n - 1, 2)) {
      for (const a of bySize[i] ?? []) for (const b of bySize[j] ?? []) level.push({ k: 'cat', a, b });
    }
    for (const statics of POOL.templates) {
      for (const sizes of compositions(n - 1, statics.length - 1)) {
        let holesList: Expr[][] = [[]];
        for (const size of sizes) holesList = holesList.flatMap(holes => (bySize[size] ?? []).map(h => [...holes, h]));
        for (const holes of holesList) level.push({ k: 'tpl', statics: [...statics], holes });
      }
    }
    bySize[n] = level;
  }
  return bySize.flatMap((level, size) => level.map(e => ({ e, size })));
}
