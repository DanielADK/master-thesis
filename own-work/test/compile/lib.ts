// Compile-time tests of the public library (sec:lib-rozhrani). Never imported at run time.
import { z } from 'zod';
import { escapeHtml, escapeScript, escapeUrl, html, literal, send, validate, type Res, type SafeHtml, type SafeScript, type SafeText, type SafeUrl, type Str, type TrustedResourceUrl } from '../../lib/index.ts';
import { unsafeHtml, unsafeResourceUrl, unsafeScript, unsafeText, unsafeUrl } from '../../lib/unsafe.ts';

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
declare const res: Res;
declare const input: unknown;
declare const anyInput: any; // what foreign declarations such as req.body give; the lint (F1) bans it

const q = escapeHtml(input);
export const qType: Same<typeof q, Str<'lit' | 'val', 'html' | 'text'>> = true;
export const qHtml: SafeHtml = q;
export const qText: SafeText = q;
export const u: SafeUrl = escapeUrl(input);
export const js: SafeScript = escapeScript(input, z.string().max(10));
send(res, html('<title>', q, '</title><a href="', u, '" title="', q, '">', q, '</a><script>var a = "', js, '";</script>'));

// the schema is optional and must produce a string
escapeHtml(input, z.string().max(100));
// @ts-expect-error a number schema has no string output
escapeHtml(input, z.number());
// validated input may be escaped; an escaped value may not be escaped again
escapeHtml(validate(z.string(), input));
// @ts-expect-error already safe for html and text
escapeHtml(q);
// @ts-expect-error already safe for url
escapeHtml(u);
// @ts-expect-error already safe for url
escapeUrl(u);
// any is the business of the lint, the library treats it as unknown
escapeHtml(anyInput);

// validate keeps the label and adds D(S)
export const sort: SafeText & SafeUrl = validate(z.enum(['asc', 'desc']), input);
// @ts-expect-error validated but not escaped
send(res, html('<p>', validate(z.string(), input), '</p>'));

// literal: contexts from the text; a union of literals is allowed in a hole
export const lit: Str<'lit', 'html'> = literal('<b>');
send(res, html('<p class="', literal(Math.random() < 0.5 ? 'a' : 'b'), '">x</p>'));
const SCRIPTS = { a: literal('/a.js'), b: literal('/b.js') };
export const trusted: TrustedResourceUrl = SCRIPTS[z.enum(['a', 'b']).parse(input)];
send(res, html('<script src="', trusted, '"></script>'));
// @ts-expect-error TrustedResourceUrl never comes from request input
export const notTrusted: TrustedResourceUrl = escapeUrl(input);

// send: the overload pair of the thesis; a plain string fails with TS2769
send(res, literal('<p>x</p>'));
// @ts-expect-error
send(res, '<p>x</p>');
// @ts-expect-error
send(res, validate(z.string(), input));

// unsafe: level mid with one context, so a hole of that context accepts it and escape* rejects it
send(res, html('<div>', unsafeHtml('<b>x</b>'), '<title>', unsafeText('x'), '</title><a href="', unsafeUrl('/x'), '"><script src="', unsafeResourceUrl('/x.js'), '"></script><script>var a = "', unsafeScript('x'), '";</script></div>'));
// @ts-expect-error an html value is not text: a template or a sanitizer output may contain </title>
send(res, html('<title>', unsafeHtml('x'), '</title>'));
// @ts-expect-error already safe
escapeHtml(unsafeHtml('x'));
// @ts-expect-error level mid without html: no overload of send
send(res, unsafeUrl('/x'));
