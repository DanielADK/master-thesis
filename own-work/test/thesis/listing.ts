// The two listings of sec:model-typescript verbatim from parts/practical.tex, then the claims the text
// makes about them; Express and app are declared in env.d.ts. test/thesis.test.ts compiles the file:
// each line marked `expect TSxxxx` must fail with that code, every other line must compile.

declare const prov: unique symbol;

type Ctx   = 'html' | 'script' | 'url' | 'res';
// dolní množiny: bot = 'lit', mid = 'lit' | 'val', top = Level
type Level = 'lit' | 'val' | 'raw';

type Prov<I extends Level> = { readonly [prov]: I };
type Inert<K extends Ctx>  = { readonly [C in K as `__inert_${C}`]: true };
type Str<I extends Level, K extends Ctx> = string & Prov<I> & Inert<K>;

type SafeHtml = Str<Level, 'html'>;      // libovolný původ, způsobilá pro html

// štítek čtený z typu hodnoty V
type ProvOf<V> = V extends Prov<infer I> ? I : Level;
type CtxsOf<V> = { [C in Ctx]: [V] extends [Inert<C>] ? C : never }[Ctx];

import type { Response } from 'express';
import { z } from 'zod';
import type { CtxOf, D } from './contexts';     // ctx(s) a D(S) jako typy

// literálovým typem musí být každý člen sjednocení S
type IsLit<S extends string> =
  S extends unknown ? ({} extends Record<S, 1> ? false : true) : never;
type Literal<S extends string> = false extends IsLit<S> ? never : unknown;
type Mid<K extends Ctx> = Str<'lit' | 'val', K>;  // původ nejhůře mid

declare function h<S extends string>(s: S & Literal<S>): Str<'lit', CtxOf<S>>;
declare function parse<S extends z.ZodType<string>, V>(schema: S, v: V):
  Str<Extract<ProvOf<V>, 'lit' | 'val'>, CtxsOf<V> | D<z.output<S>>>;
declare function sanitize(c: 'html', s: Mid<never>): Mid<'html'>;
declare function sanitize(c: 'script', s: Mid<never>): Mid<'script'>;
declare function sanitize(c: 'url', s: Mid<never>): Mid<'url'>;
declare function cat<A extends string, B extends string>(a: A, b: B): A | B;

// podmínka pravidla T-Out se vyjádří dvojicí přetížení
declare function send(res: Response, h: Str<'lit', never>): void;   // i = bot
declare function send(res: Response, h: SafeHtml): void;            // html in K

app.get('/hledat', (req, res) => {
  const q = sanitize('html', parse(z.string().max(100), req.query.q));
  send(res, cat(cat(h('<h1>Výsledky pro: '), q), h('</h1>')));   // přeloží se
  // send(res, cat(cat(h('<h1>'), req.query.q as string), h('</h1>')));
  //   ^ chyba TS2769 (No overload matches this call): string není
  //     přiřaditelný ani do Str<'lit', never>, ani do SafeHtml
});

// the commented-out call of the listing
app.get('/zranitelne', (req, res) => {
  send(res, cat(cat(h('<h1>'), req.query.q as string), h('</h1>'))); // expect TS2769
});

// Claims of the text about the listings.
declare const response: Response;
declare const input: unknown;
const text = String(input);
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

// string is assignable to neither parameter of send
export const bot: Str<'lit', never> = text; // expect TS2322
export const safe: SafeHtml = text; // expect TS2322

// a string without marks, request input included, has origin top and no context
export const top: Same<ProvOf<string>, Level> & Same<ProvOf<unknown>, Level> = true;
export const none: Same<CtxsOf<string>, never> & Same<CtxsOf<unknown>, never> = true;

// h rejects string and a union of a literal with a pattern
h(text); // expect TS2345
export const lift = (v: 'a' | `${string}x`): unknown => h(v); // expect TS2345

// parse keeps the label of its input, with origin at most mid, and adds D(S)
send(response, parse(z.string(), h('<b>')));
send(response, parse(z.string(), sanitize('html', parse(z.string(), input))));
send(response, parse(z.enum(['asc', 'desc']), input));
send(response, parse(z.string(), input)); // expect TS2769

// sanitize rejects origin top and a union of contexts
sanitize('html', text); // expect TS2769
const ctx = Math.random() < 0.5 ? 'html' : 'url';
sanitize(ctx, parse(z.string(), input)); // expect TS2769
// a generic signature would accept the union and claim both contexts after one sanitizer
declare function sanitizeGeneric<C extends Ctx>(c: C, s: Mid<never>): Mid<C>;
export const both: Mid<'html' | 'url'> = sanitizeGeneric(ctx, parse(z.string(), input));

// one parameter of the union type would let the R3 pattern through, the overload pair does not
declare function sendUnion(res: Response, h: Str<'lit', never> | SafeHtml): void;
const r3 = cat(cat(h('<div title='), sanitize('html', parse(z.string(), input))), h('>'));
sendUnion(response, r3);
send(response, r3); // expect TS2769
