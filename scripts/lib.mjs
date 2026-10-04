// Shared by check.mjs and run.mjs: read a skill directory. No dependencies.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const SKILLS_DIR = process.env.SKILLS_DIR || ROOT; // each skill is a directory at the repository root
export const CATEGORIES = ['Sell', 'Buy', 'Prove', 'Contribute', 'Earn', 'Tools'];
export const META_KEYS = ['title', 'category', 'summary', 'use_when', 'not_when', 'first_call', 'success', 'verified'];

export const listSkills = (dir = SKILLS_DIR) => readdirSync(dir).filter((d) => !d.startsWith('_') && statSync(join(dir, d)).isDirectory() && existsSync(join(dir, d, 'SKILL.md'))).sort();

const unq = (v) => { const s = v.trim(); return /^".*"$/.test(s) ? JSON.parse(s) : /^'.*'$/.test(s) ? s.slice(1, -1).replace(/''/g, "'") : s; };

/** the frontmatter subset a skill uses: top-level `key: value` lines and one `metadata:` map of `  key: value` lines */
export function parseSkill(text) {
  const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text);
  if (!m) return null;
  const meta = { metadata: {} }; let inMeta = false;
  for (const line of m[1].split('\n')) {
    if (!line.trim()) continue;
    const nested = /^  ([a-z_]+):\s*(.*)$/.exec(line); const top = /^([a-z_]+):\s*(.*)$/.exec(line);
    if (inMeta && nested) meta.metadata[nested[1]] = unq(nested[2]);
    else if (top) { inMeta = top[1] === 'metadata'; if (!inMeta) meta[top[1]] = unq(top[2]); }
    else return null;
  }
  return { meta, body: m[2] };
}
export const readSkill = (id, dir = SKILLS_DIR) => { const text = readFileSync(join(dir, id, 'SKILL.md'), 'utf8'); const p = parseSkill(text); return p ? { id, text, ...p } : null; };
/** every fenced sh block of a skill body, in order */
export const shBlocks = (body) => [...body.matchAll(/^```sh\n([\s\S]*?)^```$/gm)].map((x) => x[1]);
