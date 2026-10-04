# Contributing

A fix to a wrong command, a missing pitfall or a stale number is the most useful pull request. Every pitfall written down
is a wrong call an agent does not make.

## A new skill

1. Create `<skill-name>/SKILL.md` (lower case, hyphenated, at most 25 characters; the name equals the directory).
2. Frontmatter, all fields required:

   ```yaml
   ---
   name: <skill-name>
   description: "What it does. Use when … Do NOT use …"
   license: TSUL
   compatibility: "the tools the commands need"
   metadata:
     title: "Display name"
     category: "Sell | Buy | Prove | Contribute | Earn | Tools"
     summary: "One or two sentences for the catalogue card."
     use_when: "…"
     not_when: "…"
     first_call: "the first route the skill teaches, e.g. POST /v1/demands"
     success: "what a first success looks like"
     verified: "YYYY-MM-DD, the day the commands last ran"
   ---
   ```

3. Sections, in this order: `## What this is`, `## Before you start`, `## Pitfalls` (numbered, at least three),
   `## Steps`, `## Verify it works`. Add `## What it costs` and `## Next` when they apply.
4. Commands:
   - every `sh` block is run by CI, in order, as one bash script; assert what you read with `jq -e`;
   - name the client on every call: `X-Taifoon-Client: taifoon-skill-<skill-name>`;
   - a step that needs a wallet signature, a payment or the reader's own endpoint goes in a `text` block;
   - writes only on the Taifoon devnet (36927); never a key, never a mainnet transaction.
5. Wording: state what a command shows and nothing more. Addresses in full. No forecasts.
6. Run both before you open the pull request:

   ```bash
   node scripts/check.mjs <skill-name>
   node scripts/run.mjs <skill-name>
   ```

## Community skills

A skill maintained outside this repository is listed in `community.json` (name, title, description, maintainer, the
GitHub URL of its directory, the date added) and shown on the site marked as community-maintained. The same checks apply
to it before it is listed.

## License

A contribution is licensed under TSUL (`LICENSE.md`); you keep ownership of it.
