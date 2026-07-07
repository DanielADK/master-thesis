// Compile-time tests of the rules of the calculus. Never imported at run time.
import { z } from 'zod';
import { cat, html, parse, sanitize, send, type Res, type SafeHtml } from '../../src/index.ts';

declare const res: Res;
declare const raw: string; // T-Src: request input (top, {})

const v = parse(z.string().max(100), raw); // T-Val: (mid, {})
const q = sanitize('html', v); // T-San: (mid, {html})

// T-San: validation must come first
// @ts-expect-error raw input has level top
sanitize('html', raw);

// T-Lit: a template with a hole would carry request input
// @ts-expect-error
html`<h1>${raw}</h1>`;

// T-Out: a literal, or a value with html in K
send(res, html`<h1>Hello</h1>`);
send(res, cat(cat(html`<h1>`, q), html`</h1>`));
// @ts-expect-error raw input fits neither overload
send(res, raw);
// @ts-expect-error a value escaped for script is not inert in html
send(res, sanitize('script', v));

// T-Val: the values of an enum are inert everywhere but res
export const sort: SafeHtml = parse(z.enum(['asc', 'desc']), raw);
// @ts-expect-error a free string has no context
export const free: SafeHtml = parse(z.string(), raw);
