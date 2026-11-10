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

## 2. Load skills before you code

Before you write code, load every skill whose row matches the task. Load them yourself; the user won't name them. The `conduit-*` skills live in `.agents/skills/<name>/SKILL.md`. An agent without a Skill tool reads that file directly.

| When the task touches                                              | Load                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New files or folders, moved code, or a new feature                 | `conduit-structure`, `conduit-compponents`, `mattpocock-skills:codebase-design`                                                                                                                                                           |
| `packages/contract`, or oRPC procedures                            | `orpc-contract`                                                                                                                                                                                                                           |
| `apps/server/src`                                                  | `nestjs-best-practices`. The oRPC contract and Better Auth take precedence over its validation rules (`class-validator` DTOs, `ValidationPipe`), its auth rules (JWT, Passport), and its error rules (`HttpException`, exception filters) |
| Workspaces, members, invitations, or roles                         | `organization-best-practices`                                                                                                                                                                                                             |
| `apps/server/database/`, or a server request that fails with a 500 | `conduit-database`                                                                                                                                                                                                                        |
| React components, or a variant in `packages/ui`                    | `conduit-components`, `vercel-react-best-practices`, `vercel-composition-patterns`                                                                                                                                                        |
| A blocking-prerender or "uncached data" error                      | `next-cache-components-adoption`                                                                                                                                                                                                          |
| A new route, layout, or Suspense boundary, or a slow navigation    | `next-cache-components-optimizer`                                                                                                                                                                                                         |
| `<Link>` prefetching, or what a navigation shows before the click  | `next-partial-prefetching-optimizer`                                                                                                                                                                                                      |
| A change in `apps/client` that you are about to report as done     | `next-dev-loop`                                                                                                                                                                                                                           |

## 3. Repository workflow

- Open every PR against `staging`. A finished project lands on `main` through one final PR from `staging`.
- Write commit messages as conventional commits. commitlint rejects a body line of 100 characters or more.
- End your reply with the checks you ran and the checks you skipped. Signed-in flows need a session that agent browsers lack, so ask the user to check those.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
