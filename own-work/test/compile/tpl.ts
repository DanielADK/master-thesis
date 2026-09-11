// Compile-time tests of rule T-Tpl (sec:lib-tpl): accepted templates, rejected ones with their sentences.
import { z } from 'zod';
import { h, html, parse, sanitize, send, type Check, type Res, type SafeHtml, type Str } from '../../src/index.ts';

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
declare const res: Res;
declare const raw: string;
const v = parse(z.string().max(100), raw); // validated, no context
const q = sanitize('html', v); // html, text
const u = sanitize('url', v); // url
const js = sanitize('script', v); // script
const sort = parse(z.enum(['asc', 'desc']), raw); // html, script, url, text

// accepted
send(res, html('<h1>Výsledky pro: ', q, '</h1>'));
send(res, html('<!doctype html><title>Hledání: ', q, '</title><form><input name="q" value="', q, '"></form><h1>', q, '</h1>'));
send(res, html('<li><a href="', u, '">', q, '</a></li>'));
send(res, html('<a href="/users/', u, '/posts/', u, '">x</a>'));
send(res, html('<a href="', u, u, '">x</a>'));
send(res, html('<p>', q, q, '</p>'));
send(res, html('<a href="?sort=', sort, '">', sort, '</a>'));
send(res, html('<input value="', sort, '"><a title="', q, '" href="', u, '">x</a>'));
send(res, html('<a title="it\'s ', q, '">x</a>'));
send(res, html('<textarea name="bio">', q, '</textarea>'));
send(res, html('<TITLE>', q, '</Title>'));
send(res, html('<DIV ID="', q, '" data-x="', q, '" aria-label="', q, '">', q, '</DIV>'));
send(res, html('<script>var q = "', js, '"; init(q);</script>'));
send(res, html('<script>var a = "it\'s ', js, '";</script>'));
send(res, html("<script>var a = '", js, "' + '", js, "';</script>"));
send(res, html('<script src="', h('/app.js'), '"></script>'));
const SCRIPTS = { a: h('/a.js'), b: h('/b.js') };
send(res, html('<script src="', SCRIPTS[z.enum(['a', 'b']).parse(raw)], '"></script>'));
const rows: SafeHtml[] = [html('<li>', q, '</li>')];
send(res, html('<ul>', rows, '</ul>'));
send(res, html('<!DOCTYPE HTML><html><body>', rows, '</body></html>'));
send(res, html());
send(res, html('<p>', q));
send(res, html('<br/><img src="', u, '"/>'));

// result types: bot without holes, mid with holes
const noHole = html('<p>x</p>');
export const bot: Same<typeof noHole, Str<'lit', 'html'>> = true;
const withHole = html('<p>', q, '</p>');
export const mid: Same<typeof withHole, Str<'lit' | 'val', 'html'>> = true;

// rejected
// @ts-expect-error validated but not escaped (the vulnerable running example)
send(res, html('<h1>Výsledky pro: ', v, '</h1>'));
// @ts-expect-error html-escaped value in href: javascript: passes html escaping
send(res, html('<a href="', q, '">x</a>'));
// @ts-expect-error a url value in a text attribute
send(res, html('<input value="', u, '">'));
// @ts-expect-error a template in a title reads as text
send(res, html('<title>', html('<b>', q, '</b>'), '</title>'));
// @ts-expect-error a plain string
send(res, html('<p>', raw, '</p>'));
// @ts-expect-error a number
send(res, html('<p>', 1, '</p>'));
const branch = Math.random() < 0.5 ? '<b>' : '<i>';
// @ts-expect-error a union of literals as static text
send(res, html(branch, q, '</b>'));
// @ts-expect-error R3: a hole inside a tag
send(res, html('<div title=', q, '>'));
// @ts-expect-error event handler
send(res, html('<button onclick="', js, '">x</button>'));
// @ts-expect-error event handler in upper case
send(res, html('<button ONCLICK="', js, '">x</button>'));
// @ts-expect-error srcdoc
send(res, html('<iframe srcdoc="', q, '"></iframe>'));
// @ts-expect-error style attribute
send(res, html('<p style="', q, '">x</p>'));
// @ts-expect-error base href
send(res, html('<base href="', u, '">'));
// @ts-expect-error BASE HREF in upper case
send(res, html('<BASE HREF="', u, '">'));
// @ts-expect-error object data
send(res, html('<object data="', u, '"></object>'));
// @ts-expect-error embed src
send(res, html('<embed src="', u, '">'));
// @ts-expect-error param value
send(res, html('<param name="x" value="', q, '">'));
// @ts-expect-error script href
send(res, html('<script href="', u, '"></script>'));
// @ts-expect-error script src with text before the hole
send(res, html('<script src="/static/', h('a.js'), '"></script>'));
// @ts-expect-error the static text could complete javascript:
send(res, html('<a href="java', u, '">x</a>'));
// @ts-expect-error a hole in script code
send(res, html('<script>var q = ', js, ';</script>'));
// @ts-expect-error an html value inside a script string
send(res, html('<script>var q = "', q, '";</script>'));
// @ts-expect-error a hole inside style
send(res, html('<style>', q, '</style>'));
// @ts-expect-error svg
send(res, html('<svg>', q, '</svg>'));
// @ts-expect-error unquoted attribute
send(res, html('<p class=x>', q, '</p>'));
// @ts-expect-error comment
send(res, html('<!-- ', q, ' -->'));
// @ts-expect-error / outside a string in script code
send(res, html('<script>var a = 1 / 2; var s = "', js, '";</script>'));
// @ts-expect-error --> in script code
send(res, html('<script>var a = 1; --> var s = "', js, '";</script>'));
// @ts-expect-error a line break inside a script string
send(res, html('<script>var s = "\n', js, '";</script>'));
// @ts-expect-error the template ends inside a tag
send(res, html('<p class="', u));
// @ts-expect-error the template ends inside a script
send(res, html('<script>var a = "', js));
// @ts-expect-error an array with a plain string
send(res, html('<ul>', [html('<li>x</li>'), raw], '</ul>'));
// @ts-expect-error a string operator drops the label
send(res, html('<p>', q + 'x', '</p>'));

// the sentences are literal types in the parameter position (Check<P> is what the scanner says about P)
export const m1: Same<Check<['<p>', string, '</p>']>, ['<p>', 'a plain string is not allowed here: validate and escape it', '</p>']> = true;
export const m2: Same<Check<['<div title=', typeof q, '>']>, ['<div title=', 'a hole inside a tag is not allowed', '>']> = true;
export const m3: Same<Check<['<a href="', typeof q, '">']>, ['<a href="', 'this hole needs a value safe for url; the value is escaped for a different context', '">']> = true;
export const m4: Same<Check<['<p>', typeof v, '</p>']>, ['<p>', 'this hole needs a value safe for html; the value is validated but not escaped', '</p>']> = true;
export const m5: Same<Check<['<title>', typeof withHole, '</title>']>, ['<title>', 'this hole reads text only; a template or html value is not allowed here', '</title>']> = true;
export const m6: Same<Check<['<p class="', typeof q]>, ['<p class="', 'the template must end in element content']> = true;
export const m7: Same<Check<['<a href="java', typeof u, '">']>, ['<a href="java', 'the text "java" before the hole could start a dangerous scheme', '">']> = true;
export const m8: Same<Check<['<object data="', typeof u, '">']>, ['<object data="', 'a hole in an attribute of <object> is not allowed', '">']> = true;
export const m9: Same<Check<['<button onclick="', typeof js, '">']>, ['<button onclick="', 'a hole in an event handler is never allowed', '">']> = true;
export const m10: Same<Check<['<style>', typeof q, '</style>']>, ['<style>', 'a hole inside <style> is not supported', '</style>']> = true;
export const m11: Same<Check<['<svg>', typeof q, '</svg>']>, ['<svg> is not supported', typeof q, '</svg>']> = true;
export const m12: Same<Check<['<p class=x>', typeof q, '</p>']>, ['attribute values must be quoted', typeof q, '</p>']> = true;
export const m13: Same<Check<['<!-- ', typeof q, ' -->']>, ['comments and declarations other than <!doctype html> are not supported', typeof q, ' -->']> = true;
export const m14: Same<Check<['<script>var q = ', typeof js, ';</script>']>, ['<script>var q = ', 'a hole in script code is only allowed inside a string literal', ';</script>']> = true;
export const m15: Same<Check<['<script>var a = 1 / 2; var s = "', typeof js, '";</script>']>, ['script code must not contain <, /, `, \\ or --> outside a string literal', typeof js, '";</script>']> = true;
export const m16: Same<Check<['<script src="/static/', typeof u, '">']>, ['<script src="/static/', 'script src must be a whole value', '">']> = true;
export const m17: Same<Check<['<iframe srcdoc="', typeof q, '">']>, ['<iframe srcdoc="', 'a hole in srcdoc is not supported', '">']> = true;
export const m18: Same<Check<['<p>', 1, '</p>']>, ['<p>', 'only single literals and labeled values are allowed', '</p>']> = true;
export const m19: Same<Check<['<p>', typeof q, '</p>']>, ['<p>', typeof q, '</p']> = false;
