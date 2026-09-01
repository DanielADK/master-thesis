// Documented limitations: each test passes when the injection does happen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SAN } from '../src/index.ts';
import { chunked, holes, unionSink } from './compile/limits.ts';
import { injected } from './oracle.ts';
import type { Marked } from './model.ts';

const mark = (s: string, u: boolean): Marked => ({ s, u: Array<boolean>(s.length).fill(u) });
const join = (parts: Marked[]): Marked => ({ s: parts.map(p => p.s).join(''), u: parts.flatMap(p => p.u) });

test('limitation (sec:model-hranice): a response written in parts injects although every part is accepted', t => {
  const chunks: string[] = [];
  chunked({ write: c => chunks.push(c) }, 'x onmouseover=alert(1)');
  const [open = '', data = '', close = ''] = chunks;
  const parts = [mark(open, false), mark(data, true), mark(close, false)];
  for (const p of parts) assert.ok(!injected('html', p)); // each write on its own is a safe document
  assert.ok(injected('html', join(parts)));
  t.diagnostic(`response ${JSON.stringify(chunks.join(''))}: the sanitized value became an event handler`);
});

test('limitation (claim:adekvatnost): what only the lint rules of def:fragment reject compiles and injects', t => {
  for (const [name, hole] of Object.entries(holes)) {
    let body = '';
    hole({ send: b => { body = b; } }, '<img src=x onerror=alert(1)>');
    assert.ok(injected('html', mark(body, true)), name);
  }
  t.diagnostic(`${Object.keys(holes).length} constructs sent request input unsanitized: ${Object.keys(holes).join(', ')}`);
});

test('sec:model-typescript: a generic sanitize<C> with a union context would pass html escaping off as a URL', () => {
  const v = SAN.html('javascript:alert(1)');
  assert.equal(v, 'javascript:alert(1)');
  assert.ok(injected('url', mark(v, true)));
  assert.ok(!injected('url', mark(SAN.url('javascript:alert(1)'), true)));
});

test('sec:model-typescript: one union parameter instead of the overload pair lets the R3 pattern through', t => {
  let body = '';
  unionSink({ send: b => { body = b; } }, 'x onmouseover=alert(1)');
  const pre = '<div title='.length;
  const u = [...body].map((_, j) => j >= pre && j < body.length - 1);
  assert.ok(injected('html', { s: body, u }));
  t.diagnostic(`sent ${JSON.stringify(body)}`);
});
