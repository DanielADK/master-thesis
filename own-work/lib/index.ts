// The public library (sec:lib-rozhrani): one function per rule of tab:pravidla over the kernel in ../src.
import { z } from 'zod';
import { parse, sanitize, type CtxsOf, type Level, type Str } from '../src/index.ts';

export { html, h as literal, parse as validate } from '../src/index.ts';
export type { Check, Ctx, Level, Part, Str } from '../src/index.ts';

/** Element content: html(), escapeHtml() or unsafeHtml(). */
export type SafeHtml = Str<Level, 'html'>;
/** Title, textarea and text attributes: escapeHtml(), validate() of an enum or unsafeText(). */
export type SafeText = Str<Level, 'text'>;
/** A string literal inside a script: escapeScript() or unsafeScript(). */
export type SafeScript = Str<Level, 'script'>;
/** A URL attribute: escapeUrl() or unsafeUrl(). */
export type SafeUrl = Str<Level, 'url'>;
/** The src of a script: a literal or unsafeResourceUrl(). */
export type TrustedResourceUrl = Str<Level, 'res'>;

type IsAny<V> = 0 extends 1 & V ? true : false;
/** Rejects a value that already has a context (double escaping). */
type Escapable<V> = IsAny<V> extends true ? unknown
  : [CtxsOf<V>] extends [never] ? unknown : 'this value is already safe for a context; do not escape it twice';

/**
 * T-Val and T-San for element content; also safe for text places.
 * Example: `html('<h1>', escapeHtml(req.query.q, z.string().max(100)), '</h1>')`.
 */
export function escapeHtml<V>(input: V & Escapable<V>, schema: z.ZodType<string> = z.string()): Str<'lit' | 'val', 'html' | 'text'> {
  return sanitize('html', parse(schema, input as unknown));
}

/**
 * T-Val and T-San for a URL attribute; http, https, mailto and relative addresses pass, the rest becomes
 * about:invalid#zClosurez. Example: `html('<a href="/users/', escapeUrl(name), '">')`.
 */
export function escapeUrl<V>(input: V & Escapable<V>, schema: z.ZodType<string> = z.string()): Str<'lit' | 'val', 'url'> {
  return sanitize('url', parse(schema, input as unknown));
}

/**
 * T-Val and T-San for a string literal inside a script.
 * Example: `html('<script>var q = "', escapeScript(q), '";</script>')`.
 */
export function escapeScript<V>(input: V & Escapable<V>, schema: z.ZodType<string> = z.string()): Str<'lit' | 'val', 'script'> {
  return sanitize('script', parse(schema, input as unknown));
}

/** A response of Express, Fastify or node:http. */
export type Res = ({ send: (body: string) => unknown } | { end: (body: string) => unknown }) & {
  setHeader?: (name: string, value: string) => unknown;
  header?: (name: string, value: string) => unknown;
  getHeader?: (name: string) => unknown;
};

/**
 * T-Out: one write, Content-Type text/html unless already set.
 * Example: `send(res, html('<h1>', escapeHtml(q), '</h1>'))`.
 */
export function send(res: Res, page: Str<'lit', never>): void; // i = bot
export function send(res: Res, page: SafeHtml): void; // html in K
export function send(res: Res, page: string): void {
  if (!res.getHeader?.('content-type')) {
    if (res.setHeader) res.setHeader('Content-Type', 'text/html; charset=utf-8');
    else if (res.header) res.header('Content-Type', 'text/html; charset=utf-8');
  }
  if ('send' in res) res.send(page);
  else res.end(page);
}
