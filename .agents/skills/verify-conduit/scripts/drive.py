#!/usr/bin/env python3
"""Launch, check, drive, and stop Conduit for verification. Run `python drive.py -h` for usage."""

import argparse
import datetime
import importlib.util
import json
import os
import re
import shutil
import signal
import subprocess
import sys
import time
import traceback
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
SKILL = Path(__file__).resolve().parents[1]
VERIFY = ROOT / ".verify"
INSTANCE = VERIFY / "instance.json"
ACCOUNT = VERIFY / "account.json"
STATE = VERIFY / "state.json"
SEED = VERIFY / "seed.json"
APP = "http://localhost:3000"
API = "http://localhost:3333"
PASSWORD = "Verify-pass-1A!"
NAV_TIMEOUT = 180_000  # the first compile of a route in `next dev` takes over a minute


def http_ok(url, expect=None):
    try:
        with urllib.request.urlopen(url, timeout=10) as response:
            body = response.read().decode("utf-8", "replace")
            return response.status == 200 and (expect is None or expect in body)
    except Exception:
        return False


def listener_pid(port):
    if os.name == "nt":
        out = subprocess.run(["netstat", "-ano", "-p", "TCP"], capture_output=True, text=True, encoding="utf-8", errors="replace").stdout
        for line in out.splitlines():
            parts = line.split()
            if len(parts) >= 5 and parts[1].endswith(f":{port}") and parts[3] == "LISTENING":
                return int(parts[4])
        return None
    out = subprocess.run(["lsof", "-ti", f"tcp:{port}", "-sTCP:LISTEN"], capture_output=True, text=True, encoding="utf-8", errors="replace").stdout
    return int(out.split()[0]) if out.strip() else None


def pid_alive(pid):
    if os.name == "nt":
        out = subprocess.run(["tasklist", "/FI", f"PID eq {pid}", "/NH"], capture_output=True, text=True, encoding="utf-8", errors="replace").stdout
        return str(pid) in out
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False


def read_instance():
    return json.loads(INSTANCE.read_text()) if INSTANCE.exists() else None


def pnpm():
    found = shutil.which("pnpm")
    if not found:
        sys.exit("pnpm is not on PATH")
    return found


def spawn(cmd, log):
    kwargs = {"cwd": ROOT, "stdout": open(log, "w"), "stderr": subprocess.STDOUT}
    if os.name == "nt":
        kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP
    else:
        kwargs["start_new_session"] = True
    return subprocess.Popen(cmd, **kwargs).pid


def cmd_launch(_args):
    VERIFY.mkdir(exist_ok=True)
    taken = {port: listener_pid(port) for port in (3000, 3333)}
    if any(taken.values()):
        mine = read_instance()
        if mine and all(pid_alive(pid) for pid in mine["pids"].values()):
            print(f"already running from this skill: {mine}")
        else:
            print(f"ports in use by another process {taken}: that is the user's dev server.")
            print("Drive it as is and never stop it. Run `doctor` to check it is usable.")
        return wait_ready()
    pids = {
        "server": spawn([pnpm(), "--filter", "server", "dev"], VERIFY / "server.log"),
        "client": spawn([pnpm(), "--filter", "client", "dev"], VERIFY / "client.log"),
    }
    INSTANCE.write_text(json.dumps({"pids": pids, "started": time.time()}, indent=2))
    print(f"started {pids}, logs in {VERIFY}")
    return wait_ready()


def wait_ready(timeout=300):
    deadline = time.time() + timeout
    api = app = False
    while time.time() < deadline and not (api and app):
        api = api or http_ok(f"{API}/auth/ok", '"ok":true')
        # Requesting /sign-in makes `next dev` compile it, so ready means a page renders, not only a port.
        app = app or (api and http_ok(f"{APP}/sign-in", "Sign in"))
        time.sleep(3)
    print(f"api ready: {api}, client ready: {app}")
    if not (api and app):
        print(f"not ready after {timeout}s; read {VERIFY / 'server.log'} and {VERIFY / 'client.log'}")
        return 1
    return 0


def cmd_doctor(_args):
    checks = []
    mine = read_instance()
    for name, port in (("server", 3333), ("client", 3000)):
        pid = listener_pid(port)
        if pid is None:
            owner = "nothing listening"
        elif mine and pid_alive(mine["pids"][name]):
            owner = f"pid {pid}, started by this skill (launcher {mine['pids'][name]})"
        else:
            owner = f"pid {pid}, not started by this skill: drive it, never stop it"
        checks.append((f"port {port} ({name})", pid is not None, owner))
    checks.append(("api /auth/ok", http_ok(f"{API}/auth/ok", '"ok":true'), f"{API}/auth/ok"))
    checks.append(("client renders /sign-in", http_ok(f"{APP}/sign-in", "Sign in"), f"{APP}/sign-in"))
    status = subprocess.run(
        [pnpm(), "exec", "prisma", "migrate", "status"],
        cwd=ROOT / "apps/server", capture_output=True, text=True, encoding="utf-8", errors="replace",
    )
    output = status.stdout + status.stderr
    up_to_date = status.returncode == 0 and "up to date" in output
    detail = "schema is up to date" if up_to_date else output.strip()[-400:]
    checks.append(("dev database migrations applied", up_to_date, detail))
    head = subprocess.run(["git", "rev-parse", "--short", "HEAD"], cwd=ROOT, capture_output=True, text=True, encoding="utf-8", errors="replace")
    checks.append(("checkout", True, head.stdout.strip()))
    for name, ok, detail in checks:
        print(f"{'ok  ' if ok else 'FAIL'} {name}: {detail}")
    return 0 if all(ok for _, ok, _ in checks) else 1


def kill_tree(pid):
    if os.name == "nt":
        subprocess.run(["taskkill", "/PID", str(pid), "/T", "/F"], capture_output=True)
    else:
        try:
            os.killpg(pid, signal.SIGTERM)
        except OSError:
            pass


def cmd_stop(args):
    mine = read_instance()
    if not mine:
        print("nothing started by this skill; leaving any running dev server alone")
        return 0
    # Other agent sessions drive the same instance; a run folder without report.md is a run still going.
    busy = [d.name for d in (VERIFY / "runs").glob("*")
            if not (d / "report.md").exists() and time.time() - d.stat().st_mtime < 900]
    if busy and not args.force:
        print(f"another run is still driving this instance: {busy}. Wait for its report.md, or pass --force.")
        return 1
    for name, pid in mine["pids"].items():
        kill_tree(pid)
        print(f"stopped {name} (pid {pid} and its children)")
    INSTANCE.unlink()
    for port in (3000, 3333):
        if listener_pid(port):
            print(f"warning: port {port} still has a listener; run doctor to see who owns it")
    print(f"evidence kept in {VERIFY / 'runs'}")
    return 0


class JourneyFailed(Exception):
    pass


class Run:
    """One verification run: a browser page, numbered screenshots, and report.md, all in one folder."""

    def __init__(self, page, folder):
        self.page = page
        self.folder = folder
        self.steps = []
        self.journey = None
        self.console_errors = []
        # A failed request logs a console error with no URL, so record the request itself instead.
        page.on("console", lambda m: m.type == "error" and not m.text.startswith("Failed to load resource")
                and self.console_errors.append(m.text))
        page.on("response", lambda r: r.status >= 400 and self.console_errors.append(
            f"{r.status} {r.request.method} {r.url.split('?')[0]} (journey {self.journey})"))
        page.on("pageerror", lambda e: self.console_errors.append(str(e)))

    def visit(self, url=None):
        """Goes to `url`, or reloads, and waits for the network to settle so React has hydrated before any fill."""
        if url:
            self.page.goto(url, timeout=NAV_TIMEOUT)
        else:
            self.page.reload(timeout=NAV_TIMEOUT)
        self.page.wait_for_load_state("networkidle", timeout=NAV_TIMEOUT)

    def shot(self, caption, full_page=False):
        n = len(self.steps) + 1
        slug = re.sub(r"[^a-z0-9]+", "-", f"{self.journey}-{caption}".lower()).strip("-")[:60]
        path = self.folder / f"{n:02d}-{slug}.png"
        self.page.screenshot(path=path, full_page=full_page)
        self.steps.append({"journey": self.journey, "caption": caption, "path": path, "url": self.page.url})
        return path

    def check(self, ok, what, fatal=True):
        """Records an observed fact. A false one fails the journey; `fatal=False` lets it go on to later steps."""
        self.steps.append({"journey": self.journey, "check": what, "ok": bool(ok)})
        if not ok and fatal:
            raise JourneyFailed(what)

    def failed(self, journey):
        return any(step.get("ok") is False for step in self.steps if step["journey"] == journey)

    def aria(self, name, locator=None):
        path = self.folder / f"{len(self.steps) + 1:02d}-{self.journey}-{name}.aria.txt"
        path.write_text((locator or self.page.locator("body")).aria_snapshot(), encoding="utf-8")
        return path


def mark_verified(email):
    script = SKILL / "scripts" / "mark-verified.mts"
    done = subprocess.run(
        [pnpm(), "exec", "tsx", str(script), email], cwd=ROOT / "apps/server", capture_output=True, text=True, encoding="utf-8", errors="replace"
    )
    return done.returncode == 0, (done.stdout + done.stderr).strip().splitlines()[-1:]


def journey_account(run):
    """Sign up, verify, sign in, and create a workspace. Saves the session for later journeys."""
    from playwright.sync_api import expect

    page = run.page
    tag = f"verify{int(time.time())}"
    email = f"delivered+{tag}@resend.dev"
    run.visit(f"{APP}/sign-up")
    page.get_by_label("Name").fill("Verify Bot")
    page.get_by_label("Email").fill(email)
    page.get_by_label("Password", exact=True).fill(PASSWORD)
    page.get_by_label("Confirm your password").fill(PASSWORD)
    page.get_by_role("checkbox", name="I agree to all Terms").click()
    run.shot("sign-up form filled")
    page.get_by_role("button", name="Create account").click()
    page.wait_for_url("**/verify-email**", timeout=NAV_TIMEOUT)
    run.shot("verify-email page after sign-up")
    run.check("verify-email" in page.url, f"sign-up for {email} lands on /verify-email")

    ok, out = mark_verified(email)
    run.check(ok, f"marked {email} verified in the dev database ({' '.join(out)})")

    run.visit(f"{APP}/sign-in")
    page.get_by_label("Email").fill(email)
    page.get_by_label("Password", exact=True).fill(PASSWORD)
    page.get_by_role("button", name="Sign in").click()
    page.wait_for_url("**/onboarding**", timeout=NAV_TIMEOUT)
    expect(page.get_by_text(f"Signed in as {email}")).to_be_visible(timeout=NAV_TIMEOUT)
    run.shot("onboarding after sign-in")
    run.check(True, "sign-in with the verified account reaches /onboarding")

    workspace = f"Verify {tag[6:]}"
    page.get_by_role("button", name="Create a workspace").click()
    page.get_by_label("Name").fill(workspace)
    run.shot("create workspace form")
    page.get_by_role("button", name="Create workspace").click()
    channel = f"all-verify-{tag[6:]}"
    opened = page.get_by_role("heading", name=channel, level=1)
    picker = page.get_by_role("heading", name="Choose a workspace")
    expect(opened.or_(picker)).to_be_visible(timeout=NAV_TIMEOUT)
    run.shot("after create workspace")
    run.check(opened.is_visible(), f"creating '{workspace}' opens its default channel #{channel}", fatal=False)
    if not opened.is_visible():
        # Recover through the picker so the later journeys still get a signed-in workspace.
        page.get_by_role("button", name=re.compile(re.escape(workspace))).click()
        expect(opened).to_be_visible(timeout=NAV_TIMEOUT)
        run.shot("default channel opened from the picker")
        run.check(True, f"picking '{workspace}' opens #{channel}")

    page.context.storage_state(path=STATE)
    ACCOUNT.write_text(json.dumps({"email": email, "password": PASSWORD, "workspace": workspace,
                                   "channel": channel, "created": time.time()}, indent=2))


def journey_message(run):
    """Send a message in the default channel and prove it persisted across a reload."""
    from playwright.sync_api import expect

    page = run.page
    run.visit(APP)
    box = page.get_by_role("textbox", name=re.compile(r"^Message #"))
    box.wait_for(timeout=NAV_TIMEOUT)
    text = f"verify message {int(time.time())}"
    box.click()
    box.type(text)
    run.shot("composer with typed message")
    page.keyboard.press("Enter")
    log = page.get_by_role("log")
    sent = log.get_by_role("article").filter(has_text=text)
    expect(sent).to_be_visible(timeout=30_000)
    # The article's name reads "<author>, sending" until the server stores it, then "<author>, <time>".
    expect(sent).not_to_have_accessible_name(re.compile("sending"), timeout=30_000)
    run.shot("message stored")
    run.visit()
    expect(page.get_by_role("log").get_by_role("article").filter(has_text=text)).to_be_visible(timeout=NAV_TIMEOUT)
    run.shot("message still there after reload")
    run.aria("log", page.get_by_role("log"))
    run.check(True, f"'{text}' is in the channel log after a reload")


def journey_channel(run):
    """Create a public channel from the sidebar and prove it persisted across a reload."""
    from playwright.sync_api import expect

    page = run.page
    run.visit(APP)
    page.get_by_role("button", name="Add channels").click(timeout=NAV_TIMEOUT)
    page.get_by_role("menuitem", name="Create a new channel").click()
    dialog = page.get_by_role("dialog", name="Create a channel")
    name = f"verify-{int(time.time())}"
    dialog.get_by_role("textbox", name="Name").fill(name)
    run.shot("create channel dialog")
    dialog.get_by_role("button", name="Create channel").click()
    page.wait_for_url("**/channels/**", timeout=NAV_TIMEOUT)
    expect(page.get_by_role("heading", name=name, level=1)).to_be_visible(timeout=NAV_TIMEOUT)
    run.shot("new channel open")
    run.visit()
    nav = page.get_by_role("navigation", name="Channels")
    expect(nav.get_by_role("link", name=name)).to_be_visible(timeout=NAV_TIMEOUT)
    run.shot("channel in sidebar after reload")
    run.check(True, f"#{name} is in the sidebar after a reload")


def journey_invite(run):
    """Invite a resend.dev address from Settings and prove the pending invitation is listed."""
    from playwright.sync_api import expect

    page = run.page
    invitee = f"delivered+invitee{int(time.time())}@resend.dev"
    run.visit(f"{APP}/settings")
    page.wait_for_url("**/settings/members", timeout=NAV_TIMEOUT)
    expect(page.get_by_role("table", name="Workspace members")).to_be_visible(timeout=NAV_TIMEOUT)
    run.shot("members page")
    page.get_by_role("button", name="Invite people").click()
    dialog = page.get_by_role("dialog", name=re.compile("^Invite people to"))
    dialog.get_by_role("textbox", name="Email addresses").fill(invitee)
    run.shot("invite dialog filled")
    dialog.get_by_role("button", name="Send invitations").click()
    expect(dialog.get_by_role("status")).to_contain_text(f"Sent 1 invitation to {invitee}", timeout=30_000)
    run.shot("invitation sent")
    dialog.get_by_role("button", name="Done").click()
    run.visit(f"{APP}/settings/invitations")
    row = page.get_by_role("table", name="Pending invitations").get_by_role("row").filter(has_text=invitee)
    expect(row).to_be_visible(timeout=NAV_TIMEOUT)
    run.shot("pending invitation listed")
    run.check(True, f"{invitee} is listed under Pending invitations after a fresh load")


def channel_link(name):
    """A sidebar channel link's accessible name, which reads "<name> , unread" while it has unread messages."""
    return re.compile(rf"^{re.escape(name)}( , unread)?$")


def journey_seed(run):
    """Sign in as the seeded viewer of a multi-member workspace with history, read from .verify/seed.json."""
    from playwright.sync_api import expect

    run.check(SEED.exists(), f"{SEED} names the seeded account (see SKILL.md, Seeded workspace)")
    seed = json.loads(SEED.read_text())
    sign_in_seeded(run, seed["email"], seed)
    run.shot("seeded workspace after sign-in")
    run.check(True, f"{seed['name']} signs in to {seed['workspace']}")


def sign_in_seeded(run, email, seed):
    from playwright.sync_api import expect

    page = run.page
    page.context.clear_cookies()
    run.visit(f"{APP}/sign-in")
    page.get_by_label("Email").fill(email)
    page.get_by_label("Password", exact=True).fill(seed["password"])
    page.get_by_role("button", name="Sign in").click()
    nav = page.get_by_role("navigation", name="Channels")
    # The sidebar first renders a "Workspace" placeholder and an empty list, so wait for the real names.
    expect(nav.get_by_role("button", name=seed["workspace"])).to_be_visible(timeout=NAV_TIMEOUT)
    expect(nav.get_by_role("link", name=channel_link(seed["channel"]))).to_be_visible(timeout=NAV_TIMEOUT)


def journey_catchup(run):
    """Catch the seeded viewer up on Activity. When nothing is unread, another seeded member posts first."""
    from playwright.sync_api import expect

    seed = json.loads(SEED.read_text())
    page = run.page
    run.visit(f"{APP}/activity")
    button = page.get_by_role("button", name=re.compile(r"^(Catch me up|You're all caught up)$"))
    expect(button).to_be_visible(timeout=NAV_TIMEOUT)
    if button.is_disabled():
        run.shot("nothing unread")
        sign_in_seeded(run, seed["poster"], seed)
        page.get_by_role("navigation", name="Channels").get_by_role("link", name=channel_link(seed["channel"])).click()
        box = page.get_by_role("textbox", name=f"Message #{seed['channel']}")
        text = f"Verification ping {int(time.time())}: the launch checklist is on track."
        box.click(timeout=NAV_TIMEOUT)
        box.type(text)
        page.keyboard.press("Enter")
        sent = page.get_by_role("log").get_by_role("article").filter(has_text=text)
        expect(sent).not_to_have_accessible_name(re.compile("sending"), timeout=30_000)
        run.shot("another member posts")
        run.check(True, f"{seed['poster']} posted an unread message for the viewer")
        sign_in_seeded(run, seed["email"], seed)
        run.visit(f"{APP}/activity")
    expect(page.get_by_role("button", name="Catch me up")).to_be_enabled(timeout=60_000)
    run.shot("catch me up enabled")
    page.get_by_role("button", name="Catch me up").click()
    dialog = page.get_by_role("dialog")
    expect(dialog).to_be_visible(timeout=60_000)
    expect(dialog).to_have_attribute("aria-busy", "false", timeout=120_000)
    run.shot("catch-up done")
    run.aria("catch-up-dialog", dialog)
    run.check(dialog.get_by_role("heading", name=re.compile("^What you missed")).is_visible(),
              "the catch-up finishes with a 'What you missed' heading")
    # A catch-up source shows a bare number until its message loads, then becomes "Source N in #room".
    source = dialog.get_by_label(re.compile(r"^Source \d+ in ")).first
    expect(source).to_be_visible(timeout=30_000)
    run.shot("catch-up sources resolved")
    source.click()
    expect(dialog).to_be_hidden(timeout=10_000)
    page.wait_for_url(re.compile(r"/(channels|dms)/"), timeout=NAV_TIMEOUT)
    run.shot("after following a catch-up source")
    run.check(True, "a catch-up source opens its own room")


def journey_summary(run):
    """Summarize the seeded channel's last 7 days and follow a cited source back to its message."""
    from playwright.sync_api import expect

    seed = json.loads(SEED.read_text())
    page = run.page
    channel = seed["channel"]
    page.get_by_role("navigation", name="Channels").get_by_role("link", name=channel_link(channel)).click(timeout=NAV_TIMEOUT)
    expect(page.get_by_role("heading", name=channel, level=1)).to_be_visible(timeout=NAV_TIMEOUT)
    page.wait_for_load_state("networkidle", timeout=NAV_TIMEOUT)
    # The header's copy of the actions button comes after the sidebar's, and only it carries the summary rows.
    page.get_by_role("button", name=f"Actions for #{channel}").last.click()
    page.get_by_role("menuitem", name="Summarize channel").hover()
    run.shot("summarize channel menu")
    page.get_by_role("menuitem", name="Last 7 days").click()
    dialog = page.get_by_role("dialog")
    expect(dialog.get_by_role("heading", name=re.compile(r"^Summary of \d+ messages?$"))).to_be_visible(timeout=60_000)
    run.shot("summary streaming")
    expect(dialog).to_have_attribute("aria-busy", "false", timeout=120_000)
    sources = dialog.get_by_role("button", name=re.compile(r"^Source \d+$"))
    run.shot("summary done")
    run.aria("summary-dialog", dialog)
    run.check(sources.count() > 0, f"the finished summary cites {sources.count()} source links")
    sources.first.click()
    expect(dialog).to_be_hidden(timeout=10_000)
    run.shot("after following a source")
    run.check(True, "following a source closes the dialog onto the conversation")


JOURNEYS = {"account": journey_account, "message": journey_message, "channel": journey_channel,
            "invite": journey_invite, "seed": journey_seed, "summary": journey_summary,
            "catchup": journey_catchup}


def load_script(path):
    spec = importlib.util.spec_from_file_location("verify_script", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.journey


def write_report(run, results, folder):
    head = subprocess.run(["git", "rev-parse", "--short", "HEAD"], cwd=ROOT, capture_output=True, text=True, encoding="utf-8", errors="replace")
    account = json.loads(ACCOUNT.read_text()) if ACCOUNT.exists() else {}
    lines = [
        f"# Conduit verification {folder.name}",
        "",
        f"- Checkout: `{head.stdout.strip()}`",
        f"- App: {APP}, API: {API}",
        f"- Test account: `{account.get('email', 'none')}`, workspace `{account.get('workspace', 'none')}`",
        "",
        "| Journey | Result |",
        "| --- | --- |",
        *[f"| {name} | {result} |" for name, result in results],
        "",
    ]
    current = None
    for step in run.steps:
        if step["journey"] != current:
            current = step["journey"]
            lines += [f"## {current}", ""]
        if "path" in step:
            lines += [f"![{step['caption']}]({step['path'].as_posix()})", f"*{step['caption']}* at `{step['url']}`", ""]
        else:
            lines += [f"- {'PASS' if step['ok'] else 'FAIL'}: {step['check']}", ""]
    if run.console_errors:
        lines += ["## Browser console errors", "", *[f"- `{e[:300]}`" for e in run.console_errors[:20]], ""]
    report = folder / "report.md"
    report.write_text("\n".join(lines), encoding="utf-8")
    return report


def cmd_run(args):
    from playwright.sync_api import sync_playwright

    unknown = set(args.journeys) - set(JOURNEYS)
    if unknown:
        sys.exit(f"unknown journeys {sorted(unknown)}; choose from {list(JOURNEYS)}")
    names = args.journeys or ([] if args.script else ["account", "message"])
    if args.script:
        names.append("script")
    if not args.reuse and names[0] not in ("account", "seed"):
        names.insert(0, "account")
    if args.reuse and not STATE.exists():
        sys.exit("--reuse needs a saved session; run the account journey first")
    folder = VERIFY / "runs" / datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    folder.mkdir(parents=True)
    results = []
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=not args.headed)
        context = browser.new_context(viewport={"width": 1440, "height": 900},
                                      storage_state=STATE if args.reuse else None)
        run = Run(context.new_page(), folder)
        for name in names:
            run.journey = name
            journey = load_script(args.script) if name == "script" else JOURNEYS[name]
            try:
                journey(run)
                results.append((name, "FAIL" if run.failed(name) else "PASS"))
            except Exception as error:
                run.steps.append({"journey": name, "check": f"{type(error).__name__}: {str(error)[:400]}", "ok": False})
                try:
                    run.shot("state at failure")
                except Exception:
                    pass
                (folder / f"{name}-traceback.txt").write_text(traceback.format_exc(), encoding="utf-8")
                results.append((name, "FAIL"))
                if name in ("account", "seed"):
                    results += [(rest, "SKIPPED: no signed-in account") for rest in names[1:]]
                    break
        browser.close()
    report = write_report(run, results, folder)
    for name, result in results:
        print(f"{result:<6} {name}")
    print(f"report: {report}")
    return 0 if all(result == "PASS" for _, result in results) else 1


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("launch", help="start the API and client unless a dev server already runs, then wait until usable")
    sub.add_parser("doctor", help="read-only: ports, owner, health, migrations, checkout")
    stop = sub.add_parser("stop", help="stop only what launch started; evidence stays")
    stop.add_argument("--force", action="store_true", help="stop even while another run is in progress")
    run = sub.add_parser("run", help="drive journeys and write .verify/runs/<stamp>/report.md")
    run.add_argument("journeys", nargs="*", help=f"from {list(JOURNEYS)}; default: account message")
    run.add_argument("--script", help="a .py file defining journey(run), driven after the named journeys")
    run.add_argument("--reuse", action="store_true", help="reuse the last account's session instead of signing up")
    run.add_argument("--headed", action="store_true")
    args = parser.parse_args()
    sys.exit({"launch": cmd_launch, "doctor": cmd_doctor, "stop": cmd_stop, "run": cmd_run}[args.command](args))


if __name__ == "__main__":
    main()
