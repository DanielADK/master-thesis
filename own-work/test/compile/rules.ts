// Compile-time tests of the label rules (tab:pravidla). Never imported at run time.
import { z } from 'zod';
import { cat, h, parse, sanitize, send, type Res } from '../../src/index.ts';

declare const res: Res;
declare const raw: string; // T-Src: request input (top, {})

const v = parse(z.string().max(100), raw); // T-Val: (mid, {})
const qHtml = sanitize('html', v); // T-San: (mid, {html})

// T-San: validation must come first, a literal is already bot
// @ts-expect-error raw input has level top
sanitize('html', raw);
sanitize('html', h('x'));
// @ts-expect-error there is no sanitizer for res
sanitize('res', v);

// R3: the literal "<div title=" has no context, the join has none either
// @ts-expect-error
send(res, cat(cat(h('<div title='), qHtml), h('>')));

// T-Out, alternative i = bot: the programmer may send markup and code
send(res, h('<div title='));
send(res, cat(h('<script>'), h('init()</script>')));

// T-Val adds D(S)
send(res, parse(z.enum(['asc', 'desc']), raw));
// @ts-expect-error D(z.string()) is empty
send(res, parse(z.string().max(100), raw));

// T-Lit: only literal types, the label is computed from the text
// @ts-expect-error
h(raw);
