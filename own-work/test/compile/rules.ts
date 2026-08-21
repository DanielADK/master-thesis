// Compile-time tests of the label rules (tab:pravidla). Never imported at run time.
import { z } from 'zod';
import { cat, h, out, parse, sanitize, send, type CtxOf, type Res, type SafeHtml, type Str } from '../../src/index.ts';

declare const res: Res;
declare const raw: string; // T-Src: request input (top, {})

const v = parse(z.string().max(100), raw); // T-Val: (mid, {})
const qHtml = sanitize('html', v); // T-San: (mid, {html})
const qScript = sanitize('script', v);

// T-San: validation must come first, a literal is already bot
// @ts-expect-error raw input has level top
sanitize('html', raw);
sanitize('html', h('x'));
// @ts-expect-error there is no sanitizer for res
sanitize('res', v);
const c = Math.random() < 0.5 ? 'html' : 'url';
// @ts-expect-error a union of contexts would claim both after a single escaping
sanitize(c, v);

// R3: the literal "<div title=" has no context, the join has none either
// @ts-expect-error
send(res, cat(cat(h('<div title='), qHtml), h('>')));

// lem:monoid as in safevalues: SafeHtml + SafeHtml is SafeHtml, SafeHtml + SafeScript fits no sink
send(res, cat(qHtml, sanitize('html', parse(z.string(), raw))));
const mixed = cat(qHtml, qScript);
// @ts-expect-error
send(res, mixed);
// @ts-expect-error
out('script', mixed);
// @ts-expect-error
out('html', mixed);
out('script', cat(qScript, qScript));

// T-Out, alternative i = bot: the programmer may send markup and code
send(res, h('<div title='));
send(res, cat(h('<script>'), h('init()</script>')));
// T-Val keeps bot for a literal
send(res, parse(z.string(), h('<div title=')));

// T-Val adds D(S)
send(res, parse(z.enum(['asc', 'desc']), raw));
out('url', parse(z.enum(['asc', 'desc']), raw));
// @ts-expect-error D(S) never contains res
out('res', parse(z.enum(['asc', 'desc']), raw));
// @ts-expect-error not even for a schema that accepts only the empty string
out('res', parse(z.literal(''), raw));
// res has no sanitizer: an allowlist is a table of literals indexed by a validated key
const SCRIPTS = { a: h('/a.js'), b: h('/b.js') };
out('res', SCRIPTS[z.enum(['a', 'b']).parse(raw)]);
// @ts-expect-error D(z.string()) is empty
send(res, parse(z.string().max(100), raw));
// @ts-expect-error the regex is not in the schema type: TS sees D(S) = {}, the model has html in D(S)
send(res, parse(z.string().regex(/^\d+$/), raw));
// @ts-expect-error a literal joined with a pattern is not finite, D(S) = {} (the pattern accepts '<img ...>x')
send(res, parse(z.union([z.literal('asc'), z.templateLiteral([z.string(), 'x'])]), raw));

// T-Lit: only literal types, the label is computed from the text
// @ts-expect-error
h(raw);
// @ts-expect-error a template with a string hole has a pattern type, not a literal type
h(`<b>${raw}</b>`);
export function wrap<T extends string>(t: T): unknown {
  // @ts-expect-error a generic wrapper cannot launder a string into a literal
  return h(t);
}
export const lit1: Str<'lit', 'html'> = h('<h1>');
// @ts-expect-error CtxOf is a lower bound: the model grants '<h1>' script as well, the realization does not
export const lit2: Str<'lit', 'script'> = h('<h1>');
// a union of literals gets the intersection of contexts
export const lit3: Str<'lit', 'html'> = h(Math.random() < 0.5 ? '<b>' : 'x');
// @ts-expect-error
export const lit4: Str<'lit', 'url'> = h(Math.random() < 0.5 ? '<b>' : 'x');
// every member of the union must be a literal type, a pattern member would give attacker text origin bot
// @ts-expect-error
export const lift = (v: 'a' | `${string}x`): unknown => h(v);
type None<X> = [X] extends [never] ? true : false;
export const noPattern: None<CtxOf<'a' | `${string}x`>> = true;
// template content is not a data hole of html (ass:parse)
export const noTemplate: None<CtxOf<'<template>'>> = true;

// A tagged template cannot carry the literal: its strings are typed TemplateStringsArray
const tag = <const T extends readonly string[]>(s: T): T => s;
// @ts-expect-error
export const text: readonly ['<div title='] = tag`<div title=`;

// String operators drop the label
// @ts-expect-error
send(res, h('<b>') + qHtml);
// @ts-expect-error
send(res, `${h('<b>')}${qHtml}`);

// Level encoding: mid must be the set 'lit' | 'val', otherwise bot is not below mid
export const mid: Str<'lit' | 'val', 'html'> = h('<b>');
// @ts-expect-error
export const single: Str<'val', 'html'> = h('<b>');

// claim:join holds for label types only: the union is more precise than the type of the join
declare const x: Str<'lit', 'html'>;
declare const y: Str<'lit' | 'val', 'script'>;
declare const joined: Str<'lit' | 'val', never>; // the type of the label of x joined with y
export const u: Str<'lit', 'html'> | Str<'lit' | 'val', 'script'> = cat(x, y);
// @ts-expect-error
export const back: Str<'lit', 'html'> | Str<'lit' | 'val', 'script'> = joined;

// F3: with a property signature, strictFunctionTypes rejects a sink that narrows its parameter
// (a method signature accepts it, see compile/limits.ts)
type PropSink = { put: (res: Res, x: string) => void };
// @ts-expect-error
export const propSink: PropSink = { put: (r: Res, x: SafeHtml) => send(r, x) };
