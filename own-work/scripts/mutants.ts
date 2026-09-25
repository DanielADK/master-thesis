// Mutation check: each mutant breaks the realization at one place and runs npm test on its own copy.
// Run: npm run mutants (several minutes).
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export type Edit = { file: string; find: string; replace: string };
export type Mutant = { name: string; edits: Edit[] };

export const MUTANTS: Mutant[] = [
  { name: 'url sanitizer keeps javascript:', edits: [{ file: 'src/index.ts',
    find: 'const ok = SAFE_SCHEME.test(u) || !(SCHEME.test(u) || schemePrefix(u));', replace: 'const ok = true;' }] },
  { name: 'html sanitizer keeps quotes', edits: [{ file: 'src/index.ts', find: '/[&<>"\']/g', replace: '/[&<>]/g' }] },
  { name: 'html sanitizer keeps <', edits: [{ file: 'src/index.ts', find: '/[&<>"\']/g', replace: '/[&>"\']/g' }] },
  { name: 'script sanitizer keeps quotes', edits: [{ file: 'src/index.ts', find: '/[^\\w ,.-]/g', replace: '/[^\\w ,.\\-"\']/g' }] },
  { name: 'text allows < (the title finding)', edits: [
    { file: 'src/contexts.ts', find: "type TextBad = '\"' | \"'\" | '`' | '<';", replace: "type TextBad = '\"' | \"'\" | '`';" },
    { file: 'src/contexts.ts', find: 'const TEXT_BAD = /["\'`<]/;', replace: 'const TEXT_BAD = /["\'`]/;' }] },
  { name: 'scanner gives a handler attribute the text context', edits: [{ file: 'src/tpl.ts',
    find: "A extends `on${string}` ? Bad<Msg['handler']>", replace: "A extends `on${string}` ? 'text'" }] },
  { name: 'walk keeps the case of element names', edits: [{ file: 'src/tpl.ts',
    find: 'const n = name.toLowerCase();', replace: 'const n = name;' }] },
  { name: 'send accepts every string', edits: [{ file: 'src/index.ts',
    find: 'export function send(res: Res, h: SafeHtml): void; // html in K', replace: 'export function send(res: Res, h: string): void;' }] },
  { name: 'sanitize accepts level top', edits: [{ file: 'src/index.ts',
    find: "type Validated = Str<'lit' | 'val', never>;", replace: 'type Validated = string;' }] },
  { name: 'contexts of a union are their union', edits: [{ file: 'src/label.ts',
    find: '[V] extends [Inert<C>] ? C : never', replace: 'V extends Inert<C> ? C : never' }] },
  { name: 'every literal is html', edits: [{ file: 'src/contexts.ts',
    find: 'type Html<S> = S extends `${string}<${infer R}` ? TagOpen<R> : true;', replace: 'type Html<S> = true;' }] },
  { name: 'D(S) always grants text', edits: [{ file: 'src/contexts.ts',
    find: "| ([Text<O>] extends [true] ? 'text' : never);", replace: "| 'text';" }] },
];

type Step = { step: string; ok: boolean; files: string[] };

/** Runs one step in dir; `files` are the files its output blames. */
function run(dir: string, step: string, cmd: string, args: string[], pattern: RegExp): Step {
  const r = spawnSync(cmd, args, { cwd: dir, encoding: 'utf8', maxBuffer: 1 << 26 });
  const out = `${r.stdout ?? ''}\n${r.stderr ?? ''}`;
  const files = [...new Set([...out.matchAll(pattern)].map(m => m[1] ?? ''))].sort();
  return { step, ok: r.status === 0, files };
}

function main(): void {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const work = mkdtempSync(join(tmpdir(), 'own-work-mutants-'));
  const thesis = join(root, '..', 'parts', 'practical.tex');
  if (existsSync(thesis)) {
    mkdirSync(join(work, 'parts'));
    cpSync(thesis, join(work, 'parts', 'practical.tex'));
  }
  const tests = readdirSync(join(root, 'test')).filter(f => f.endsWith('.test.ts') && f !== 'mutants.test.ts').map(f => `test/${f}`);
  const rows: string[] = [];
  for (const [k, m] of MUTANTS.entries()) {
    const dir = join(work, `m${k + 1}`);
    cpSync(root, dir, { recursive: true, filter: src => !/node_modules|test\/generated/.test(src) });
    symlinkSync(join(root, 'node_modules'), join(dir, 'node_modules'), 'dir');
    for (const e of m.edits) {
      const path = join(dir, e.file);
      const src = readFileSync(path, 'utf8');
      if (src.split(e.find).length !== 2) throw new Error(`${m.name}: ${e.file} must contain the text once`);
      writeFileSync(path, src.replace(e.find, e.replace));
    }
    const steps = [
      run(dir, 'generate', 'node', ['scripts/generate.ts'], /^$/gm),
      run(dir, 'tsc', join(root, 'node_modules', '.bin', 'tsc'), ['-p', '.'], /^(\S+\.ts)\(\d+,\d+\): error TS/gm),
      run(dir, 'tests', 'node', ['--test', ...tests], /^test at (\S+\.ts):\d+:\d+$/gm),
    ];
    const caught = steps.filter(s => !s.ok).map(s => `${s.step}${s.files.length ? ` (${s.files.join(', ')})` : ''}`);
    const row = `${k + 1}. ${m.name}: ${caught.length ? `killed by ${caught.join('; ')}` : 'SURVIVED'}`;
    console.log(row);
    rows.push(row);
  }
  rmSync(work, { recursive: true, force: true });
  const survived = rows.filter(r => r.endsWith('SURVIVED')).length;
  console.log(`\n${MUTANTS.length} mutants, ${MUTANTS.length - survived} killed, ${survived} survived`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
