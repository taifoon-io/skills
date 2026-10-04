#!/usr/bin/env node
// Validate every skill: frontmatter, structure and wording. Exit 1 with every problem listed.
//   node scripts/check.mjs [skill ...]
import { listSkills, readSkill, shBlocks, CATEGORIES, META_KEYS } from './lib.mjs';

const SECTIONS = ['## What this is', '## Before you start', '## Pitfalls', '## Steps', '## Verify it works'];
// wording the catalogue does not use: a shortened address, a client name that is not this skill's
const WORDING = [[/0x[0-9a-fA-F]{3,10}(…|\.\.\.)[0-9a-fA-F]{2,}/, 'an address is written in full']];

const only = process.argv.slice(2); const ids = listSkills().filter((d) => !only.length || only.includes(d));
const problems = [];
for (const id of ids) {
  const s = readSkill(id); const bad = (m) => problems.push(`${id}: ${m}`);
  if (!s) { bad('SKILL.md has no readable frontmatter'); continue; }
  const { meta, body } = s;
  if (meta.name !== id) bad(`name "${meta.name}" must equal the directory name`);
  if (!/^[a-z][a-z0-9-]{1,24}$/.test(id)) bad('the name is lower case, hyphenated, at most 25 characters');
  if (typeof meta.description !== 'string' || meta.description.length < 60 || meta.description.length > 1024) bad('description: 60 to 1024 characters');
  else { if (!/Use when /.test(meta.description)) bad('description says "Use when …"'); if (!/Do NOT use /.test(meta.description)) bad('description says "Do NOT use …"'); }
  if (meta.license !== 'TSUL') bad('license: TSUL');
  if (!meta.compatibility) bad('compatibility names the tools the commands need');
  for (const k of META_KEYS) if (!meta.metadata[k]) bad(`metadata.${k} is required`);
  for (const k of Object.keys(meta.metadata)) if (!META_KEYS.includes(k)) bad(`metadata.${k} is not a known field`);
  if (meta.metadata.category && !CATEGORIES.includes(meta.metadata.category)) bad(`category is one of ${CATEGORIES.join(', ')}`);
  if (meta.metadata.verified && !/^\d{4}-\d{2}-\d{2}$/.test(meta.metadata.verified)) bad('metadata.verified is the date the commands last ran (YYYY-MM-DD)');
  for (const h of SECTIONS) if (!body.includes(`\n${h}\n`)) bad(`section "${h}" is missing`);
  const pit = (/\n## Pitfalls\n([\s\S]*?)\n## /.exec(body) ?? [])[1] ?? '';
  if ((pit.match(/^\d+\. /gm) ?? []).length < 3) bad('at least three numbered pitfalls');
  const sh = shBlocks(body);
  if (!sh.length) bad('at least one sh block (every sh block is run by CI, in order, as one script)');
  if (sh.length && !sh.join('\n').includes(`taifoon-skill-${id}`)) bad(`the commands name their client: X-Taifoon-Client: taifoon-skill-${id}`);
  if (sh.length && !/jq -e /.test(sh.join('\n'))) bad('the commands assert what they read (jq -e)');
  if (s.text.split('\n').length > 500) bad('at most 500 lines');
  for (const [re, why] of WORDING) if (re.test(s.text)) bad(why);
}
if (problems.length) { console.error(problems.map((p) => `✗ ${p}`).join('\n')); console.error(`\n${problems.length} problem(s) in ${ids.length} skills`); process.exit(1); }
console.log(`✓ ${ids.length} skills pass the checks`);
