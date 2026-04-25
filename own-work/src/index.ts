// Prototype of the branded types from sec:branded: a string is tainted until the library marks it as safe.
declare const __brand: unique symbol;
type Brand<T, B> = T & { readonly [__brand]: B };

export type TaintedString = string; // a string without the mark
export type SafeHtml = Brand<string, 'SafeHtml'>;

const escapeHtml = (s: string): string => s.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);

/** The only place that adds the mark: escaping for the HTML body. */
export function sanitizeHtml(s: TaintedString): SafeHtml {
  return escapeHtml(s) as SafeHtml;
}

export interface Res {
  send: (body: string) => unknown;
}

/** The sink accepts marked values only. */
export function send(res: Res, html: SafeHtml): void {
  res.send(html);
}
