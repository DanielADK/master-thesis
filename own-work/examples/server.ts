// examples/unsafe.ts fixed with the library. Run: node examples/server.ts, then open
// http://localhost:3000/?q=<script>alert(1)</script>&sort=asc
import { createServer } from 'node:http';
import { z } from 'zod';
import { escapeHtml, escapeUrl, html, send, validate, type SafeHtml } from '../lib/index.ts';

const ITEMS = ['Praha', 'Brno', 'Ostrava'];

createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const q = escapeHtml(url.searchParams.get('q') ?? '', z.string().max(100));
  const sort = validate(z.enum(['asc', 'desc']), url.searchParams.get('sort') ?? 'asc');
  const rows: SafeHtml[] = ITEMS.map(item =>
    html('<li><a href="/', escapeUrl(item), '" title="', escapeHtml(item), '">', escapeHtml(item), '</a></li>'));
  send(res, html(
    '<!doctype html><title>Hledání: ', q, '</title>',
    '<form><input name="q" value="', q, '"> <a href="?sort=', sort, '">', sort, '</a></form>',
    '<h1>Výsledky pro: ', q, '</h1><ul>', rows, '</ul>',
  ));
}).listen(3000, () => console.log('http://localhost:3000/?q=<script>alert(1)</script>&sort=asc'));
