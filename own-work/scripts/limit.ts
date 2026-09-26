// Measures the scanner limit: compiles one template literal with the given numbers of tags.
// Run: npm run limit (1 900 and 2 000 tags) or node scripts/limit.ts 1000 1500.
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const dir = join(root, 'test', 'generated', 'limit');
for (const tags of process.argv.slice(2).map(Number)) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'tsconfig.json'), JSON.stringify({ extends: '../../../tsconfig.json', include: ['limit.ts'] }));
  const literal = '<p class="a">x</p>'.repeat(tags / 2);
  writeFileSync(join(dir, 'limit.ts'), `import { html } from '../../../src/index.ts';\nexport const page = html('${literal}');\n`);
  const r = spawnSync(join(root, 'node_modules', '.bin', 'tsc'), ['-p', dir], { encoding: 'utf8' });
  const code = /error (TS\d+)/.exec(`${r.stdout}${r.stderr}`)?.[1];
  console.log(`${tags} tags: ${r.status === 0 ? 'compiles' : (code ?? 'fails')}`);
  rmSync(dir, { recursive: true, force: true });
}
