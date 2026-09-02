// examples/unsafe.ts fixed by one call: sanitize gives the input the html context, so send accepts the page.
// node examples/server.ts, then open http://localhost:3000/?q=<script>alert(1)</script>
import { createServer } from 'node:http';
import { z } from 'zod';
import { cat, h, parse, sanitize, send, type Str } from '../src/index.ts';

createServer((req, res) => {
  const input: unknown = new URL(req.url ?? '/', 'http://localhost').searchParams.get('q') ?? '';
  const validated: Str<'lit' | 'val', never> = parse(z.string().max(100), input);
  const sanitized: Str<'lit' | 'val', 'html'> = sanitize('html', validated);
  const page = cat(cat(h('<h1>Výsledky pro: '), sanitized), h('</h1>'));
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // One write: sending the parts separately is outside the guarantee.
  send({ send: body => { res.write(body); res.end(); } }, page);
}).listen(3000, () => console.log('http://localhost:3000/?q=<script>alert(1)</script>'));
