---
name: daily-triage
description: Run Block 1 (morning triage) and Block 2 (standup) of the QE-964 QA daily checklist — read the automation Slack channels, compute streaks and flakiness, map failing tests to files in qa-automation, suggest ENV/APP-BUG/SCRIPT labels, and draft the standup and log row. Use when the user says "morning triage", "run daily", "block 1", "standup", or calls /daily-triage.
---

# Daily triage — Block 1 + Block 2

Scripts do the mechanical work (parsing, streaks, percentages, file mapping, drafts). **You do the
judgement** (read logs, classify, write tickets). **The user approves anything that leaves this
machine.**

Working dir: `c:\Gravity\qa-checking`. Test repo: `c:\Gravity\qa-automation` (read-only).

## The whole morning

```bash
node tools/bin/daily.js            # phase 1 — ingest, report, and what needs a decision
#   ↓ classify each failure (Step 4), the only part that needs judgement
node tools/bin/daily.js --finish   # phase 2 — root cause, rebuild, list what is ready to post
#   ↓ post the approved replies, record each reply ts
node tools/bin/daily.js --close    # phase 3 — sign off, check coverage
```

Three commands, three stops. The stops are where a person is required: deciding a category,
approving a message, confirming the day is done. Everything between them is mechanical.

Two dependencies used to break silently and are now inside a phase: **classification must happen
before `/script-rca`** (which only looks at tests already labelled SCRIPT), and **`report.js` must
run again afterwards** or the files in `posts/` still show the old state.

## What QE-964 actually measures

**Every red run gets a classification reply in its own Slack thread within 1 business day.** Not
every test, not every day — every *red run*. Green runs get nothing: there is no failure to
classify. The acceptance criteria are 3 consecutive weeks of that with zero stragglers at each
weekly checkpoint, verified from the Slack thread timestamps.

Each failure in the reply gets one of three categories, and each category owes something:

| Category | Owes |
|---|---|
| **ENV** — the environment broke | the environment condition, in one line |
| **APP-BUG** — the product is wrong | a PRO ticket, linked |
| **SCRIPT** — our test is wrong | a fix-or-quarantine decision |

A reply is held back until every failure has a category and every category has what it owes.
Posting one with blanks is worse than posting nothing — it looks triaged.

**It is a *daily* habit, so there is a message every working day** — one per channel **and** per
suite, never merged. Smoke and regression are separate CI jobs in the same channel and get separate
messages. A suite that ran clean still gets a short "checked, all green" note: from outside the
channel, "all green" and "nobody looked" are indistinguishable. Weekends produce nothing.

```bash
node tools/bin/triage-log.js              # every red run and where it stands against the clock
node tools/bin/triage-log.js --today      # today's coverage, channel × suite — including gaps
node tools/bin/triage-log.js --overdue    # what has missed, or is about to
node tools/bin/triage-log.js --weeks 3    # the acceptance-criteria checkpoint
```

## Two rules that shape everything

**Smoke and regression are separate.** One Slack channel posts both. A green smoke run does not
make the channel healthy when the regression run failed 16 tests. Every number — latest run,
fully-green %, flakiness, smoke accuracy — is per suite (channel × smoke/regression), and a red run
in one suite never gets answered in the other suite's thread.

**Only runs since the last sign-off are triaged.** A Slack pull reaches back days. Each suite
carries a checkpoint; the window is everything after it. Older runs stay in the history for
streaks but are not re-triaged. A failure still red but not re-run in the window is marked
_carried over_, not presented as new.

## Arguments

| Argument | Effect |
|---|---|
| `--channels <key[,key]>` | Override the config. Keys: `web-prod`, `web-testnet`, `web-staging`, `mobile-testnet`, `manual-automation` |
| `--date <YYYY-MM-DD>` | Read `data/raw/<date>/`, write `reports/<date>/`, evaluate **as of 23:59 that day** |
| `--window <n>` | Runs per suite in the health table (default 20) |

Pass the same arguments to `ingest.js` and `report.js`. With none, the four daily channels and
today. A past date reports only on data already ingested — if `data/raw/<date>/` is missing, say so
rather than producing an empty report, or pull that history now and ingest it (state accumulates,
back-filling is safe).

---

## Step 0 — Prep (only when the repo moved)

```bash
git -C c:/Gravity/qa-automation pull
node tools/bin/index-tests.js
```

## Step 1 — Pull Slack

Four channels daily. `#qa-manual-automation` only when asked for by name — it takes ad-hoc
`workflow_dispatch` runs, so its streaks are not a baseline.

| key | channel_id | channel |
|---|---|---|
| web-prod | C083HQRCGR3 | #qa-web-automation-prod |
| web-testnet | C07KPL4CUAC | #qa-web-automation-testnet |
| web-staging | C07QWGUE2G6 | #qa-web-automation-staging |
| mobile-testnet | C0ANDUMDZU2 | #qa-mobile-automation-testnet |
| manual-automation | C0BJ6L6E44A | #qa-manual-automation _(on request)_ |

`mcp__claude_ai_Slack__slack_read_channel`, `limit: 12`, `response_format: "detailed"` (required —
concise drops the timestamps). Write `messages` **verbatim** to `data/raw/<date>/<key>.txt`; the
parser needs the `✘` lines, the `=== Message from ... ===` headers and the `Message TS:` lines. No
new messages: still write the file, it gets flagged SILENT.

## Step 2 — Jira snapshot

`mcp__claude_ai_Atlassian__searchJiraIssuesUsingJql`, cloudId `56c14758-cc74-4db5-9e9f-40da67731510`,
jql `key in (QE-935, QE-948, QE-949, QE-965, QE-966) OR (project = QE AND assignee = currentUser() AND statusCategory != Done)`,
fields `["summary","status","duedate","created","priority"]`.

Write `data/jira-snapshot.json` as `{fetchedAt, issues:[{key, summary, status, duedate, created, daysSinceCreated, priority}]}`.
Compute `daysSinceCreated` yourself — anything over 2 days in "To Do" gets flagged.

## Step 3 — Phase 1: ingest and report

```bash
node tools/bin/daily.js [--channels ...] [--date ...]
```

One command: ingest → report → yesterday's unanswered red runs → fixes still open → **what needs a
decision**. It stops there, at the judgement. `--date` is only for rebuilding a past day from data
already ingested; leave it off for today.

The last section is the one that matters. It lists every failure with no category **across the red
runs still waiting for a reply** — not just today's, because an unanswered reply from Saturday is
still blocked by its own uncategorised failures.

`reports/<date>/triage.md` is your working copy:

| Section | Contents |
|---|---|
| 1.1 | Suite status (one row per channel × suite), review window, failure split, smoke-accuracy verdict |
| 1.2 | Classification per channel — one row per test, ENV collapsed to one row per cluster, plus a **Flaky or genuine?** column and evidence blocks for anything unclassified |
| 1.3 | SCRIPT detail, **Prevention mandatory** |
| 1.4 | APP-BUG detail |
| 1.5 | ENV clusters |
| 1.6 | Numbers for the daily log |

What the report enforces, and will flag at you:

- `Action` is exactly one of: Fix · Quarantine · Raise PRO · Monitor (ENV).
- Every row needs an owner and an ETA. Without them it is unfinished triage — say so.
- A SCRIPT failure on a smoke suite prints **BREACHED** and must be named in the standup.
- A quarantine with no ticket and no review date is a deleted test.
- A fix with no prevention step is a fix that comes back.

If a suite shows more runs to review than the Slack pull could have held, the window has a gap —
raise `limit`, pull again, re-ingest.

## Step 4 — Flaky test, or a real product issue?

The first question for every failure. 1.2 gives the leaning and the evidence; **you decide**.

| Pattern | History | Usually |
|---|---|---|
| flaky pattern | passed and failed over the same period | **our test** — the product does not change between two runs ten minutes apart |
| fails every run | red every run, never passing | **something really changed** |
| one browser only | fails on one browser, passes elsewhere | ambiguous: a browser-specific defect and a locator that only matches elsewhere look identical |
| first failure | clean until now, failed once | not a pattern — but this is how a regression starts |
| too early to say | under 3 runs | say exactly that; do not classify on one data point |

`fails every run` **plus a commit to the test file just before the streak started** is ours, not the
product's. The tool names the commit — read that diff first.

Gather evidence before deciding:

- **Log:** `gh run view <runId> --log-failed -R gravity-technologies/qa-automation` (printed under each failure).
- **Web:** open the test at the reported `file:line`, then the page object it imports — that is where most script defects live.
- **Mobile:** BrowserStack MCP — `listBuildId` → `getBuildId` → `getFailureLogs` / `fetchRCA`.
- **Suspected product bug:** reproduce by hand with the Playwright MCP. Only call it `APP-BUG` once you have reproduced it or the log states it plainly.

| Label | When | Then |
|---|---|---|
| `ENV` | infra failure: zero passes, timeout, RPC/wallet/network error | Do **not** touch the script |
| `APP-BUG` | a product defect you can reproduce | Step 6 |
| `SCRIPT` | the test is wrong, flaky or obsolete | Step 5 |

**Never label something SCRIPT because it is inconvenient.** If you cannot say why the test is
wrong, it is unclassified — saying so is the honest answer. A failure written off as flaky is how a
real bug reaches users.

```bash
node tools/bin/classify.js --test "<title>" --channel <key> --label <ENV|APP-BUG|SCRIPT> \
  --note "<one sentence>" --owner <name> --eta <YYYY-MM-DD> [--ticket PRO-xxxx] [--quarantine]

# APP-BUG also needs the fields the bug message is built from:
node tools/bin/classify.js --test "..." --label APP-BUG --ticket PRO-1234 --owner viet --eta 2026-08-20 \
  --team fe --severity High --impact "signup blocked for invited users" \
  --evidence <url> --repro "1. ... 2. ..." [--prod-leak]
```

Ask for owner and ETA — never invent them. `--incomplete` lists what is still missing; `--pending`
what is still unlabelled. Anything red 5+ runs with no ticket and no quarantine **must not roll
over to tomorrow**.

## Step 5 — Flaky: root cause it, then track the fix

A label with no root cause is a nicer way of ignoring it.

1. `/script-rca` — finds the cause and proposes the code change.
2. `node tools/bin/script-rca.js --record --test "..." --cause <...> --action fix --prevention "..."`
3. Track it until it is really fixed:

```bash
node tools/bin/track.js --overdue                         # past ETA, unowned, merged-but-still-red
node tools/bin/track.js --test "..." --channel <key> --status in-review --pr <url>
node tools/bin/track.js --test "..." --channel <key> --verify --run <runId>
```

`--verify` **refuses to close anything still red** — a merged PR is not a fix, a green run is. Say
that plainly if asked to mark it done anyway.

**Run `--overdue` every morning before looking at today's failures.** Yesterday's unfixed decision
matters more than today's new one, and it is what rots silently.

## Step 6 — Genuine: raise a task, then say so publicly

Both, always. Doing only the first is how bugs sit unnoticed.

**Task.** `reports/<date>/tasks/` holds a draft per APP-BUG with no ticket. Fill the gaps it marks,
then — **only after the user confirms** — `mcp__claude_ai_Atlassian__createJiraIssue` (project
`PRO`, type `Bug`). Record the key immediately with `classify.js --ticket <KEY>`, or tomorrow's
report drafts it again.

**Message.** `posts/2.2-*.md`, one per bug, into the failing run's thread with the owning team
@-mentioned. It must carry: what a person sees (not what the assertion says), **the impact** (who
is affected, which flow, is it live), **the next steps** (who confirms, who owns it, when QA
re-checks), and the evidence link. Missing ticket / team / impact / evidence → marked ⚠️ incomplete
and not sent. Never merge two bugs into one message.

## Step 7 — Phase 2: root cause and rebuild

```bash
node tools/bin/daily.js --finish [--channels ...] [--date ...]
```

Runs `/script-rca` over everything now labelled SCRIPT, rebuilds the report and every message, and
prints what is ready to post versus what is held back and why. **Run it only after Step 4–6** — it
is the step that turns decisions into messages, and it is worthless before the decisions exist.

`reports/<date>/standup.md` then holds: **2.1** standup post · **2.2** one message per bug ·
**2.3** gap analysis (QE-965) · **2.4** escalation. Hand over `log-row.md` for the checklist log.

## Step 8 — Report back, then post

**Use the format's own section numbers. Do not invent headings.** No "Where the day landed", no
"Two things you should know" — the user reviews section by section and posts section by section.

```
1.1 Suites      — <per channel × suite: pass/total · green? · smoke accuracy>
                  <review window: n runs since <when>>
1.2 Classified  — <n rows: ENV a / APP-BUG b / SCRIPT c · m incomplete>
                  <x lean flaky · y lean genuine · z need a look>
1.3 SCRIPT      — <n blocks · what is missing>
1.4 APP-BUG     — <n blocks, or "none">
1.5 ENV         — <n clusters covering m tests>
1.6 Numbers     — <flakiness · failures with no verdict>
2.1 Standup     — ready / blocked on <what>
2.2 Dev message — <n ready, m incomplete and why>
2.3 Gap         — <recorded / nothing to record>
2.4 Escalate    — <what crossed the bar, or "nothing"> · not posted, raise it yourself
Red-run SLA     — <n overdue past 1 business day · m still inside the window>
Coverage today  — <n suites all-green · m answered · k with no run at all>
Tracker         — <n fixes open, m overdue>
Tasks           — <n ticket drafts waiting, or "none">
```

Then list what is ready to post with its destination, and **stop**. Ask which to send.

On approval:

- `slack_send_message_draft` by default; `slack_send_message` only on "send it".
- Post the body exactly, minus the `<!-- -->` headers.
- **One reply per red run** — `posts/thread-<channel>-<suite>-<date>-<HHMM>.md`, posted into that
  run's own thread with the `thread_ts` in its header. Never merge two runs into one reply.
  **Never post `triage.md` or anything in `records/`.**
- **One daily note per clean suite** — `posts/daily-<channel>-<suite>-<date>.md`, into the thread of
  that suite's last run of the day. If the suite did not run at all, it goes to the channel as a new
  message saying so — silence is a finding, not a pass. Ad-hoc suites that do not run most days are
  skipped rather than flagged.
- **2.2 is one message per *ticket*, not per failing test.** Seven tests knocked out by PRO-8937 is
  one thing for the FE team to act on; seven near-identical messages get muted, and muting is how
  the next real one is missed.
  - Named one channel? Send that channel's replies only.
  - No `thread_ts` in the header means no run was found: ask which message to reply to.
- **Log every reply the moment it is sent**, with the ts Slack returns:

  ```bash
  node tools/bin/triage-log.js --record --run <runId> --reply-ts <ts>
  ```

  The ts is the evidence the acceptance criteria are checked against. A reply that is not logged
  cannot be counted, so this is not bookkeeping — it is the deliverable.
- **2.1** to the QA channel as a new message.
- **2.2** into the failing run's thread, team @-mentioned. A dev-team channel only if the user names
  one — do not pick.
- **2.4 is never posted.** It stays in the report for the user to raise.
- **Only these five channels are ever written to.** Anywhere else needs an explicit instruction.
- Any destination marked `"confirmed": false` in `config/channels.json` needs a go-ahead first.

## Step 9 — Phase 3: sign off

```bash
node tools/bin/daily.js --close [--channels ...]
```

Signs off the review window so tomorrow starts from here, then prints today's coverage and whatever
is still open. **Only after the replies have actually been posted and logged** — signing off a
report nobody read marks the night's failures as handled.

Anything still listed as overdue is a red run with no reply past its deadline. Name them; that is
what breaks the weekly checkpoint, and it is invisible in the triage report otherwise.

## Rules

- **Do not invent.** Not opened the log? Say "not enough evidence" instead of labelling to fill the table.
- **Nothing leaves the machine without confirmation** — tickets, Slack posts, Jira transitions.
- **Say when the data is thin.** Streaks cover only what is in `data/state.json`; on day one the
  window is short, so "12 consecutive failures" may really be longer.
- **Write for someone who has never opened this repo.** "Our test grabs the button by its position,
  so a layout change broke it" lands; "brittle-locator" does not. Gloss each label the first time:
  ENV = the environment broke, APP-BUG = the product is wrong, SCRIPT = our test is at fault.
  Numbers only when they change the decision.
