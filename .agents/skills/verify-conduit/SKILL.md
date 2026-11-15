---
name: verify-conduit
description: Launch Conduit (Next.js client on :3000, Nest API on :3333), drive it in a real Chromium as a signed-in test user, and report the result with screenshots. Use to prove a change in apps/client or apps/server works for a user, to reproduce a UI bug, or whenever the user asks to verify, check, screenshot, or "show me" the app.
---

# Verify Conduit

Conduit is a team chat app. A user signs up, creates or joins a workspace, and talks in channels and DMs. Verify on that surface: the web UI at `http://localhost:3000`. The API at `http://localhost:3333` is checked only as a side effect of what the UI does.

Every helper below is `.agents/skills/verify-conduit/scripts/drive.py`, run with `python` from the repository root. Python Playwright and its Chromium are installed globally. If `import playwright` fails, tell the user and stop. Do not install packages without asking.

## Report with screenshots (required)

Every run writes `.verify/runs/<stamp>/report.md`, with a journey table, each check as PASS or FAIL, and every screenshot embedded as an absolute path. When you report to the user, include those screenshots. Embed each one in your reply as `![caption](D:/dev/conduit/.verify/runs/<stamp>/NN-name.png)`, copying the lines from `report.md`. Give at least the screenshot of the action and the screenshot of the resulting state for each journey, plus every `state at failure` shot. Also link `report.md` by its absolute path. A verification reply without screenshots is incomplete.

## Launch

```bash
python .agents/skills/verify-conduit/scripts/drive.py launch
```

- When ports 3000 and 3333 are free, it runs `pnpm --filter server dev` and `pnpm --filter client dev`. It records their PIDs in `.verify/instance.json` and logs to `.verify/server.log` and `.verify/client.log`.
- Ready means `GET :3333/auth/ok` returns `{"ok":true}` and `GET :3000/sign-in` renders the sign-in page. The first compile of each Next route takes 60 to 90 seconds, so launch waits up to 5 minutes, and every navigation in the driver allows 3 minutes.
- When either port is taken, launch does not start a second copy. Both apps use fixed ports, the client has `http://localhost:3333` baked in, and the database is shared, so two instances cannot run side by side. A process that this skill did not start is the user's dev server. Drive it as it is and never stop it.
- There is no local database. `DATABASE_URL` in `apps/server/.env` is the developer's shared Neon dev database, so it is already migrated and holds real data. Every journey creates its own account and workspace, so a run never touches anyone else's rows.

## Doctor

```bash
python .agents/skills/verify-conduit/scripts/drive.py doctor
```

This check is read-only. It reports who owns each port (this skill or the user), checks API and client health, runs `prisma migrate status` against the dev database, and prints the checkout's commit. Run it first, and run it again whenever a journey fails in a way that looks environmental. If a migration is pending, report it to the user and ask before you apply it (see `conduit-database`). A pending migration shows up as 500s on every channel request.

## Drive

```bash
python .agents/skills/verify-conduit/scripts/drive.py run                      # account + message
python .agents/skills/verify-conduit/scripts/drive.py run account channel invite
python .agents/skills/verify-conduit/scripts/drive.py run --reuse message      # reuse the last account's session
python .agents/skills/verify-conduit/scripts/drive.py run --reuse --script my_check.py
python .agents/skills/verify-conduit/scripts/drive.py run seed summary catchup # the seeded workspace
python .agents/skills/verify-conduit/scripts/drive.py run --headed ...         # watch the browser
```

Built-in journeys:

- `account` signs up `delivered+verify<ts>@resend.dev`, marks it verified, signs in, and creates a workspace. It saves the session to `.verify/state.json` and the account to `.verify/account.json`. Without `--reuse`, every run starts with it.
- `message` sends a message in the default channel and reloads the page to prove the server stored it.
- `channel` creates a public channel from the sidebar and reloads the page to prove it persisted.
- `invite` invites a `delivered+invitee<ts>@resend.dev` address from Settings and finds it under Pending invitations.
- `seed` signs in as the seeded workspace's viewer instead of creating an account. Put it first: `run seed summary catchup`.
- `summary` summarizes the seeded channel's last 7 days with the live model and follows a source back to its message.
- `catchup` runs Catch me up on `/activity`. When nothing is unread, it first posts as a second seeded member.

## Seeded workspace

A fresh `account` workspace has one member, no history, and AI off. Features that need more, such as AI summaries, mentions, threads, and unread state, use a seeded workspace that already exists in the dev database:

- **Northwind Studio** (slug `northwind-11142058`) has AI on and three verified members. The members are Mai Tran (owner, the viewer), Linh Pham, and Arjun Rao, with emails `delivered+conduit-{viewer,linh,arjun}-11142058@resend.dev`.
- `#launch` holds the seeded messages, two mentions of Mai, and a two-reply thread, plus whatever later runs posted.
- The sign-in details live in `.verify/seed.json`, which is git-ignored, so the password never reaches the repository. Its keys are `email`, `password`, `name`, `workspace`, `channel`, and `poster`. All three members share the password. If the file is missing, the `seed` journey fails and says so. Ask the user for the password. Never reset it in the database.
- Treat the seeded rows as shared fixtures. Read them, and add messages through the UI as the journeys do. Never edit or delete them.

For the feature you just changed, write a journey script and pass it with `--script`. It gets the same browser, screenshots, and report:

```python
import re
from playwright.sync_api import expect

def journey(run):
    page = run.page                     # signed in to the account's workspace, viewport 1440x900
    run.visit("http://localhost:3000/")  # goto, then wait for hydration
    box = page.get_by_role("textbox", name=re.compile(r"^Message #"))
    box.click()
    box.type("**bold** check")
    run.shot("composer before send")    # numbered PNG plus a report entry
    page.keyboard.press("Enter")
    pending = page.get_by_role("log").get_by_role("article").filter(has_text="bold check")
    expect(pending).not_to_have_accessible_name(re.compile("sending"), timeout=30_000)  # stored, not optimistic
    run.visit()                          # reload
    sent = page.get_by_role("log").get_by_role("article").filter(has_text="bold check")
    expect(sent.locator("strong")).to_have_text("bold")
    run.shot("bold message after reload")
    run.check(sent.count() == 1, "the message renders bold after a reload")  # False raises and fails the journey
    run.aria("log", page.get_by_role("log"))                                  # ARIA snapshot to a .aria.txt file
```

Navigate with `run.visit(url)` and reload with `run.visit()`, never with a bare `page.goto`. On a freshly compiled route, text typed before React hydrates is wiped, and the form then fails validation ("Invalid email address"). `run.visit` waits for the network to go idle first.

Pass `fatal=False` to `run.check` when a wrong result should still let the journey continue. The journey then reports FAIL, but its later steps run.

Pick handles from `features/` first. For anything not there, read the live accessibility tree with `print(page.locator("body").aria_snapshot())` and use `get_by_role` with the accessible name. The app labels its controls, so role plus name is stable. Do not use CSS classes, nth-child, or coordinates. `page.locator("main")` matches two elements on settings pages, so use `get_by_role("main").last`.

## Evidence

- Proof uses the real user path: the UI, a real account, and real requests. Do not call oRPC procedures or write Prisma rows to fake the state you are testing. The one sanctioned shortcut is marking the test email verified, because AGENTS.md prescribes it and no inbox is reachable.
- Capture the action and the result. Take a screenshot before the click that matters and another of the state it produced. Don't capture only the final screen.
- Prove side effects with a second, independent view. Reload the page, or open the page that lists the thing, and assert it is there. "The toast appeared" is not proof that a row was stored.
- A journey fails on any false check. Never loosen a check to make a run pass. If the app is wrong, the journey stays red and the report says why.
- `report.md` ends with "Browser console errors". That section lists every response with status 400 or higher as `status method path (journey)`, plus page errors. A new entry there after your change is evidence even when every check passed. The 403s and 400s right after sign-in are known (see `features/account-onboarding.md`).
- Everything lands in `.verify/runs/<stamp>/`: numbered PNGs, `.aria.txt` snapshots, `<journey>-traceback.txt` on failure, and `report.md`. `.verify/` is git-ignored.

## Cleanup

```bash
python .agents/skills/verify-conduit/scripts/drive.py stop
```

`stop` kills only the process trees that `launch` recorded in `.verify/instance.json`. If launch reused the user's server, there is nothing to stop. Other agent sessions may be driving the same instance. A run folder with no `report.md`, modified in the last 15 minutes, is a run still in progress, and `stop` refuses while one exists. Wait for that run to finish. Pass `--force` only if the run is dead. Never kill by process name or by port. `stop` leaves `.verify/runs/` alone, so the evidence survives, and it prints that path.

Test data stays in the shared dev database. AGENTS.md asks you to list it, so end your reply with the emails and workspaces the run created. They are in `report.md` and `.verify/account.json`.

## Helpers

- `scripts/drive.py` runs `launch`, `doctor`, `run`, and `stop`. `python drive.py -h` lists the flags.
- `scripts/mark-verified.mts` sets `emailVerified` for one `@resend.dev` user in the dev database. The `account` journey calls it. To run it yourself: `cd apps/server && pnpm exec tsx ../../.agents/skills/verify-conduit/scripts/mark-verified.mts delivered+<tag>@resend.dev`. It refuses any email outside `@resend.dev`.

## Feature map

`features/README.md` indexes one recipe per user-facing feature. Read it before you drive. A proof that drives one entry point is incomplete when the map lists others. When the app changes, update the map with `/pstack:maintain-verification-skill`.
