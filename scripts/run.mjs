#!/usr/bin/env node
// Run every skill's commands against the live coordination layer. Every sh block of a SKILL.md is run, in order, as one
// bash script (set -euo pipefail), so a command an agent copies is a command this ran.
//   node scripts/run.mjs [skill ...] [--json out.json]
// Needs bash, curl, jq. TAIFOON_API_KEY: a free key (tfr_free_…); when unset, one is asked for once (POST /v1/register) and
// shared by every skill of the run. Writes are devnet only (36927); nothing here signs or pays.
import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { listSkills, readSkill, shBlocks } from './lib.mjs';

const args = process.argv.slice(2); const j = args.indexOf('--json'); const out = j >= 0 ? args[j + 1] : null;
const only = args.filter((a, i) => !a.startsWith('--') && (j < 0 || i !== j + 1));
const ids = listSkills().filter((d) => !only.length || only.includes(d));
const env = { ...process.env, NO_COLOR: '1' };
if (!env.TAIFOON_API_KEY) {
  const r = spawnSync('bash', ['-c', 'curl -sS -m 30 -X POST https://coord.taifoon.dev/v1/register -H "X-Taifoon-Client: taifoon-skills-ci" | jq -r ".api_key // empty"'], { encoding: 'utf8' });
  if (r.stdout.trim()) env.TAIFOON_API_KEY = r.stdout.trim(); else console.error('no TAIFOON_API_KEY and none could be registered (3 free keys a day per address): keyed steps will fail');
}
const redact = (s) => String(s).replace(/tfr_[A-Za-z0-9_-]{8,}/g, 'tfr_…');
const dir = mkdtempSync(join(tmpdir(), 'taifoon-skills-')); const results = [];
for (const id of ids) {
  const s = readSkill(id); const blocks = s ? shBlocks(s.body) : [];
  const file = join(dir, `${id}.sh`); writeFileSync(file, `set -euo pipefail\n${blocks.join('\n')}`);
  const t = Date.now(); const r = spawnSync('bash', [file], { encoding: 'utf8', env, timeout: 25 * 60_000, maxBuffer: 64 * 1024 * 1024 });
  const ok = r.status === 0; const ms = Date.now() - t;
  results.push({ skill: id, ok, blocks: blocks.length, commands: blocks.join('\n').split('\n').filter((l) => /^\s*(tf|curl|npx|jq|\(curl) /.test(l)).length, ms, error: ok ? null : redact((r.stderr || r.stdout || String(r.error ?? '')).trim().split('\n').slice(-6).join('\n')) });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${id.padEnd(24)} ${blocks.length} blocks  ${(ms / 1000).toFixed(1)} s${ok ? '' : `\n${results.at(-1).error.replace(/^/gm, '      ')}`}`);
}
const failed = results.filter((r) => !r.ok);
if (out) writeFileSync(out, JSON.stringify({ at: new Date().toISOString(), passed: results.length - failed.length, failed: failed.length, results }, null, 2) + '\n');
console.log(`\n${results.length - failed.length} of ${results.length} skills ran clean`);
process.exit(failed.length ? 1 : 0);
