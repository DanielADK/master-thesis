// One function per rule of tab:pravidla; the casts here are the audit surface (thm:audit).
import type { z } from 'zod';
import type { Ctx, CtxsOf, Level, ProvOf, SafeHtml, Str } from './label.ts';
import type { CtxOf, D, IsLit } from './contexts.ts';

export * from './label.ts';
export type { CtxOf, D } from './contexts.ts';
export { html, MSG, type Check, type Part } from './tpl.ts';

/** never unless every member of S is a literal type. */
type Literal<S extends string> = false extends IsLit<S> ? never : unknown;

/** T-Lit: the label from the literal type; rejects string and patterns. */
export function h<S extends string>(s: S & Literal<S>): Str<'lit', CtxOf<S>> {
  return s as unknown as Str<'lit', CtxOf<S>>;
}

/** T-Val: (min(i, mid), K | D(S)). Validation must not change the value. */
export function parse<S extends z.ZodType<string>, V>(
  schema: S, v: V,
): Str<Extract<ProvOf<V>, 'lit' | 'val'>, CtxsOf<V> | D<z.output<S>>> {
  const out: string = schema.parse(v);
  if (out !== v) throw new Error('T-Val: the schema must not transform the value');
  return out as Str<Extract<ProvOf<V>, 'lit' | 'val'>, CtxsOf<V> | D<z.output<S>>>;
}

type Validated = Str<'lit' | 'val', never>;
/** The sanitizers of the realization, named by their main context. */
export type San = 'html' | 'script' | 'url';

const escapeHtml = (s: string): string => s.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);

const SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const SAFE_SCHEME = /^(?:https?|mailto):/i;
// "java" plus later text could become javascript:.
const schemePrefix = (u: string): boolean =>
  u !== '' && ['javascript:', 'vbscript:', 'data:'].some(d => d.startsWith(u.toLowerCase()));

/** San_c of ass:san; there is no San_res. */
export const SAN: Record<San, (s: string) => string> = {
  html: escapeHtml,
  script: s => s.replace(/[^\w ,.-]/g, c => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`),
  url: s => {
    const u = s.replace(/[\t\n\r]/g, '').replace(/^[\x00-\x20]+|[\x00-\x20]+$/g, '');
    const ok = SAFE_SCHEME.test(u) || !(SCHEME.test(u) || schemePrefix(u));
    return escapeHtml(ok ? u : 'about:invalid#zClosurez');
  },
};

/** C_c of ass:san: the contexts each sanitizer declares. */
export const SAN_CTXS: Record<San, readonly Ctx[]> = { html: ['html', 'text'], script: ['script'], url: ['url'] };

/** T-San: (mid, C_c); rejects level top, one overload per sanitizer. */
export function sanitize(c: 'html', v: Validated): Str<'lit' | 'val', 'html' | 'text'>;
export function sanitize(c: 'script', v: Validated): Str<'lit' | 'val', 'script'>;
export function sanitize(c: 'url', v: Validated): Str<'lit' | 'val', 'url'>;
export function sanitize(c: San, v: string): string {
  return SAN[c](v);
}

export interface Res {
  send: (body: string) => unknown;
}

/** T-Out for html, the overload pair of the thesis listing. */
export function send(res: Res, h: Str<'lit', never>): void; // i = bot
export function send(res: Res, h: SafeHtml): void; // html in K
export function send(res: Res, h: string): void {
  res.send(h);
}

/** Demo sinks: the data hole of each context. */
export const HOLE: Record<Ctx, readonly [string, string]> = {
  html: ['', ''],
  script: ['<script>var x = "', '";</script>'],
  url: ['<a href="', '">link</a>'],
  res: ['<script src="', '"></script>'],
  text: ['<input value="', '">'],
};

/** T-Out for context c; returns the document. */
export function out(c: Ctx, v: Str<'lit', never>): string;
export function out<C extends Ctx>(c: C, v: Str<Level, NoInfer<C>>): string;
export function out(c: Ctx, v: string): string {
  return HOLE[c][0] + v + HOLE[c][1];
}
