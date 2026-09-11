// T-Tpl (sec:lib-tpl): a scanner over the static parts gives each hole its context; a rejection is a
// sentence in the parameter type.
import type { Ctx, CtxsOf, Level, Prov, Str } from './label.ts';
import type { CodeElement, IsLit, TextAttr, Url } from './contexts.ts';

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
