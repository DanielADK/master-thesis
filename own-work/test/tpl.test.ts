// walk against the cases of test/compile/tpl.ts; def:tpl and lem:tpl in the browser model.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { CTXS, type Ctx } from '../src/label.ts';
import { ctxOf } from '../src/contexts.ts';
import { MSG, SAN, walk } from '../src/index.ts';
import { arbInput, arbLiteral, arbStatics, TEMPLATES, type Marked } from './model.ts';
import { endsInHole, executed, P, suitable } from './oracle.ts';

const cases: [readonly string[], Ctx[] | string][] = [
  [['<h1>Výsledky pro: ', '</h1>'], ['html']],
  [['<!doctype html><title>Hledání: ', '</title><form><input name="q" value="', '"></form><h1>', '</h1>'], ['text', 'text', 'html']],
  [['<li><a href="', '">', '</a></li>'], ['url', 'html']],
  [['<a href="/users/', '/posts/', '">x</a>'], ['url', 'url']],
  [['<a href="', '', '">x</a>'], ['url', 'url']],
  [['<p>', '', '</p>'], ['html', 'html']],
  [['<a href="?sort=', '">', '</a>'], ['url', 'html']],
  [['<a title="it\'s ', '">x</a>'], ['text']],
  [['<textarea name="bio">', '</textarea>'], ['text']],
  [['<TITLE>', '</Title>'], ['text']],
  [['<DIV ID="', '" data-x="', '" aria-label="', '">', '</DIV>'], ['text', 'text', 'text', 'html']],
  [['<script>var q = "', '"; init(q);</script>'], ['script']],
  [['<script>var a = "it\'s ', '";</script>'], ['script']],
  [["<script>var a = '", "' + '", "';</script>"], ['script', 'script']],
  [['<script src="', '"></script>'], ['res']],
  [['<ul>', '</ul>'], ['html']],
  [['<!DOCTYPE HTML><html><body>', '</body></html>'], ['html']],
  [[], []],
  [['<p>', ''], ['html']],
  [['<br/><img src="', '"/>'], ['url']],
  [['<div title=', '>'], MSG.tag],
  [['<button onclick="', '">x</button>'], MSG.handler],
  [['<button ONCLICK="', '">x</button>'], MSG.handler],
  [['<iframe srcdoc="', '"></iframe>'], 'a hole in srcdoc is not supported'],
  [['<p style="', '">x</p>'], 'a hole in style is not supported'],
  [['<base href="', '">'], 'a hole in an attribute of <base> is not allowed'],
  [['<BASE HREF="', '">'], 'a hole in an attribute of <base> is not allowed'],
  [['<object data="', '"></object>'], 'a hole in an attribute of <object> is not allowed'],
  [['<param name="x" value="', '">'], 'a hole in an attribute of <param> is not allowed'],
  [['<script href="', '"></script>'], 'a hole in an attribute of <script> is not allowed'],
  [['<script src="/static/', '"></script>'], MSG.scriptSrc],
  [['<a href="java', '">x</a>'], 'the text "java" before the hole could start a dangerous scheme'],
  [['<script>var q = ', ';</script>'], MSG.scriptCode],
  [['<style>', '</style>'], 'a hole inside <style> is not supported'],
  [['<svg>', '</svg>'], '<svg> is not supported'],
  [['<p class=x>', '</p>'], MSG.quoted],
  [['<!-- ', ' -->'], MSG.decl],
  [['<script>var a = 1 / 2; var s = "', '";</script>'], MSG.scriptChar],
  [['<script>var a = 1; --> var s = "', '";</script>'], MSG.scriptChar],
  [['<script>var s = "\n', '";</script>'], MSG.scriptString],
  [['<p class="'], MSG.end],
  [['<p class="', ''], MSG.end],
  [['<script>var a = "', ''], MSG.end],
  [['<title>a<b>', '</title>'], '< inside <title>'],
  [['<title>', '</p>'], 'wrong end tag inside <title>'],
];

test('walk: the cases of test/compile/tpl.ts give the same contexts and sentences at run time', () => {
  for (const [statics, expected] of cases) {
    const w = walk(statics);
    if (typeof expected === 'string') assert.deepEqual(w, { error: expected }, JSON.stringify(statics));
    else assert.deepEqual('error' in w ? w : w.holes, expected, JSON.stringify(statics));
  }
});

test('walk: a script hole reports where its string literal starts, even across holes', () => {
  const one = walk(['<script>var q = "', '"; init(q);</script>']);
  assert.deepEqual('error' in one ? one : one.strings, [{ part: 0, offset: 17 }]);
  const two = walk(["<script>var a = '", "' + '", "';</script>"]);
  assert.deepEqual('error' in two ? two : two.strings, [{ part: 0, offset: 17 }, { part: 1, offset: 5 }]);
  const text = walk(['<title>', '</title><a href="', '">']);
  assert.deepEqual('error' in text ? text : text.strings, [undefined, undefined]);
});

const mark = (s: string, u: boolean): Marked => ({ s, u: Array<boolean>(s.length).fill(u) });
const lit = (c: Ctx): fc.Arbitrary<Marked> => arbLiteral.filter(s => ctxOf(s).includes(c)).map(s => mark(s, false));
/** Values suitable for each context: sanitizer outputs, D(S) values and literals. */
const VALUES: Record<Ctx, fc.Arbitrary<Marked>> = {
  html: fc.oneof(arbInput.map(x => mark(SAN.html(x), true)), fc.constantFrom('asc', 'desc', '123').map(x => mark(x, true)), lit('html')),
  text: fc.oneof(arbInput.map(x => mark(SAN.html(x), true)), fc.constantFrom('asc', 'desc', '123').map(x => mark(x, true)), lit('text')),
  url: fc.oneof(arbInput.map(x => mark(SAN.url(x), true)), fc.constantFrom('/', 'asc', '123').map(x => mark(x, true)), lit('url')),
  script: fc.oneof(arbInput.map(x => mark(SAN.script(x), true)), fc.constantFrom('asc', '123').map(x => mark(x, true)), lit('script')),
  res: fc.constantFrom('/a.js', 'https://cdn.example.com/x.js', 'app.js').map(s => mark(s, false)),
};

type Built = { doc: Marked; prefixes: number[]; starts: number[] };
/** The document of a template with the given values, with hole and script string positions. */
function build(statics: readonly string[], holes: readonly Ctx[], strings: ({ part: number; offset: number } | undefined)[], values: readonly Marked[]): Built {
  const partStart: number[] = [];
  let doc: Marked = { s: '', u: [] };
  const prefixes: number[] = [];
  statics.forEach((st, k) => {
    partStart.push(doc.s.length);
    doc = { s: doc.s + st, u: [...doc.u, ...mark(st, false).u] };
    if (k < holes.length) {
      prefixes.push(doc.s.length);
      const v = values[k] ?? mark('', false);
      doc = { s: doc.s + v.s, u: [...doc.u, ...v.u] };
    }
  });
  const starts = strings.flatMap(s => (s ? [(partStart[s.part] ?? 0) + s.offset] : []));
  return { doc, prefixes, starts };
}

const accepted = [...TEMPLATES.map(t => [...t]), ...fc.sample(arbStatics, { seed: 8, numRuns: 400 })]
  .map(statics => ({ statics, w: walk(statics) }))
  .flatMap(({ statics, w }) => ('error' in w ? [] : [{ statics, holes: w.holes, strings: w.strings }]));

test('def:tpl and lem:tpl: for every accepted template and suitable values, the holes and the end lie in their data holes and the result is html-suitable', t => {
  let holesChecked = 0;
  let results = 0;
  for (const { statics, holes, strings } of accepted) {
    const samples = fc.sample(fc.tuple(...holes.map(c => VALUES[c])), { seed: 9, numRuns: 12 });
    for (const values of samples) {
      const { doc, prefixes, starts } = build(statics, holes, strings, values);
      // (i) and (ii) quantify over every p ending in the html hole: the prefixes of P.html
      for (const p of P.html) {
        holes.forEach((c, k) => {
          holesChecked++;
          const start = strings[k];
          const abs = start ? (starts[strings.slice(0, k).filter(Boolean).length] ?? 0) + p.length : undefined;
          assert.ok(endsInHole(p + doc.s.slice(0, prefixes[k]), c, abs), `(i) hole ${k} of ${JSON.stringify(statics)} after ${JSON.stringify(p)} with ${JSON.stringify(values.map(v => v.s))}`);
        });
        assert.ok(endsInHole(p + doc.s, 'html'), `(ii) ${JSON.stringify(statics)} after ${JSON.stringify(p)}`);
      }
      results++;
      assert.ok(suitable(doc, 'html', starts), `lem:tpl: ${JSON.stringify(doc.s)}`);
    }
  }
  t.diagnostic(`${accepted.length} accepted templates, ${holesChecked} holes checked for (i), ${results} results checked for (ii) and lem:tpl`);
});

const WRONG: Record<Ctx, Marked[]> = {
  html: [mark('<img src=x onerror=alert(1)>', true)],
  text: [mark('" onmouseover="alert(1)', true), mark("' onmouseover='alert(1)", true), mark('</title></textarea><script>alert(1)</script>', true)],
  url: [mark(SAN.html('javascript:alert(1)'), true), mark('javascript:alert(1)', true)],
  script: [mark('";alert(1)//', true), mark("';alert(1)//", true), mark('</script><script>alert(1)</script>', true)],
  res: [mark('https://evil.example/x.js', true)],
};

test('the template rule is not vacuous: a raw or differently escaped value in a hole injects or leaves the hole', t => {
  const hit = Object.fromEntries(CTXS.map(c => [c, 0])) as Record<Ctx, number>;
  for (const { statics, holes, strings } of accepted) {
    const fit = fc.sample(fc.tuple(...holes.map(c => VALUES[c])), { seed: 10, numRuns: 1 })[0] ?? [];
    holes.forEach((c, k) => {
      for (const wrong of WRONG[c]) {
        const values = fit.map((v, j) => (j === k ? wrong : v));
        const { doc, prefixes, starts } = build(statics, holes, strings, values);
        const v = executed(doc.s, starts);
        const injected = doc.u.some((att, j) => att && v[j]);
        const left = !endsInHole(doc.s.slice(0, (prefixes[k] ?? 0) + wrong.s.length), c, strings[k] ? starts[strings.slice(0, k).filter(Boolean).length] : undefined);
        if (injected || left) hit[c]++;
      }
    });
  }
  for (const c of CTXS) assert.ok(hit[c] > 0, c);
  t.diagnostic(`wrong values caught per hole context: ${CTXS.map(c => `${c} ${hit[c]}`).join(', ')}`);
});
