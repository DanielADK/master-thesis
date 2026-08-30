// Runtime model of sec:model-jazyk: expressions, label rules, evaluation with u[j] = character j is the attacker's.
import fc from 'fast-check';
import { z } from 'zod';
import { CTXS, type Ctx } from '../src/label.ts';
import { ctxOf, dOf } from '../src/contexts.ts';
import { SAN, type SanCtx } from '../src/index.ts';

export type Schema = { ts: string; zod: z.ZodType<string>; d: Ctx[]; dTs: Ctx[]; values?: string[] };
export type Expr =
  | { k: 'lit'; s: string }
  | { k: 'src'; n: number }
  | { k: 'cat'; a: Expr; b: Expr }
  | { k: 'val'; S: Schema; e: Expr }
  | { k: 'san'; c: SanCtx; e: Expr };
export type Label = { i: number; K: Ctx[] }; // i: 0 = bot, 1 = mid, 2 = top
export type Marked = { s: string; u: boolean[] };

const enumOf = (vals: [string, ...string[]]): Schema =>
  ({ ts: `z.enum(${JSON.stringify(vals)})`, zod: z.enum(vals), d: dOf(vals), dTs: dOf(vals), values: vals });

// d: D(S) in the model; dTs: the part of D(S) that TypeScript sees in the schema output type.
export const SCHEMAS: Schema[] = [
  enumOf(['asc', 'desc']),
  enumOf(["it's", 'ok']),
  enumOf(['javascript:void(0)', '/']),
  enumOf(['<b>', 'x']),
  { ts: 'z.string()', zod: z.string(), d: [], dTs: [] },
  { ts: 'z.string().max(100)', zod: z.string().max(100), d: [], dTs: [] },
  { ts: 'z.string().max(3)', zod: z.string().max(3), d: [], dTs: [] },
  // Digits contain no '<', no script delimiter and are neither a dangerous scheme nor its prefix.
  { ts: 'z.string().regex(/^\\d+$/)', zod: z.string().regex(/^\d+$/), d: ['html', 'script', 'url'], dTs: [] },
];

export function label(e: Expr, visible = false): Label | undefined {
  switch (e.k) {
    case 'lit': return { i: 0, K: ctxOf(e.s) };
    case 'src': return { i: 2, K: [] };
    case 'cat': {
      const a = label(e.a, visible);
      const b = label(e.b, visible);
      return a && b && { i: Math.max(a.i, b.i), K: a.K.filter(c => b.K.includes(c)) };
    }
    case 'val': {
      const a = label(e.e, visible);
      const d = visible ? e.S.dTs : e.S.d;
      return a && { i: Math.min(a.i, 1), K: CTXS.filter(c => a.K.includes(c) || d.includes(c)) };
    }
    case 'san': {
      const a = label(e.e, visible);
      return a && a.i !== 2 ? { i: 1, K: [e.c] } : undefined;
    }
  }
}

/** T-Out: the program out_c(e) is well typed. */
export function wellTyped(c: Ctx, e: Expr, visible = false): boolean {
  const l = label(e, visible);
  return l !== undefined && (l.i === 0 || l.K.includes(c));
}

const mark = (s: string, u: boolean): Marked => ({ s, u: Array<boolean>(s.length).fill(u) });

/** Evaluates e. Returns undefined when a validation fails (the run ends with an error). */
export function evaluate(e: Expr, inputs: readonly string[]): Marked | undefined {
  switch (e.k) {
    case 'lit': return mark(e.s, false);
    case 'src': return mark(inputs[e.n] ?? '', true);
    case 'cat': {
      const a = evaluate(e.a, inputs);
      const b = a && evaluate(e.b, inputs);
      return b && { s: a.s + b.s, u: [...a.u, ...b.u] };
    }
    case 'val': {
      const a = evaluate(e.e, inputs);
      return a && e.S.zod.safeParse(a.s).success ? a : undefined;
    }
    case 'san': {
      const a = evaluate(e.e, inputs);
      return a && mark(SAN[e.c](a.s), true);
    }
  }
}

/** thm:audit: some node of the derivation is T-Lit, T-San or T-Val that grants c. */
export function hasSource(e: Expr, c: Ctx): boolean {
  switch (e.k) {
    case 'lit': return ctxOf(e.s).includes(c);
    case 'src': return false;
    case 'cat': return hasSource(e.a, c) || hasSource(e.b, c);
    case 'val': return e.S.d.includes(c) || hasSource(e.e, c);
    case 'san': return e.c === c;
  }
}

export const tsString = (s: string): string =>
  JSON.stringify(s).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

export function toTs(e: Expr): string {
  switch (e.k) {
    case 'lit': return `h(${tsString(e.s)})`;
    case 'src': return `src${e.n}`;
    case 'cat': return `cat(${toTs(e.a)}, ${toTs(e.b)})`;
    case 'val': return `parse(S${SCHEMAS.indexOf(e.S)}, ${toTs(e.e)})`;
    case 'san': return `sanitize('${e.c}', ${toTs(e.e)})`;
  }
}

export const LITERALS = [
  '', 'Výsledky pro: ', '<h1>', '</h1>', '<h1>Výsledky pro: ', '<p>', '</p>', '<b>', '</b>', 'Dobrý den',
  '<div title=', '<div title="', '">', '>', "'", '"', '<script>', '</script>', '<script>init()</script>',
  '<a href="', '<a href="javascript:void(0)">', '</a>', 'javascript:', 'java', 'script:', ':alert(1)',
  'https://example.com/?q=', '/search?q=', './', '?a=', '#top', 'mailto:', '&', '&amp;', ' & ',
  '<!--', '-->', '<svg>', '<svg><script>', '<textarea>', '</textarea>', '<style>p{}</style>', '<input value=',
  '<img src=x>', 'x onmouseover=f() ', 'var y = 1;', '\\', '\n', '<br/>', "<a title='x'>", '<x-y data-a="1">',
];

export const PAYLOADS = [
  'Praha', 'asc', 'desc', "it's", 'ok', 'javascript:void(0)', '/', '<b>', 'x', '123', '',
  '<script>alert(1)</script>', '<img src=x onerror=alert(1)>', '<svg onload=alert(1)>',
  '" onmouseover="alert(1)', "' onmouseover='alert(1)", 'x onfocus=alert(1) autofocus',
  'javascript:alert(1)', 'JaVaScRiPt:alert(1)', ' javascript:alert(1)', 'java\tscript:alert(1)',
  '\x01javascript:alert(1)', '&#106;avascript:alert(1)', 'data:text/html,<script>alert(1)</script>',
  'vbscript:msgbox(1)', '";alert(1)//', "';alert(1)//", '\\";alert(1)//', '</script><script>alert(1)</script>',
  '\u2028alert(1)', '\nalert(1)', '<!--', '-->', '<![CDATA[', ']]>', '\\', 'java', 'script:alert(1)',
  ':alert(1)', '<iframe srcdoc="<script>alert(1)</script>">', '//evil.example/x.js',
  'https://evil.example/x.js', '<a href=javascript:alert(1)>x</a>', '`${alert(1)}`', '&lt;script&gt;',
];

const TOKENS = ['<', '>', '/', '"', "'", '=', ' ', '\t', '\n', 'a', 'b', 'x', 'p', 'div', 'script', 'svg',
  'title', 'href', 'onclick', 'javascript', 'java', ':', '&', ';', '#', '-', '!', '\\', '`', '(', ')',
  'alert(1)', 'é', '\u2028', '?', '.'];

const tokens = (max: number): fc.Arbitrary<string> =>
  fc.array(fc.constantFrom(...TOKENS), { maxLength: max }).map(a => a.join(''));

export const arbLiteral = fc.oneof(fc.constantFrom(...LITERALS), tokens(6));
export const arbInput = fc.oneof(fc.constantFrom(...PAYLOADS), tokens(8), fc.string({ unit: 'binary', maxLength: 10 }));
const arbSchema = fc.constantFrom(...SCHEMAS);

/** Random expressions. Sanitized request input mostly uses the sanitizer of context `prefer`. */
const arbExprFor = (prefer: SanCtx): fc.Arbitrary<Expr> => fc.letrec<{ e: Expr }>(tie => {
  const arbSan = fc.constantFrom<SanCtx>(prefer, prefer, prefer, 'html', 'script', 'url');
  return {
    e: fc.oneof(
      { maxDepth: 4, depthIdentifier: 'expr' },
      { weight: 3, arbitrary: arbLiteral.map((s): Expr => ({ k: 'lit', s })) },
      { weight: 1, arbitrary: fc.nat(1).map((n): Expr => ({ k: 'src', n })) },
      { weight: 3, arbitrary: fc.tuple(arbSchema, arbSan, fc.nat(1)).map(([S, c, n]): Expr =>
        ({ k: 'san', c, e: { k: 'val', S, e: { k: 'src', n } } })) },
      { weight: 1, arbitrary: fc.tuple(arbSchema, fc.nat(1)).map(([S, n]): Expr => ({ k: 'val', S, e: { k: 'src', n } })) },
      { weight: 3, arbitrary: fc.tuple(tie('e'), tie('e')).map(([a, b]): Expr => ({ k: 'cat', a, b })) },
      { weight: 1, arbitrary: fc.tuple(arbSchema, tie('e')).map(([S, e]): Expr => ({ k: 'val', S, e })) },
      { weight: 1, arbitrary: fc.tuple(arbSan, tie('e')).map(([c, e]): Expr => ({ k: 'san', c, e })) },
    ),
  };
}).e;

export const arbExpr = fc.constantFrom<SanCtx>('html', 'script', 'url').chain(arbExprFor);
export const arbProgram = fc.constantFrom(...CTXS).chain(c => arbExprFor(c === 'res' ? 'html' : c).map(e => ({ c, e })));
