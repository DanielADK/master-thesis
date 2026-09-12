// The public library at run time: each symbol once, send against three response shapes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { SAN } from '../src/index.ts';
import { escapeHtml, escapeScript, escapeUrl, html, literal, send, validate } from '../lib/index.ts';
import { unsafeHtml, unsafeResourceUrl, unsafeScript, unsafeText, unsafeUrl } from '../lib/unsafe.ts';

const input: unknown = '<script>alert(1)</script>';

test('html concatenates the parts and joins arrays with the empty string', () => {
  const q = escapeHtml('a & b');
  assert.equal(html('<p>', q, '</p>'), '<p>a &#38; b</p>');
  assert.equal(html('<ul>', [html('<li>x</li>'), html('<li>y</li>')], '</ul>'), '<ul><li>x</li><li>y</li></ul>');
  assert.equal(html(), '');
});

test('literal and validate return the value unchanged; validate rejects a transforming schema', () => {
  assert.equal(literal('<b>'), '<b>');
  assert.equal(validate(z.string(), 'x'), 'x');
  assert.throws(() => validate(z.string().trim(), ' x '), /must not transform/);
  assert.throws(() => validate(z.string(), 42));
});

test('escape functions validate with z.string() by default, apply the given schema and use the kernel sanitizers', () => {
  assert.equal(escapeHtml(input), SAN.html(String(input)));
  assert.equal(escapeUrl('javascript:alert(1)'), SAN.url('javascript:alert(1)'));
  assert.equal(escapeScript('";alert(1)//'), SAN.script('";alert(1)//'));
  assert.throws(() => escapeHtml(['a', 'b']));
  assert.throws(() => escapeHtml(undefined));
  assert.throws(() => escapeHtml('abcd', z.string().max(3)));
  assert.equal(escapeHtml('abc', z.string().max(3)), 'abc');
});

test('send writes once, prefers send over end and sets Content-Type unless it is present', () => {
  const page = html('<p>x</p>');
  const headers: string[][] = [];
  let body = '';
  send({ send: b => { body = b; }, setHeader: (n, v) => headers.push([n, v]) }, page);
  assert.equal(body, '<p>x</p>');
  assert.deepEqual(headers, [['Content-Type', 'text/html; charset=utf-8']]);
  const ended: string[] = [];
  send({ end: b => ended.push(b), header: (n, v) => headers.push([n, v]) }, page);
  assert.deepEqual(ended, ['<p>x</p>']);
  assert.equal(headers.length, 2);
  send({ send: () => undefined, setHeader: () => { throw new Error('must not overwrite'); }, getHeader: () => 'text/plain' }, page);
  body = '';
  send({ send: b => { body = b; } }, page);
  assert.equal(body, '<p>x</p>');
});

test('unsafe escapes are the identity at run time', () => {
  for (const f of [unsafeHtml, unsafeText, unsafeScript, unsafeUrl, unsafeResourceUrl]) assert.equal(f('<x>'), '<x>');
});
