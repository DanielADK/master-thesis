// examples/server.ts without sanitize. tsc rejects it, node strips the types and runs it anyway: XSS.
// node examples/unsafe.ts, then open http://localhost:3002/?q=<script>alert(1)</script>
import { createServer } from 'node:http';
import { z } from 'zod';
import { cat, h, parse, send, type Str } from '../src/index.ts';

createServer((req, res) => {
  const input: unknown = new URL(req.url ?? '/', 'http://localhost').searchParams.get('q') ?? '';
  const validated: Str<'lit' | 'val', never> = parse(z.string().max(100), input);
  const page = cat(cat(h('<h1>Výsledky pro: '), validated), h('</h1>'));
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  
  send({ send: body => { res.write(body); res.end(); } }, page);
}).listen(3002, () => console.log('http://localhost:3002/?q=<script>alert(1)</script>'));
