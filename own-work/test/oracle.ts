// Browser model of ass:parse over parse5: executed = V(h), endsInHole = the data hole of a context.
// V is overestimated: without a JavaScript lexer, string literals outside the listed holes stay marked.
import { Parser, type DefaultTreeAdapterMap, type Token } from 'parse5';
import type { Ctx } from '../src/label.ts';
import { CODE_ELEMENTS, isTextAttr } from '../src/contexts.ts';
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
export function executed(doc: string, stringStarts: readonly number[] = []): boolean[] {
  const p = new Spy({ sourceCodeLocationInfo: true });
  p.tokenizer.write(doc, true);
  const v = Array<boolean>(doc.length).fill(false);
  const mark = (a: number, b: number, on: boolean): void => { for (let i = a; i < b; i++) v[i] = on; };
  for (const t of p.tags) {
    for (const a of t.attrs) {
      const loc = t.loc?.attrs?.[a.name];
      if (!loc) throw new Error(`oracle: no location for attribute ${a.name}`);
      const text = isTextAttr(a.name) && !CODE_ELEMENTS.includes(t.name);
      if (/^on/i.test(a.name) || a.name === 'srcdoc' || (!text && isDangerous(a.value))
        || (t.name === 'script' && /^(src|href|xlink:href)$/.test(a.name)) || (t.name === 'base' && a.name === 'href')
        || (t.name === 'object' && a.name === 'data') || (t.name === 'embed' && a.name === 'src')) {
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
      for (const start of stringStarts) {
        if (a < start && start <= b) mark(start, Math.min(jsStringEnd(doc, start), b), false);
      }
    }
  });
  return v;
}

const S = { DATA: 0, RCDATA: 1, SCRIPT_DATA: 3, RCDATA_LT: 8, RCDATA_END_OPEN: 9, RCDATA_END_NAME: 10, ATTR_DQ: 35, ATTR_SQ: 36, CHAR_REF: 71, AMBIGUOUS_AMP: 72 };
type Tokenizer = { state: number; returnState: number; lastStartTagName: string; currentAttr: { name: string; value: string }; currentToken: { tagName?: string } | null };

/** RCDATA end tag states over the tail parse5 left undecided; true iff the tail ends in RCDATA. */
function rcdataTail(prefix: string, name: string): boolean {
  const from = prefix.indexOf('</', Math.max(0, prefix.length - name.length - 1));
  if (from < 0) return false;
  let state: 'rcdata' | 'lt' | 'endOpen' | 'name' = 'rcdata';
  let buf = '';
  for (let j = from; j < prefix.length;) {
    const c = prefix[j] ?? '';
    switch (state) {
      case 'rcdata': state = c === '<' ? 'lt' : 'rcdata'; j++; break;
      case 'lt': if (c === '/') { state = 'endOpen'; j++; } else state = 'rcdata'; break;
      case 'endOpen': if (/[A-Za-z]/.test(c)) { state = 'name'; buf = ''; } else state = 'rcdata'; break;
      case 'name':
        if (/[A-Za-z]/.test(c)) { buf += c; j++; }
        else if (/[\t\n\f />]/.test(c) && buf.toLowerCase() === name) return false;
        else state = 'rcdata';
        break;
    }
  }
  return state === 'rcdata';
}

/** True iff prefix ends in the data hole of c; for script, stringStart is where the string begins. */
export function endsInHole(prefix: string, c: Ctx, stringStart?: number): boolean {
  const p = new Parser<DefaultTreeAdapterMap>();
  p.tokenizer.write(prefix, false);
  const t = p.tokenizer as unknown as Tokenizer;
  const foreign = (p as unknown as { currentNotInHTML: boolean }).currentNotInHTML;
  const charRef = t.state === S.CHAR_REF || t.state === S.AMBIGUOUS_AMP;
  const inAttr = t.state === S.ATTR_DQ || t.state === S.ATTR_SQ;
  const attr = t.currentAttr.name;
  const tag = t.currentToken?.tagName ?? '';
  switch (c) {
    case 'html':
      return !foreign && p.openElements.tmplCount === 0 && (t.state === S.DATA || (charRef && t.returnState === S.DATA));
    case 'script':
      return t.state === S.SCRIPT_DATA && stringStart !== undefined && jsStringEnd(prefix, stringStart) === prefix.length;
    case 'url': {
      const v = urlValue(t.currentAttr.value);
      return inAttr && !/^on/.test(attr) && attr !== 'srcdoc' && !isTextAttr(attr) && !CODE_ELEMENTS.includes(tag)
        && (v === '' || !DANGEROUS.some(d => v.startsWith(d) || d.startsWith(v)));
    }
    case 'res':
      return inAttr && tag === 'script' && attr === 'src';
    case 'text': {
      if (foreign) return false;
      if (t.state === S.RCDATA || (charRef && t.returnState === S.RCDATA)) return true;
      if (t.state === S.RCDATA_LT || t.state === S.RCDATA_END_OPEN || t.state === S.RCDATA_END_NAME) return rcdataTail(prefix, t.lastStartTagName);
      const inValue = inAttr || (charRef && (t.returnState === S.ATTR_DQ || t.returnState === S.ATTR_SQ));
      return inValue && isTextAttr(attr) && !CODE_ELEMENTS.includes(tag);
    }
  }
}

/** The p and q of def:inertnost. */
export const P: Record<Ctx, string[]> = {
  html: ['', '<p>', '<div><b>x</b> ', '<table><tr><td>', 'a &amp; b &', '<select><option>',
    '<script>init()</script><ul><li>'],
  script: ['<script>var x = "', "<script>var x = '", '<p>t</p><script>f("a", 1); var x = "pre '],
  url: ['<a href="', "<a href='", '<a href="https://example.com/', '<img src="/', '<form action="./x'],
  res: ['<script src="', "<script src='", '<script src="https://cdn.example.com/'],
  text: ['<title>', '<title>Hledání: ', '<textarea name="bio">', '<input value="', "<input value='", '<div title="',
    "<p class='a ", '<option value="', '<img alt="x ', '<span data-id="'],
};
export const Q: Record<Ctx, string[]> = {
  html: ['', '</p>', 'lt;', '">', "' onclick=f()>", '<img src=x>'],
  script: ['', '";</script>', "';</script>", 'x" + y;</script>'],
  url: ['', '">x</a>', "'>x</a>", 'script:alert(1)">', ':alert(1)">', 'javascript:alert(1)">'],
  res: ['', '"></script>', "'></script>"],
  text: ['', '">', "'>", '</title>', '</textarea><script>x</script>', '"><p>', ' x'],
};

export const stringStartOf = (p: string): number => Math.max(p.lastIndexOf('"'), p.lastIndexOf("'")) + 1;

/** def:inertnost over every p in P[c] and q in Q[c]; `strings` are the script string holes of m. */
export function suitable(m: Marked, c: Ctx, strings: readonly number[] = m.strings ?? []): boolean {
  return P[c].every(p => {
    const start = c === 'script' ? stringStartOf(p) : undefined;
    if (!endsInHole(p + m.s, c, start)) return false;
    const starts = [...strings.map(s => s + p.length), ...(start === undefined ? [] : [start])];
    return Q[c].every(q => {
      const v = executed(p + m.s + q, starts);
      return m.u.every((att, j) => !att || !v[p.length + j]);
    });
  });
}

/** def:bezinjektaze is violated: the sink of c executes an attacker character of m. */
export function injected(c: Ctx, m: Marked): boolean {
  const [pre, post] = HOLE[c];
  const v = executed(pre + m.s + post, [...(m.strings ?? []).map(x => x + pre.length), ...(c === 'script' ? [pre.length] : [])]);
  return m.u.some((att, j) => att && v[pre.length + j]);
}
