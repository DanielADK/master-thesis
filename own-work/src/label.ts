// The label (i, K) of sec:model-typescript; bot = 'lit', mid = 'lit' | 'val', top = Level.
declare const prov: unique symbol;

export type Ctx = 'html' | 'script' | 'url' | 'res';
export type Level = 'lit' | 'val' | 'raw'; // bot, mid, top

export type Prov<I extends Level> = { readonly [prov]: I };
export type Inert<K extends Ctx> = { readonly [C in K as `__inert_${C}`]: true };
export type Str<I extends Level, K extends Ctx> = string & Prov<I> & Inert<K>;

export type SafeHtml = Str<Level, 'html'>; // (i, {html}) for any i
export type Literal = Str<'lit', Ctx>; // the least element (bot, C)

export const CTXS: readonly Ctx[] = ['html', 'script', 'url', 'res'];

/** T-Concat: the join is the union of the types (claim:join). */
export function cat<A extends string, B extends string>(a: A, b: B): A | B {
  return (a + b) as A | B;
}
