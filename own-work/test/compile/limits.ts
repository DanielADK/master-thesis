// Known holes. Everything here compiles; test/limits.test.ts shows the injection each one causes.
import { z } from 'zod';
import { cat, h, parse, sanitize, send, type Res, type SafeHtml, type Str } from '../../src/index.ts';

// sec:model-hranice, a response written in parts: each write is typed like send and passes on its own.
export interface Chunked { write: (chunk: string) => unknown }
function write(res: Chunked, h: Str<'lit', never>): void;
function write(res: Chunked, h: SafeHtml): void;
function write(res: Chunked, h: string): void {
  res.write(h);
}

export function chunked(res: Chunked, q: unknown): void {
  write(res, h('<div title='));
  write(res, sanitize('html', parse(z.string(), q)));
  write(res, h('>'));
}

// claim:adekvatnost, second half: tsc accepts each of these, yet each sends request input unsanitized.
// The comments name the rule of def:fragment that rejects them.
function isText(x: string): x is Str<'lit', never> {
  return x.length >= 0;
}
function assertText(x: string): asserts x is Str<'lit', never> {
  void x;
}
function launder(x: string): Str<'lit', never>;
function launder(x: string): string {
  return x;
}
const trust = <T>(x: unknown): T => x as T;
interface Sink { put(res: Res, x: string): void }
const htmlSink: Sink = { put: (res: Res, x: SafeHtml) => send(res, x) };
class Page { show(_res: Res, _x: string): void {} }
class HtmlPage extends Page { override show(res: Res, x: SafeHtml): void { send(res, x); } }

export const holes: Record<string, (res: Res, q: string) => void> = {
  // F3: parameters of a method signature are bivariant
  'interface method': (res, q) => htmlSink.put(res, q),
  // F4: casts to a safe type, a schema type or a type parameter, and what replaces them
  'type predicate': (res, q) => {
    if (isText(q)) send(res, q);
  },
  'assertion function': (res, q) => {
    assertText(q);
    send(res, q);
  },
  'overload signature': (res, q) => send(res, launder(q)),
  'cast to a type parameter': (res, q) => send(res, trust<SafeHtml>(q)),
  'cast of a schema': (res, q) => send(res, parse(z.string() as z.ZodType<'asc'>, q)),
  // F4: schemas whose output type is narrower than what they accept, h of a non-literal
  'z.custom': (res, q) => send(res, parse(z.custom<'asc'>(), q)),
  'refine with a type predicate': (res, q) => send(res, parse(z.string().refine((s): s is 'asc' => s.length >= 0), q)),
  'transform': (res, q) => send(res, parse(z.string().transform(s => s as 'asc'), q)),
  'h of a cast': (res, q) => send(res, h(q as '<b>')),
  // F4: widening of a value with a nested safe type
  'array covariance': (res, q) => {
    const safe: Str<'lit', never>[] = [];
    const plain: string[] = safe;
    plain.push(q);
    const first = safe[0];
    if (first !== undefined) send(res, first);
  },
  'object property': (res, q) => {
    const safe: { v: SafeHtml } = { v: h('') };
    const plain: { v: string } = safe;
    plain.v = q;
    send(res, safe.v);
  },
  'Map': (res, q) => {
    const safe = new Map<number, SafeHtml>();
    const plain: Map<number, string> = safe;
    plain.set(0, q);
    const v = safe.get(0);
    if (v !== undefined) send(res, v);
  },
  'Set': (res, q) => {
    const safe = new Set<SafeHtml>();
    const plain: Set<string> = safe;
    plain.add(q);
    for (const v of safe) send(res, v);
  },
  'Object.assign': (res, q) => {
    const safe = { v: h('') };
    Object.assign(safe, { v: q });
    send(res, safe.v);
  },
  'Object.defineProperty': (res, q) => {
    const safe = { v: h('') };
    Object.defineProperty(safe, 'v', { value: q });
    send(res, safe.v);
  },
  'Reflect.set': (res, q) => {
    const safe = { v: h('') };
    Reflect.set(safe, 'v', q);
    send(res, safe.v);
  },
  'class method override': (res, q) => {
    const page: Page = new HtmlPage();
    page.show(res, q);
  },
  // F4: never fits every sink, and an any value fixes a type argument without F1 noticing
  'cast to never': (res, q) => send(res, q as never),
  'narrowing to never': (res, q) => {
    const box: { v: number } = { v: 0 };
    const loose: { v: unknown } = box;
    loose.v = q;
    if (typeof box.v === 'string') send(res, box.v);
  },
  'never in a conditional': (res, q) => {
    const box: { v: number } = { v: 0 };
    const loose: { v: unknown } = box;
    loose.v = q;
    send(res, typeof box.v === 'string' ? box.v : h(''));
  },
  'any as a type argument': (res, q) => send(res, parse(z.string(), JSON.parse(JSON.stringify(q)))),
  // F4: a raw sink of Express (res.send)
  'raw sink': (res, q) => {
    res.send(q);
  },
};

// Why T-Out needs the overload pair: with one union parameter, each member of A | B may satisfy a
// different alternative, so the R3 pattern compiles.
function sendUnion(res: Res, h: Str<'lit', never> | SafeHtml): void {
  res.send(h);
}

export function unionSink(res: Res, q: unknown): void {
  sendUnion(res, cat(cat(h('<div title='), sanitize('html', parse(z.string(), q))), h('>')));
}
