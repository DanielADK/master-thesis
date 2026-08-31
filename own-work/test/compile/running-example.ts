// The running example of parts/practical.tex; test/konfinace.test.ts runs the handlers.
import { z } from 'zod';
import { cat, h, parse, sanitize, send, type Res } from '../../src/index.ts';

export type Req = { query: Record<string, unknown> }; // request input is unknown (def:fragment)
type Handler = (req: Req, res: Res) => void;
export const routes = new Map<string, Handler>();
const app = { get: (path: string, handler: Handler): void => void routes.set(path, handler) };

// fig:vypocet (b): two calls added, the program compiles
app.get('/hledat', (req, res) => {
  const q = sanitize('html', parse(z.string().max(100), req.query.q));
  send(res, cat(cat(h('<h1>Výsledky pro: '), q), h('</h1>')));
});

// fig:vypocet (a), the commented-out line of the thesis listing
app.get('/zranitelne', (req, res) => {
  // @ts-expect-error TS2769: no overload of send accepts string | Str<'lit', 'html'>
  send(res, cat(cat(h('<h1>'), req.query.q as string), h('</h1>')));
});

// the handler from the beginning of sec:model
app.get('/puvodni', (req, res) => {
  // @ts-expect-error a template literal is a plain string
  send(res, `<h1>Výsledky pro: ${req.query.q}</h1>`);
});
