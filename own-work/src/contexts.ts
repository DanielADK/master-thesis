// ctx(s) of literals (T-Lit) and D(S) of schemas (T-Val), each as a type for tsc and as a
// runtime function.
// Both may grant fewer contexts than def:inertnost allows, never more.
import { CTXS, type Ctx } from './label.ts';

// Character classes of the HTML tokenizer.
type Lower = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h' | 'i' | 'j' | 'k' | 'l' | 'm'
  | 'n' | 'o' | 'p' | 'q' | 'r' | 's' | 't' | 'u' | 'v' | 'w' | 'x' | 'y' | 'z';
type Alpha = Lower | Uppercase<Lower>;
type Digit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9';
type WS = ' ' | '\t' | '\n' | '\r' | '\f';
type C0 = '\x00' | '\x01' | '\x02' | '\x03' | '\x04' | '\x05' | '\x06' | '\x07' | '\x08' | '\x09'
  | '\x0a' | '\x0b' | '\x0c' | '\x0d' | '\x0e' | '\x0f' | '\x10' | '\x11' | '\x12' | '\x13' | '\x14'
  | '\x15' | '\x16' | '\x17' | '\x18' | '\x19' | '\x1a' | '\x1b' | '\x1c' | '\x1d' | '\x1e' | '\x1f' | ' ';

// Raw text elements, and elements with no data hole inside.
type RawText = 'script' | 'style' | 'textarea' | 'title' | 'xmp' | 'iframe' | 'noembed' | 'noframes' | 'noscript';
type NoHole = 'svg' | 'math' | 'plaintext' | 'template';
const RAW_TEXT: readonly string[] = ['script', 'style', 'textarea', 'title', 'xmp', 'iframe', 'noembed', 'noframes', 'noscript'];
const NO_HOLE: readonly string[] = ['svg', 'math', 'plaintext', 'template'];

// html: S read from the data state ends in the data state.
type Html<S> = S extends `${string}<${infer R}` ? TagOpen<R> : true;
type TagOpen<R> = R extends `/${infer T}` ? EndTag<T>
  : R extends `${infer C}${infer T}` ? (C extends Alpha ? TagName<T, C> : false) : false;
type EndTag<R> = R extends `${infer C}${infer T}` ? (C extends Alpha ? EndTagName<T> : false) : false;
type EndTagName<R> = R extends `${infer C}${infer T}`
  ? C extends Alpha | Digit | '-' ? EndTagName<T> : C extends '>' ? Html<T> : false
  : false;
type TagName<R, N extends string> = R extends `${infer C}${infer T}`
  ? C extends Alpha | Digit | '-' ? TagName<T, `${N}${C}`>
  : C extends WS ? BeforeAttr<T, N>
  : C extends '/' ? SelfClosing<T, N>
  : C extends '>' ? Open<T, Lowercase<N>>
  : false
  : false;
type BeforeAttr<R, N extends string> = R extends `${infer C}${infer T}`
  ? C extends WS ? BeforeAttr<T, N>
  : C extends '/' ? SelfClosing<T, N>
  : C extends '>' ? Open<T, Lowercase<N>>
  : C extends Alpha ? AttrName<T, N>
  : false
  : false;
type AttrName<R, N extends string> = R extends `${infer C}${infer T}`
  ? C extends Alpha | Digit | '-' | '_' | ':' | '.' ? AttrName<T, N>
  : C extends WS ? AfterAttrName<T, N>
  : C extends '=' ? BeforeValue<T, N>
  : C extends '/' ? SelfClosing<T, N>
  : C extends '>' ? Open<T, Lowercase<N>>
  : false
  : false;
type AfterAttrName<R, N extends string> = R extends `${infer C}${infer T}`
  ? C extends WS ? AfterAttrName<T, N>
  : C extends '=' ? BeforeValue<T, N>
  : C extends '/' ? SelfClosing<T, N>
  : C extends '>' ? Open<T, Lowercase<N>>
  : C extends Alpha ? AttrName<T, N>
  : false
  : false;
type BeforeValue<R, N extends string> = R extends `${infer C}${infer T}`
  ? C extends WS ? BeforeValue<T, N>
  : C extends '"' ? (T extends `${string}"${infer U}` ? AfterValue<U, N> : false)
  : C extends "'" ? (T extends `${string}'${infer U}` ? AfterValue<U, N> : false)
  : false
  : false;
type AfterValue<R, N extends string> = R extends `${infer C}${infer T}`
  ? C extends WS ? BeforeAttr<T, N>
  : C extends '/' ? SelfClosing<T, N>
  : C extends '>' ? Open<T, Lowercase<N>>
  : false
  : false;
type SelfClosing<R, N extends string> = R extends `>${infer T}` ? Open<T, Lowercase<N>> : false;
// Raw text content must not contain '<' and must end with exactly </name>.
type Open<R, N extends string> = N extends NoHole ? false
  : N extends RawText
    ? R extends `${infer B}</${infer T}`
      ? B extends `${string}<${string}` ? false
      : T extends `${infer M}>${infer U}` ? (Lowercase<M> extends N ? Html<U> : false) : false
    : false
  : Html<R>;

// script: S stays inside a string literal.
type ScriptBad = '"' | "'" | '`' | '\\' | '<' | '\n' | '\r' | '\u2028' | '\u2029';
type Script<S> = S extends `${string}${ScriptBad}${string}` ? false : true;

// url: no dangerous scheme, even after the URL parser drops C0, TAB, LF and CR.
type ResBad = '"' | "'" | '`' | '\\' | '<' | '>' | '&';
type UrlBad = ResBad | '\t' | '\n' | '\r';
type Dangerous = 'javascript:' | 'vbscript:' | 'data:';
type PrefixOf<P extends string, D> = D extends `${P}${string}` ? true : never;
type Url<S extends string> = S extends '' ? true
  : S extends `${string}${UrlBad}${string}` | `${C0}${string}` ? false
  : Lowercase<S> extends `${Dangerous}${string}` ? false
  : [PrefixOf<Lowercase<S>, Dangerous>] extends [never] ? true : false;

// res: S stays inside the quoted src attribute of a script element.
type Res<S> = S extends `${string}${ResBad}${string}` ? false : true;

/** true for a literal type, false for string and patterns. */
export type IsLit<S extends string> = S extends unknown ? ({} extends Record<S, 1> ? false : true) : never;
type Finite<S extends string> = false extends IsLit<S> ? false : true;

/** ctx(s) of def:prameny; a union gets the common contexts. */
export type CtxOf<S extends string> = Finite<S> extends false ? never
  : | ([Html<S>] extends [true] ? 'html' : never)
    | ([Script<S>] extends [true] ? 'script' : never)
    | ([Url<S>] extends [true] ? 'url' : never)
    | ([Res<S>] extends [true] ? 'res' : never);

/** D(S) of def:prameny from the schema output type; never res. */
export type D<O extends string> = Finite<O> extends false ? never
  : | ([NoLt<O>] extends [true] ? 'html' : never)
    | ([Script<O>] extends [true] ? 'script' : never)
    | ([Url<O>] extends [true] ? 'url' : never);
type NoLt<S> = S extends `${string}<${string}` ? false : true;

// Runtime versions of the types above.
const ALPHA = /^[a-zA-Z]$/;
const NAME = /^[a-zA-Z0-9-]$/;
const ATTR = /^[a-zA-Z0-9_:.-]$/;
const SPACE = /^[ \t\n\r\f]$/;
const SCRIPT_BAD = /["'`\\<\n\r\u2028\u2029]/;
const RES_BAD = /["'`\\<>&]/;
const URL_BAD = /["'`\\<>&\t\n\r]|^[\x00-\x20]/;
const DANGEROUS = ['javascript:', 'vbscript:', 'data:'];

type TagState = 'name' | 'before' | 'attr' | 'after' | 'value' | 'afterValue' | 'self';

// One step inside a start tag (the types TagName to SelfClosing).
function step(st: TagState, c: string): TagState | 'close' | 'quote' | undefined {
  const ws = SPACE.test(c);
  switch (st) {
    case 'name': return NAME.test(c) ? 'name' : ws ? 'before' : c === '/' ? 'self' : c === '>' ? 'close' : undefined;
    case 'before': return ws ? 'before' : c === '/' ? 'self' : c === '>' ? 'close' : ALPHA.test(c) ? 'attr' : undefined;
    case 'attr': return ATTR.test(c) ? 'attr' : ws ? 'after' : c === '=' ? 'value' : c === '/' ? 'self' : c === '>' ? 'close' : undefined;
    case 'after': return ws ? 'after' : c === '=' ? 'value' : c === '/' ? 'self' : c === '>' ? 'close' : ALPHA.test(c) ? 'attr' : undefined;
    case 'value': return ws ? 'value' : c === '"' || c === "'" ? 'quote' : undefined;
    case 'afterValue': return ws ? 'before' : c === '/' ? 'self' : c === '>' ? 'close' : undefined;
    case 'self': return c === '>' ? 'close' : undefined;
  }
}

/** Html<S> at run time. */
export function htmlNeutral(s: string): boolean {
  let i = 0;
  for (;;) {
    const lt = s.indexOf('<', i);
    if (lt < 0) return true;
    i = lt + 1;
    if (s[i] === '/') {
      if (!ALPHA.test(s[++i] ?? '')) return false;
      while (NAME.test(s[++i] ?? ''));
      if (s[i] !== '>') return false;
      i++;
      continue;
    }
    if (!ALPHA.test(s[i] ?? '')) return false;
    let name = s[i++] ?? '';
    for (let st: TagState = 'name'; ; i++) {
      const c = s[i];
      if (c === undefined) return false;
      const next = step(st, c);
      if (next === undefined) return false;
      if (next === 'close') break;
      if (next === 'quote') {
        i = s.indexOf(c, i + 1);
        if (i < 0) return false;
        st = 'afterValue';
      } else {
        if (st === 'name' && next === 'name') name += c;
        st = next;
      }
    }
    i++;
    const n = name.toLowerCase();
    if (NO_HOLE.includes(n)) return false;
    if (RAW_TEXT.includes(n)) {
      const end = s.indexOf('</', i);
      if (end < 0 || s.slice(i, end).includes('<')) return false;
      const gt = s.indexOf('>', end + 2);
      if (gt < 0 || s.slice(end + 2, gt).toLowerCase() !== n) return false;
      i = gt + 1;
    }
  }
}

export const scriptNeutral = (s: string): boolean => !SCRIPT_BAD.test(s);

export function urlNeutral(s: string): boolean {
  const l = s.toLowerCase();
  return s === '' || (!URL_BAD.test(s) && !DANGEROUS.some(d => l.startsWith(d) || d.startsWith(l)));
}

const resNeutral = (s: string): boolean => !RES_BAD.test(s);

/** CtxOf<S> at run time. */
export function ctxOf(s: string): Ctx[] {
  const ok = { html: htmlNeutral, script: scriptNeutral, url: urlNeutral, res: resNeutral };
  return CTXS.filter(c => ok[c](s));
}

/** Contexts where v is suitable even as attacker text; never res. */
export function attackerCtxs(v: string): Ctx[] {
  const ok = { html: !v.includes('<'), script: scriptNeutral(v), url: urlNeutral(v), res: false };
  return CTXS.filter(c => ok[c]);
}

/** D<O> at run time, for a finite set of schema outputs. */
export function dOf(values: readonly string[]): Ctx[] {
  return CTXS.filter(c => values.every(v => attackerCtxs(v).includes(c)));
}
