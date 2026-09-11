// walk against the cases of test/compile/tpl.ts; def:tpl and lem:tpl in the browser model.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Ctx } from '../src/label.ts';
import { MSG, walk } from '../src/index.ts';

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
