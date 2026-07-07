// The library: one function per rule of the calculus. Its casts are the only places where a value gets a label.
import type { z } from 'zod';
import type { Ctx, Level, Literal, Str } from './label.ts';

export * from './label.ts';

/** T-Lit: the text of a program literal gets the least label. A lint rule has to check the text itself. */
export function html(parts: TemplateStringsArray): Literal {
  return parts.join('') as Literal;
}

export type Schema = z.ZodType<string>;

/** Contexts in which every value of the schema is inert. Approximation: a finite set of values is inert everywhere but res. */
export type InertOf<S extends Schema> = string extends z.output<S> ? never : Exclude<Ctx, 'res'>;

/** T-Val: (mid, InertOf(S)). */
export function parse<S extends Schema>(s: S, u: unknown): Str<'lit' | 'val', InertOf<S>> {
  const out: string = s.parse(u);
  return out as Str<'lit' | 'val', InertOf<S>>;
}

const escapeHtml = (s: string): string => s.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);

/** San_c: one sanitizer per context; res allows https addresses only. */
export const SAN: Record<Ctx, (s: string) => string> = {
  html: escapeHtml,
  script: s => s.replace(/[^\w ,.-]/g, c => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`),
  url: s => escapeHtml(/^(?:https?|mailto):|^[^:]*$/i.test(s) ? s : 'about:invalid'),
  res: s => (/^https:\/\//i.test(s) ? escapeHtml(s) : 'about:invalid'),
};

/** T-San: (mid, {c}). Rejects level top, so validation comes first. */
export function sanitize<C extends Ctx>(c: C, s: Str<'lit' | 'val', never>): Str<'lit' | 'val', C> {
  return SAN[c](s) as Str<'lit' | 'val', C>;
}

export interface Res {
  send: (body: string) => unknown;
}

/** T-Out: the condition of the rule as a pair of overloads. */
export function send(res: Res, h: Str<'lit', never>): void; // i = bot
export function send(res: Res, h: Str<Level, 'html'>): void; // html in K
export function send(res: Res, h: string): void {
  res.send(h);
}
