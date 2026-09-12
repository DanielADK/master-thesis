// Runtime model of sec:model-jazyk: expressions, label rules, evaluation with u[j] = character j is the attacker's.
import fc from 'fast-check';
import { z } from 'zod';
import { CTXS, type Ctx } from '../src/label.ts';
import { ctxOf, dOf } from '../src/contexts.ts';
import { SAN, SAN_CTXS, walk, type San } from '../src/index.ts';

export type Schema = { ts: string; zod: z.ZodType<string>; d: Ctx[]; dTs: Ctx[]; values?: string[] };
export type Expr =
  | { k: 'lit'; s: string }
  | { k: 'src'; n: number }
  | { k: 'cat'; a: Expr; b: Expr }
  | { k: 'val'; S: Schema; e: Expr }
  | { k: 'san'; c: San; e: Expr }
  | { k: 'tpl'; statics: string[]; holes: Expr[] }; // statics.length === holes.length + 1
export type Label = { i: number; K: Ctx[] }; // i: 0 = bot, 1 = mid, 2 = top
/** A string with the origin of each character; `strings` are the starts of its script string holes. */
export type Marked = { s: string; u: boolean[]; strings?: number[] };

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
  { ts: 'z.string().regex(/^\\d+$/)', zod: z.string().regex(/^\d+$/), d: ['html', 'script', 'url', 'text'], dTs: [] },
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
      return a && a.i !== 2 ? { i: 1, K: [...SAN_CTXS[e.c]] } : undefined;
    }
    case 'tpl': {
      const w = walk(e.statics);
      if ('error' in w) return undefined;
      let i = 0;
      for (const [k, hole] of e.holes.entries()) {
        const l = label(hole, visible);
        const c = w.holes[k];
        if (!l || c === undefined || !l.K.includes(c)) return undefined;
        i = Math.max(i, l.i);
      }
      return { i, K: ['html'] };
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
      return b && { s: a.s + b.s, u: [...a.u, ...b.u], strings: [...(a.strings ?? []), ...(b.strings ?? []).map(x => x + a.s.length)] };
    }
    case 'val': {
      const a = evaluate(e.e, inputs);
      return a && e.S.zod.safeParse(a.s).success ? a : undefined;
    }
    case 'san': {
      const a = evaluate(e.e, inputs);
      return a && mark(SAN[e.c](a.s), true);
    }
    case 'tpl': {
      const w = walk(e.statics);
      const partStart: number[] = [];
      let out: Marked = { s: '', u: [], strings: [] };
      const append = (p: Marked): void => {
        out = { s: out.s + p.s, u: [...out.u, ...p.u], strings: [...(out.strings ?? []), ...(p.strings ?? []).map(x => x + out.s.length)] };
      };
      for (const [k, s] of e.statics.entries()) {
        partStart.push(out.s.length);
        append(mark(s, false));
        const hole = e.holes[k];
        if (hole === undefined) break;
        const v = evaluate(hole, inputs);
        if (!v) return undefined;
        append(v);
      }
      if (!('error' in w)) {
        for (const at of w.strings) if (at) out.strings?.push((partStart[at.part] ?? 0) + at.offset);
      }
      return out;
    }
  }
}

/** thm:audit: some node of the derivation is T-Lit, T-San, T-Val or T-Tpl that grants c. */
export function hasSource(e: Expr, c: Ctx): boolean {
  switch (e.k) {
    case 'lit': return ctxOf(e.s).includes(c);
    case 'src': return false;
    case 'cat': return hasSource(e.a, c) || hasSource(e.b, c);
    case 'val': return e.S.d.includes(c) || hasSource(e.e, c);
    case 'san': return SAN_CTXS[e.c].includes(c);
    case 'tpl': return c === 'html';
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
    case 'tpl': {
      const rest = e.holes.flatMap((hole, k) => [toTs(hole), tsString(e.statics[k + 1] ?? '')]);
      return `html(${[tsString(e.statics[0] ?? ''), ...rest].join(', ')})`;
    }
  }
}

export const LITERALS = [
  '', 'Výsledky pro: ', '<h1>', '</h1>', '<h1>Výsledky pro: ', '<p>', '</p>', '<b>', '</b>', 'Dobrý den',
  '<div title=', '<div title="', '">', '>', "'", '"', '<script>', '</script>', '<script>init()</script>',
  '<a href="', '<a href="javascript:void(0)">', '</a>', 'javascript:', 'java', 'script:', ':alert(1)',
  'https://example.com/?q=', '/search?q=', './', '?a=', '#top', 'mailto:', '&', '&amp;', ' & ',
  '<!--', '-->', '<svg>', '<svg><script>', '<textarea>', '</textarea>', '<style>p{}</style>', '<input value=',
  '<img src=x>', 'x onmouseover=f() ', 'var y = 1;', '\\', '\n', '<br/>', "<a title='x'>", '<x-y data-a="1">',
  '<title>', '</title>', '<title>x</title>', '<input value="', '</textarea>', '<textarea name="b">',
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
const arbExprFor = (prefer: San): fc.Arbitrary<Expr> => fc.letrec<{ e: Expr }>(tie => {
  const arbSan = fc.constantFrom<San>(prefer, prefer, prefer, 'html', 'script', 'url');
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

/** Static parts of test templates, accepted and rejected ones. */
export const TEMPLATES: readonly (readonly string[])[] = [
  ['<p>', '</p>'], ['<h1>Výsledky pro: ', '</h1>'], ['', ''], ['<ul>', '</ul>'], ['<p>', '<b>', '</b>', '</p>'],
  ['<a href="', '">', '</a>'], ['<a href="/user/', '">x</a>'], ['<a href="?sort=', '">', '</a>'], ['<a href="', '', '">x</a>'],
  ['<img src="', '" alt="', '">'], ['<input name="q" value="', '">'], ['<div title="', '" class="', '">', '</div>'],
  ['<title>', '</title>'], ['<title>Hledání: ', '</title><p>', '</p>'], ['<textarea name="bio">', '</textarea>'],
  ['<script>var q = "', '"; init(q);</script>'], ["<script>var a = '", "' + '", "';</script>"],
  ['<script src="', '"></script>'], ['<!doctype html><html><body>', '</body></html>'], ['<p>', ''], ['<br/><p>', '</p>'],
  ['<div title=', '>'], ['<a href="java', '">'], ['<button onclick="', '">x</button>'], ['<iframe srcdoc="', '">'],
  ['<base href="', '">'], ['<object data="', '"></object>'], ['<param value="', '">'], ['<script>var q = ', ';</script>'],
  ['<style>', '</style>'], ['<svg>', '</svg>'], ['<!-- ', ' -->'], ['<p class=x>', '</p>'], ['<a href="', ''],
  ['<DIV ONCLICK="', '">'], ['<TITLE>', '</Title>'], ['<script>a = 1 / 2; var s = "', '";</script>'],
  ['<script>var a = 1; --> "', '";</script>'], ['<p style="', '">', '</p>'], ['<script nonce="', '"></script>'],
];

const SEGMENTS = ['<p>', '</p>', '<b>', '</b>', 'text ', '<a href="', '" title="', '">', '</a>', '<img src="/x/', '" alt="',
  '<input value="', '<title>', '</title>', '<textarea>', '</textarea>', '<script>var x = "', '";</script>',
  "<script>var y = '", "';</script>", '<script src="', '"></script>', '<!doctype html>', '<div onclick="', '<object data="',
  '<iframe srcdoc="', '<style>', '</style>', '<svg>', '</svg>', '<br/>', '<p class=x>', '<!-- ', ' -->', '&amp;',
  '<DIV ID="', '</DIV>', '<base href="', 'java', '<option value="', '"></option>'];

/** Random static parts: a few segments with a hole at random joints. */
export const arbStatics: fc.Arbitrary<string[]> = fc.array(fc.constantFrom(...SEGMENTS), { minLength: 1, maxLength: 6 })
  .chain(segs => fc.array(fc.boolean(), { minLength: segs.length - 1, maxLength: segs.length - 1 }).map(cut => {
    const statics: string[] = [];
    let cur = segs[0] ?? '';
    cut.forEach((isHole, j) => {
      const next = segs[j + 1] ?? '';
      if (isHole) { statics.push(cur); cur = next; } else cur += next;
    });
    statics.push(cur);
    return statics;
  }));

const arbSanFor = (c: San): fc.Arbitrary<Expr> =>
  fc.tuple(arbSchema, fc.nat(1)).map(([S, n]): Expr => ({ k: 'san', c, e: { k: 'val', S, e: { k: 'src', n } } }));
/** A value that fits a hole of context c: mostly sanitized input, for res a literal address. */
const FIT: Record<Ctx, fc.Arbitrary<Expr>> = {
  html: arbSanFor('html'), text: arbSanFor('html'), url: arbSanFor('url'), script: arbSanFor('script'),
  res: fc.constantFrom('/a.js', 'https://cdn.example.com/x.js', 'app.js').map((s): Expr => ({ k: 'lit', s })),
};

const arbTplWith = (holeArb: fc.Arbitrary<Expr>): fc.Arbitrary<Expr> =>
  fc.oneof(fc.constantFrom(...TEMPLATES).map(t => [...t]), arbStatics).chain(statics => {
    const w = walk(statics);
    const ctxs: Ctx[] = 'error' in w ? Array<Ctx>(statics.length - 1).fill('html') : w.holes;
    return fc.tuple(...ctxs.map(c => fc.oneof({ weight: 3, arbitrary: FIT[c] }, { weight: 1, arbitrary: holeArb })))
      .map((holes): Expr => ({ k: 'tpl', statics, holes }));
  });

const arbExprBase = fc.constantFrom<San>('html', 'script', 'url').chain(arbExprFor);
/** Templates whose holes may hold any expression, including a one-level nested template. */
export const arbTpl: fc.Arbitrary<Expr> = arbTplWith(fc.oneof(arbExprBase, arbTplWith(arbExprBase)));
export const arbExpr: fc.Arbitrary<Expr> = fc.oneof({ weight: 3, arbitrary: arbExprBase }, { weight: 1, arbitrary: arbTpl });
export const arbProgram = fc.constantFrom(...CTXS).chain(c =>
  (c === 'html' ? arbExpr : arbExprFor(c === 'res' || c === 'text' ? 'html' : c)).map(e => ({ c, e })));
