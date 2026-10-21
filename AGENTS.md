# AGENTS.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 0. CodeGraph (required)

Index and query this repo through CodeGraph. Do this **before** Grep, Read, or Task-based code search. This overrides the CodeGraph MCP default that says not to run `init` yourself.

1. Find every index: any directory with `.codegraph/`.
2. Missing `.codegraph/` → `codegraph init <abs-path>`. Do not skip. Do not wait for the user.
3. For **each** index → `codegraph sync <abs-path>`. Do not query a stale graph. Re-sync after you write files in that tree.
4. Look up code with `codegraph_explore` (pass `projectPath` when not using the default index). Grep/Read only for configs, docs, generated files, or a detail the graph did not cover.

Do not start a session, a feature, or a bugfix by walking the tree with Grep/Read, only use them when codegraph fails.

## Browserbase access for coding agents

Use the installed `browse` CLI for Browserbase cloud-browser tasks while developing this repo. The key is in the git-ignored root `.env.local`; load only that value into the command's environment without printing it:

```powershell
$keyLine = Get-Content 'D:/dev/conduit/.env.local' | Where-Object { $_ -match '^BROWSERBASE_API_KEY=' } | Select-Object -Last 1
if (-not $keyLine) { throw 'Missing BROWSERBASE_API_KEY in .env.local' }
$env:BROWSERBASE_API_KEY = $keyLine.Substring('BROWSERBASE_API_KEY='.Length).Trim().Trim('"').Trim("'")
```

- Verify access with `browse cloud projects list` when authentication fails.
- Start with `browse open <public-url> --remote --session conduit --wait domcontentloaded`.
- Reuse the named session across calls. Inspect with `browse snapshot --session conduit`, then use current element refs with `browse click` / `browse fill`. Refresh the snapshot after navigation or page changes.
- Use `browse wait selector <selector> --state visible --session conduit` to wait for elements; do not use fixed sleeps.
- Use `browse status --session conduit` for the full session link and `browse cloud sessions list` to verify the run. Share full session URLs without truncating IDs.
- Close the session with `browse stop --session conduit` when the browser task ends to conserve browser time.
- Assume the Free plan: do not enable proxies, Verified, or CAPTCHA solving. Before trying protected or login-walled targets, explain the likely limitation and offer a public source or another target.
- Cloud browsers need a publicly reachable URL; local Conduit hosts require a tunnel or deployed preview.
- Ask before installing additional packages. Keep the API key out of tracked files, logs, and tool output.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
