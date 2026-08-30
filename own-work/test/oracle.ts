// Browser model of ass:parse on top of the HTML5 parser parse5.
//   executed     V_c(h): script bodies, on* handlers, srcdoc, javascript:/vbscript:/data: attribute
//                values, src/href of script and href of base. For context script the content of the
//                string literal at the data hole does not count.
//   endsInHole   whether a prefix ends in the data hole of context c (tokenizer state).
import { Parser, type DefaultTreeAdapterMap, type Token } from 'parse5';
import type { Ctx } from '../src/label.ts';
import { HOLE } from '../src/index.ts';
import type { Marked } from './model.ts';

type Node = DefaultTreeAdapterMap['node'];
type Tag = { name: string; attrs: Token.Attribute[]; loc: Token.LocationWithAttributes | null };

const DANGEROUS = ['javascript:', 'vbscript:', 'data:'];
const urlValue = (v: string): string => v.replace(/[\t\n\r]/g, '').replace(/^[\x00-\x20]+/, '').toLowerCase();
const isDangerous = (v: string): boolean => DANGEROUS.some(d => urlValue(v).startsWith(d));

class Spy extends Parser<DefaultTreeAdapterMap> {
  tags: Tag[] = [];
  override onStartTag(t: Token.TagToken): void {
    this.tags.push({ name: t.tagName, attrs: t.attrs.map(a => ({ ...a })), loc: t.location });
    super.onStartTag(t);
  }
}

function walk(n: Node, f: (n: Node) => void): void {
  f(n);
  if ('childNodes' in n) for (const c of n.childNodes) walk(c, f);
  if ('content' in n) walk(n.content, f);
}

/** End of the JS string literal opened right before `start`. */
function jsStringEnd(doc: string, start: number): number {
  const quote = doc[start - 1];
  let j = start;
  for (;;) {
    const c = doc[j];
    if (c === undefined || c === quote || c === '\n' || c === '\r') return j;
    j += c === '\\' ? (doc.startsWith('\r\n', j + 1) ? 3 : 2) : 1;
  }
}

/** V(doc): for every position, whether the browser executes it. */
export function executed(doc: string, stringStart?: number): boolean[] {
  const p = new Spy({ sourceCodeLocationInfo: true });
  p.tokenizer.write(doc, true);
  const v = Array<boolean>(doc.length).fill(false);
  const mark = (a: number, b: number, on: boolean): void => { for (let i = a; i < b; i++) v[i] = on; };
  for (const t of p.tags) {
    for (const a of t.attrs) {
      const loc = t.loc?.attrs?.[a.name];
      if (!loc) throw new Error(`oracle: no location for attribute ${a.name}`);
      if (/^on/i.test(a.name) || a.name === 'srcdoc' || isDangerous(a.value)
        || (t.name === 'script' && /^(src|href|xlink:href)$/.test(a.name)) || (t.name === 'base' && a.name === 'href')) {
        mark(loc.startOffset, loc.endOffset, true);
      }
    }
  }
  walk(p.document, n => {
    if (n.nodeName !== 'script' || !('childNodes' in n)) return;
    for (const t of n.childNodes) {
      if (t.nodeName !== '#text' || !t.sourceCodeLocation) continue;
      const { startOffset: a, endOffset: b } = t.sourceCodeLocation;
      mark(a, b, true);
      if (stringStart !== undefined && a < stringStart && stringStart <= b) {
        mark(stringStart, Math.min(jsStringEnd(doc, stringStart), b), false);
      }
    }
  });
  return v;
}

const S = { DATA: 0, SCRIPT_DATA: 3, ATTR_DQ: 35, ATTR_SQ: 36, CHAR_REF: 71, AMBIGUOUS_AMP: 72 };

/** True iff prefix ends in the data hole of c; for script, stringStart is where the string begins. */
export function endsInHole(prefix: string, c: Ctx, stringStart?: number): boolean {
  const p = new Parser<DefaultTreeAdapterMap>();
  p.tokenizer.write(prefix, false);
  const t = p.tokenizer as unknown as { state: number; returnState: number; currentAttr: { value: string } };
  const inAttr = t.state === S.ATTR_DQ || t.state === S.ATTR_SQ;
  switch (c) {
    case 'html': {
      const foreign = (p as unknown as { currentNotInHTML: boolean }).currentNotInHTML;
      const charRef = (t.state === S.CHAR_REF || t.state === S.AMBIGUOUS_AMP) && t.returnState === S.DATA;
      return !foreign && p.openElements.tmplCount === 0 && (t.state === S.DATA || charRef);
    }
    case 'script':
      return t.state === S.SCRIPT_DATA && stringStart !== undefined && jsStringEnd(prefix, stringStart) === prefix.length;
    case 'url': {
      const v = urlValue(t.currentAttr.value);
      return inAttr && (v === '' || !DANGEROUS.some(d => v.startsWith(d) || d.startsWith(v)));
    }
    case 'res':
      return inAttr;
  }
}

/** The p and q of def:inertnost. */
export const P: Record<Ctx, string[]> = {
  html: ['', '<p>', '<div><b>x</b> ', '<table><tr><td>', 'a &amp; b &', '<select><option>',
    '<script>init()</script><ul><li>'],
  script: ['<script>var x = "', "<script>var x = '", '<p>t</p><script>f("a", 1); var x = "pre '],
  url: ['<a href="', "<a href='", '<a href="https://example.com/', '<img src="/', '<form action="./x'],
  res: ['<script src="', "<script src='", '<script src="https://cdn.example.com/'],
};
export const Q: Record<Ctx, string[]> = {
  html: ['', '</p>', 'lt;', '">', "' onclick=f()>", '<img src=x>'],
  script: ['', '";</script>', "';</script>", 'x" + y;</script>'],
  url: ['', '">x</a>', "'>x</a>", 'script:alert(1)">', ':alert(1)">'],
  res: ['', '"></script>', "'></script>"],
};

export const stringStartOf = (p: string): number => Math.max(p.lastIndexOf('"'), p.lastIndexOf("'")) + 1;

/** def:inertnost (P1 and P2) checked for every p in P[c] and q in Q[c]. */
export function suitable(m: Marked, c: Ctx): boolean {
  return P[c].every(p => {
    const start = c === 'script' ? stringStartOf(p) : undefined;
    if (!endsInHole(p + m.s, c, start)) return false;
    return Q[c].every(q => {
      const v = executed(p + m.s + q, start);
      return m.u.every((att, j) => !att || !v[p.length + j]);
    });
  });
}

/** def:bezinjektaze is violated: the sink of c executes an attacker character of m. */
export function injected(c: Ctx, m: Marked): boolean {
  const [pre, post] = HOLE[c];
  const v = executed(pre + m.s + post, c === 'script' ? pre.length : undefined);
  return m.u.some((att, j) => att && v[pre.length + j]);
}
