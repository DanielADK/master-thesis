// T-Tpl (sec:lib-tpl): a scanner over the static parts gives each hole its context; a rejection is a
// sentence in the parameter type.
import type { Ctx, CtxsOf, Level, Prov, Str } from './label.ts';
import type { CodeElement, IsLit, TextAttr, Url } from './contexts.ts';
import { CODE_ELEMENTS, isTextAttr, urlNeutral } from './contexts.ts';

export const MSG = {
  plain: 'a plain string is not allowed here: validate and escape it',
  part: 'only single literals and labeled values are allowed',
  tag: 'a hole inside a tag is not allowed',
  handler: 'a hole in an event handler is never allowed',
  scriptSrc: 'script src must be a whole value',
  scriptCode: 'a hole in script code is only allowed inside a string literal',
  textOnly: 'this hole reads text only; a template or html value is not allowed here',
  quoted: 'attribute values must be quoted',
  decl: 'comments and declarations other than <!doctype html> are not supported',
  scriptChar: 'script code must not contain <, /, `, \\ or --> outside a string literal',
  scriptString: 'a script string must not contain \\, < or a line break',
  end: 'the template must end in element content',
  tagOpen: 'text after < is not a tag',
  tagName: 'malformed tag name',
  endTag: 'malformed end tag',
  attr: 'malformed attribute',
  attrName: 'malformed attribute name',
  afterValue: 'malformed tag after attribute value',
  self: 'malformed self-closing tag',
  endTagOpen: 'unterminated end tag',
} as const;
type Msg = typeof MSG;

type Lower = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h' | 'i' | 'j' | 'k' | 'l' | 'm'
  | 'n' | 'o' | 'p' | 'q' | 'r' | 's' | 't' | 'u' | 'v' | 'w' | 'x' | 'y' | 'z';
type Alpha = Lower | Uppercase<Lower>;
type Digit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9';
type WS = ' ' | '\t' | '\n' | '\r' | '\f';
type RawText = 'style' | 'textarea' | 'title' | 'xmp' | 'iframe' | 'noembed' | 'noframes' | 'noscript';
type NoHole = 'svg' | 'math' | 'plaintext' | 'template';

// Tokenizer states; a hole fits Data, Raw of title/textarea, Val and a Script string.
type Data = { k: 'data' };
type Open = { k: 'open' };
type End = { k: 'end' };
type Name<N extends string> = { k: 'name'; n: N };
type Before<N extends string> = { k: 'before'; n: N };
type Attr<N extends string, A extends string> = { k: 'attr'; n: N; a: A };
type After<N extends string, A extends string> = { k: 'after'; n: N; a: A };
type BeforeVal<N extends string, A extends string> = { k: 'beforeVal'; n: N; a: A };
/** Inside a quoted value; Piece is the static text since the last hole. */
type Val<N extends string, A extends string, Q extends string, Piece extends string> = { k: 'val'; n: N; a: A; q: Q; piece: Piece };
type AfterVal<N extends string> = { k: 'afterVal'; n: N };
type Self<N extends string> = { k: 'self'; n: N };
type Raw<N extends string> = { k: 'raw'; n: N };
/** Inside a script; Q is the open string quote or '' outside strings. */
type Script<Q extends string> = { k: 'script'; q: Q };
type Bad<M extends string> = { k: 'bad'; m: M };

type Opened<N extends string> = Lowercase<N> extends NoHole ? Bad<`<${Lowercase<N>}> is not supported`>
  : Lowercase<N> extends 'script' ? Script<''>
  : Lowercase<N> extends RawText ? Raw<Lowercase<N>>
  : Data;

/** Scans S from state St; tail recursive. */
type Run<S extends string, St> =
  St extends Bad<string> ? St
  : S extends '' ? St
  : St extends Data ? (S extends `${string}<${infer R}` ? Run<R, Open> : Data)
  : St extends Open ? (S extends `/${infer R}` ? Run<R, End>
    : S extends `!${infer W}>${infer U}` ? (Lowercase<W> extends 'doctype html' ? Run<U, Data> : Bad<Msg['decl']>)
    : S extends `!${string}` ? Bad<Msg['decl']>
    : S extends `${infer C}${infer R}` ? (C extends Alpha ? Run<R, Name<C>> : Bad<Msg['tagOpen']>) : never)
  : St extends End ? (S extends `${infer C}${infer R}`
    ? (C extends Alpha | Digit | '-' ? Run<R, End> : C extends '>' ? Run<R, Data> : Bad<Msg['endTag']>) : never)
  : St extends Name<infer N> ? (S extends `${infer C}${infer R}`
    ? C extends Alpha | Digit | '-' ? Run<R, Name<`${N}${C}`>>
    : C extends WS ? Run<R, Before<N>>
    : C extends '/' ? Run<R, Self<N>>
    : C extends '>' ? Run<R, Opened<N>>
    : Bad<Msg['tagName']> : never)
  : St extends Before<infer N> ? (S extends `${infer C}${infer R}`
    ? C extends WS ? Run<R, Before<N>>
    : C extends '/' ? Run<R, Self<N>>
    : C extends '>' ? Run<R, Opened<N>>
    : C extends Alpha ? Run<R, Attr<N, C>>
    : Bad<Msg['attr']> : never)
  : St extends Attr<infer N, infer A> ? (S extends `${infer C}${infer R}`
    ? C extends Alpha | Digit | '-' | '_' | ':' | '.' ? Run<R, Attr<N, `${A}${C}`>>
    : C extends WS ? Run<R, After<N, A>>
    : C extends '=' ? Run<R, BeforeVal<N, A>>
    : C extends '/' ? Run<R, Self<N>>
    : C extends '>' ? Run<R, Opened<N>>
    : Bad<Msg['attrName']> : never)
  : St extends After<infer N, infer A> ? (S extends `${infer C}${infer R}`
    ? C extends WS ? Run<R, After<N, A>>
    : C extends '=' ? Run<R, BeforeVal<N, A>>
    : C extends '/' ? Run<R, Self<N>>
    : C extends '>' ? Run<R, Opened<N>>
    : C extends Alpha ? Run<R, Attr<N, C>>
    : Bad<Msg['attr']> : never)
  : St extends BeforeVal<infer N, infer A> ? (S extends `${infer C}${infer R}`
    ? C extends WS ? Run<R, BeforeVal<N, A>>
    : C extends '"' | "'" ? Run<R, Val<N, A, C, ''>>
    : Bad<Msg['quoted']> : never)
  : St extends Val<infer N, infer A, infer Q, infer Piece> ? (S extends `${string}${Q}${infer R}`
    ? Run<R, AfterVal<N>> : Val<N, A, Q, `${Piece}${S}`>)
  : St extends AfterVal<infer N> ? (S extends `${infer C}${infer R}`
    ? C extends WS ? Run<R, Before<N>>
    : C extends '/' ? Run<R, Self<N>>
    : C extends '>' ? Run<R, Opened<N>>
    : Bad<Msg['afterValue']> : never)
  : St extends Self<infer N> ? (S extends `>${infer R}` ? Run<R, Opened<N>> : Bad<Msg['self']>)
  : St extends Raw<infer N> ? (S extends `${infer B}</${infer T}`
    ? B extends `${string}<${string}` ? Bad<`< inside <${N}>`>
    : T extends `${infer M}>${infer U}` ? (Lowercase<M> extends N ? Run<U, Data> : Bad<`wrong end tag inside <${N}>`>)
    : Bad<Msg['endTagOpen']>
    : S extends `${string}<${string}` ? Bad<`< inside <${N}>`> : Raw<N>)
  : St extends Script<infer Q> ? ScriptRun<S, Q>
  : never;

// Script code: strings exactly; <, /, ` and \ are banned outside them.
type ScriptRun<S extends string, Q extends string> =
  S extends '' ? Script<Q>
  : Q extends '' ? (S extends `</script>${infer R}` ? Run<R, Data>
    : S extends `-->${string}` ? Bad<Msg['scriptChar']>
    : S extends `${infer C}${infer R}`
      ? C extends '"' | "'" ? ScriptRun<R, C>
      : C extends '<' | '/' | '`' | '\\' ? Bad<Msg['scriptChar']>
      : ScriptRun<R, ''>
      : never)
  : S extends `${infer C}${infer R}`
    ? C extends Q ? ScriptRun<R, ''>
    : C extends '\\' | '<' | '\n' | '\r' | ' ' | ' ' ? Bad<Msg['scriptString']>
    : ScriptRun<R, Q>
    : never;

/** Context of a hole in a quoted attribute value (names in lower case), or Bad. */
type HoleInValue<N extends string, A extends string, Piece extends string> =
  A extends `on${string}` ? Bad<Msg['handler']>
  : A extends 'srcdoc' | 'style' ? Bad<`a hole in ${A} is not supported`>
  : [N, A] extends ['script', 'src'] ? (Piece extends '' ? 'res' : Bad<Msg['scriptSrc']>)
  : N extends CodeElement ? Bad<`a hole in an attribute of <${N}> is not allowed`>
  : A extends TextAttr ? 'text'
  : Url<Piece> extends true ? 'url' : Bad<`the text "${Piece}" before the hole could start a dangerous scheme`>;

/** Context of a hole in state St, or Bad with the sentence. */
type Hole<St> = St extends Data ? 'html'
  : St extends Raw<infer N> ? (N extends 'title' | 'textarea' ? 'text' : Bad<`a hole inside <${N}> is not supported`>)
  : St extends Val<infer N, infer A, string, infer Piece> ? HoleInValue<Lowercase<N>, Lowercase<A>, Piece>
  : St extends Script<infer Q> ? (Q extends '' ? Bad<Msg['scriptCode']> : 'script')
  : St extends Bad<string> ? St
  : Bad<Msg['tag']>;

/** State after a hole: unchanged (P2); only the static piece restarts. */
type AfterHole<St> = St extends Val<infer N, infer A, infer Q, string> ? Val<N, A, Q, ''> : St;

export type Labeled = Str<Level, never>;
export type Part = string | Labeled | readonly Labeled[];
type Elem<X> = X extends readonly (infer E)[] ? E : X;
type IsUnion<T, U = T> = T extends unknown ? ([U] extends [T] ? false : true) : never;
type Lit<S extends string> = false extends IsLit<S> ? false : true extends IsUnion<S> ? false : true;

type Need<C extends Ctx, X> = [C] extends [CtxsOf<Elem<X>>] ? X
  : [CtxsOf<Elem<X>>] extends [never] ? `this hole needs a value safe for ${C}; the value is validated but not escaped`
  : C extends 'text' ? ('html' extends CtxsOf<Elem<X>> ? Msg['textOnly'] : `this hole needs a value safe for ${C}; the value is escaped for a different context`)
  : `this hole needs a value safe for ${C}; the value is escaped for a different context`;

/** Walks the parts; a bad position becomes its sentence. */
type Walk<P extends readonly unknown[], St, Out extends readonly unknown[]> =
  P extends readonly [infer X, ...infer R]
    ? [X] extends [Labeled | readonly Labeled[]]
      ? Hole<St> extends infer C
        ? C extends Ctx ? Walk<R, AfterHole<St>, [...Out, Need<C, X>]>
        : C extends Bad<infer M> ? [...Out, M, ...R]
        : never
        : never
      : [X] extends [string]
        ? Lit<X & string> extends true
          ? Run<X & string, St> extends infer St2
            ? St2 extends Bad<infer M> ? [...Out, M, ...R] : Walk<R, St2, [...Out, X]>
            : never
          : [...Out, true extends IsUnion<X> ? Msg['part'] : Msg['plain'], ...R]
        : [...Out, Msg['part'], ...R]
    : St extends Data ? Out
    : Out extends readonly [...infer Init, unknown] ? [...Init, Msg['end']] : [Msg['end']];

/** P when accepted, else P with a sentence at the bad position. */
export type Check<P extends readonly unknown[]> = Walk<P, Data, []>;

type ProvOfParts<P extends readonly unknown[]> = 'lit' | (Elem<P[number]> extends infer X ? (X extends Prov<infer I> ? I : never) : never);

/**
 * T-Tpl: each hole needs a value of its context, the result is html.
 * Example: `html('<a href="', escapeUrl(x), '">', escapeHtml(x), '</a>')`. Run time: concatenation.
 */
export function html<const P extends readonly Part[]>(
  ...parts: P extends Walk<P, Data, []> ? P : Walk<P, Data, []>
): Str<ProvOfParts<P>, 'html'> {
  const out = (parts as unknown as readonly Part[]).map(p => (typeof p === 'string' ? p : p.join(''))).join('');
  return out as unknown as Str<ProvOfParts<P>, 'html'>;
}

// ---- the same scanner at run time ----

export type Walked = { holes: Ctx[]; strings: ({ part: number; offset: number } | undefined)[] } | { error: string };

type State =
  | { k: 'data' | 'open' | 'end' }
  | { k: 'name' | 'before' | 'afterVal' | 'self' | 'raw'; n: string }
  | { k: 'attr' | 'after' | 'beforeVal'; n: string; a: string }
  | { k: 'val'; n: string; a: string; q: string; piece: string }
  | { k: 'script'; q: string; part: number; offset: number }
  | { k: 'bad'; m: string };

const DATA: State = { k: 'data' };
const bad = (m: string): State => ({ k: 'bad', m });
const ALPHA = /^[A-Za-z]$/;
const NAME = /^[A-Za-z0-9-]$/;
const ATTR_CHAR = /^[A-Za-z0-9_:.-]$/;
const SPACE = /^[ \t\n\r\f]$/;
const RAW_TEXT: readonly string[] = ['style', 'textarea', 'title', 'xmp', 'iframe', 'noembed', 'noframes', 'noscript'];
const NO_HOLE: readonly string[] = ['svg', 'math', 'plaintext', 'template'];

function opened(name: string): State {
  const n = name.toLowerCase();
  if (NO_HOLE.includes(n)) return bad(`<${n}> is not supported`);
  if (n === 'script') return { k: 'script', q: '', part: 0, offset: 0 };
  if (RAW_TEXT.includes(n)) return { k: 'raw', n };
  return DATA;
}

/** Run<S, St> at run time. */
function run(st: State, s: string, part: number): State {
  let i = 0;
  while (i < s.length) {
    const c = s[i] ?? '';
    switch (st.k) {
      case 'bad': return st;
      case 'data': {
        const lt = s.indexOf('<', i);
        if (lt < 0) return st;
        i = lt + 1;
        st = { k: 'open' };
        break;
      }
      case 'open':
        if (c === '/') { st = { k: 'end' }; i++; }
        else if (c === '!') {
          const gt = s.indexOf('>', i);
          if (gt < 0 || s.slice(i + 1, gt).toLowerCase() !== 'doctype html') return bad(MSG.decl);
          i = gt + 1;
          st = DATA;
        }
        else if (ALPHA.test(c)) { st = { k: 'name', n: c }; i++; }
        else return bad(MSG.tagOpen);
        break;
      case 'end':
        if (NAME.test(c)) i++;
        else if (c === '>') { st = DATA; i++; }
        else return bad(MSG.endTag);
        break;
      case 'name':
        if (NAME.test(c)) st = { k: 'name', n: st.n + c };
        else if (SPACE.test(c)) st = { k: 'before', n: st.n };
        else if (c === '/') st = { k: 'self', n: st.n };
        else if (c === '>') st = opened(st.n);
        else return bad(MSG.tagName);
        i++;
        break;
      case 'before':
        if (SPACE.test(c)) i++;
        else if (c === '/') { st = { k: 'self', n: st.n }; i++; }
        else if (c === '>') { st = opened(st.n); i++; }
        else if (ALPHA.test(c)) { st = { k: 'attr', n: st.n, a: c }; i++; }
        else return bad(MSG.attr);
        break;
      case 'attr':
        if (ATTR_CHAR.test(c)) st = { k: 'attr', n: st.n, a: st.a + c };
        else if (SPACE.test(c)) st = { k: 'after', n: st.n, a: st.a };
        else if (c === '=') st = { k: 'beforeVal', n: st.n, a: st.a };
        else if (c === '/') st = { k: 'self', n: st.n };
        else if (c === '>') st = opened(st.n);
        else return bad(MSG.attrName);
        i++;
        break;
      case 'after':
        if (SPACE.test(c)) i++;
        else if (c === '=') { st = { k: 'beforeVal', n: st.n, a: st.a }; i++; }
        else if (c === '/') { st = { k: 'self', n: st.n }; i++; }
        else if (c === '>') { st = opened(st.n); i++; }
        else if (ALPHA.test(c)) { st = { k: 'attr', n: st.n, a: c }; i++; }
        else return bad(MSG.attr);
        break;
      case 'beforeVal':
        if (SPACE.test(c)) i++;
        else if (c === '"' || c === "'") { st = { k: 'val', n: st.n, a: st.a, q: c, piece: '' }; i++; }
        else return bad(MSG.quoted);
        break;
      case 'val': {
        const end = s.indexOf(st.q, i);
        if (end < 0) return { ...st, piece: st.piece + s.slice(i) };
        i = end + 1;
        st = { k: 'afterVal', n: st.n };
        break;
      }
      case 'afterVal':
        if (SPACE.test(c)) st = { k: 'before', n: st.n };
        else if (c === '/') st = { k: 'self', n: st.n };
        else if (c === '>') st = opened(st.n);
        else return bad(MSG.afterValue);
        i++;
        break;
      case 'self':
        if (c !== '>') return bad(MSG.self);
        st = opened(st.n);
        i++;
        break;
      case 'raw': {
        const close = s.indexOf('</', i);
        if (close < 0) return s.includes('<', i) ? bad(`< inside <${st.n}>`) : st;
        if (s.slice(i, close).includes('<')) return bad(`< inside <${st.n}>`);
        const gt = s.indexOf('>', close + 2);
        if (gt < 0) return bad(MSG.endTagOpen);
        if (s.slice(close + 2, gt).toLowerCase() !== st.n) return bad(`wrong end tag inside <${st.n}>`);
        i = gt + 1;
        st = DATA;
        break;
      }
      case 'script':
        if (st.q === '') {
          if (s.startsWith('</script>', i)) { i += 9; st = DATA; }
          else if (s.startsWith('-->', i) || c === '<' || c === '/' || c === '`' || c === '\\') return bad(MSG.scriptChar);
          else if (c === '"' || c === "'") { st = { k: 'script', q: c, part, offset: i + 1 }; i++; }
          else i++;
        } else if (c === st.q) { st = { k: 'script', q: '', part: 0, offset: 0 }; i++; }
        else if (c === '\\' || c === '<' || c === '\n' || c === '\r' || c === ' ' || c === ' ') return bad(MSG.scriptString);
        else i++;
        break;
    }
  }
  return st;
}

/** Hole<St> at run time. */
function hole(st: State): Ctx | { m: string } {
  switch (st.k) {
    case 'data': return 'html';
    case 'raw': return st.n === 'title' || st.n === 'textarea' ? 'text' : { m: `a hole inside <${st.n}> is not supported` };
    case 'val': {
      const n = st.n.toLowerCase();
      const a = st.a.toLowerCase();
      if (a.startsWith('on')) return { m: MSG.handler };
      if (a === 'srcdoc' || a === 'style') return { m: `a hole in ${a} is not supported` };
      if (n === 'script' && a === 'src') return st.piece === '' ? 'res' : { m: MSG.scriptSrc };
      if (CODE_ELEMENTS.includes(n)) return { m: `a hole in an attribute of <${n}> is not allowed` };
      if (isTextAttr(a)) return 'text';
      return urlNeutral(st.piece) ? 'url' : { m: `the text "${st.piece}" before the hole could start a dangerous scheme` };
    }
    case 'script': return st.q === '' ? { m: MSG.scriptCode } : 'script';
    case 'bad': return { m: st.m };
    default: return { m: MSG.tag };
  }
}

/** Walk at run time; hole k lies between statics[k] and statics[k + 1]. */
export function walk(statics: readonly string[]): Walked {
  let st: State = DATA;
  const holes: Ctx[] = [];
  const strings: ({ part: number; offset: number } | undefined)[] = [];
  for (let k = 0; k < statics.length; k++) {
    st = run(st, statics[k] ?? '', k);
    if (st.k === 'bad') return { error: st.m };
    if (k === statics.length - 1) break;
    const h = hole(st);
    if (typeof h !== 'string') return { error: h.m };
    holes.push(h);
    strings.push(st.k === 'script' ? { part: st.part, offset: st.offset } : undefined);
    if (st.k === 'val') st = { ...st, piece: '' };
  }
  return st.k === 'data' ? { holes, strings } : { error: MSG.end };
}
