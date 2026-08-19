---
name: daily-triage
description: Run Block 1 (morning triage) and Block 2 (standup) of the QE-964 QA daily checklist — read the automation Slack channels, compute streaks and flakiness, map failing tests to files in qa-automation, suggest ENV/APP-BUG/SCRIPT labels, and draft the standup and log row. Use when the user says "morning triage", "run daily", "block 1", "standup", or calls /daily-triage.
---

# Daily triage — Block 1 + Block 2

Goal: cut Block 1 (~45 min) and Block 2 (~15 min) down to a few minutes of reading and deciding.

The scripts handle the mechanical work (parsing, streaks, percentages, file mapping, drafts).
**You handle the judgement** (reading logs, classifying, writing tickets). The user makes the
final call on anything that leaves this machine.

Working directory: `c:\Gravity\qa-checking`. Test repo: `c:\Gravity\qa-automation` (read-only).

## Arguments

`/daily-triage` takes optional arguments; pass them straight through to `ingest.js` and `report.js`.

| Argument | Effect |
|---|---|
| `--channels <key[,key]>` | Read only these channels, ignoring the `enabled` flags in the config. Keys: `manual-automation`, `web-prod`, `web-testnet`, `web-staging`, `mobile-testnet` |
| `--date <YYYY-MM-DD>` | Read the dumps from `data/raw/<date>/` and write to `reports/<date>/`. For a past date the whole report is evaluated **as of 23:59 on that date** — later runs are excluded and streaks are recomputed against that cut-off |
| `--window <n>` | How many runs per channel the health table covers (default 20) |

Examples:

- `/daily-triage --channels web-staging` — one channel, today.
- `/daily-triage --channels manual-automation --date 2026-08-17` — one channel, one specific day.
- `/daily-triage --date 2026-08-15 --window 40` — a wider historical view.

With no arguments it uses the channels marked `"enabled": true` and today's date.

**A past date only reports on data already ingested.** Slack cannot be re-read for an arbitrary
day through this tool, so if `data/raw/<date>/` does not exist, either ingest was never run that
day or the dumps were deleted. In that case say so instead of producing an empty report — or pull
the history now (raise the Slack `limit` so it reaches back that far), write it to
`data/raw/<date>/`, and ingest it. State accumulates, so back-filling is safe.

---

## Step 0 — Prep (only when needed)

```bash
cd c:/Gravity/qa-checking
git -C c:/Gravity/qa-automation pull    # file mapping is only as good as the local checkout
node tools/bin/index-tests.js           # re-run after every pull
```

## Step 1 — Pull the Slack data

Channels are configured in `config/channels.json`. Only entries with `"enabled": true` are read.

**The four automation channels run every day. `#qa-manual-automation` is optional** — it is only
read when the user asks for it by name (`--channels manual-automation`), because it receives
ad-hoc `workflow_dispatch` runs whose environment and suite size vary per run.

| key | channel_id | channel | |
|---|---|---|---|
| web-prod | C083HQRCGR3 | #qa-web-automation-prod | daily |
| web-testnet | C07KPL4CUAC | #qa-web-automation-testnet | daily |
| web-staging | C07QWGUE2G6 | #qa-web-automation-staging | daily |
| mobile-testnet | C0ANDUMDZU2 | #qa-mobile-automation-testnet | daily |
| manual-automation | C0BJ6L6E44A | #qa-manual-automation | on request only |

For each enabled channel call `mcp__claude_ai_Slack__slack_read_channel` with `limit: 12` and
`response_format: "detailed"` (required — the concise format drops the message timestamps).

Write the `messages` field **verbatim** to `data/raw/<YYYY-MM-DD>/<key>.txt`. Keep the `✘`
characters, the `=== Message from ... ===` lines and the `Message TS:` lines — the parser depends
on them. Turning `\/` back into `/` is fine either way.

If a channel has no new messages, still write the file; the tool flags it as SILENT.

## Step 2 — Jira snapshot (for Block 2)

Call `mcp__claude_ai_Atlassian__searchJiraIssuesUsingJql`:
- `cloudId`: `56c14758-cc74-4db5-9e9f-40da67731510`
- `jql`: `key in (QE-935, QE-948, QE-949, QE-965, QE-966) OR (project = QE AND assignee = currentUser() AND statusCategory != Done)`
- `fields`: `["summary","status","duedate","created","priority"]`

Write `data/jira-snapshot.json`:

```json
{
  "fetchedAt": "2026-08-18T09:00:00+07:00",
  "issues": [
    { "key": "QE-948", "summary": "...", "status": "To Do", "duedate": "2026-09-15",
      "created": "2026-08-14", "daysSinceCreated": 4, "priority": "High" }
  ]
}
```

Compute `daysSinceCreated` yourself — the checklist warns on anything sitting in "To Do" for more
than 2 days.

## Step 3 — Run the tools

```bash
cd c:/Gravity/qa-checking
node tools/bin/ingest.js [--channels ...] [--date ...]   # parse and update streaks; verdicts are preserved
node tools/bin/report.js [--channels ...] [--date ...] [--window ...]
```

Pass the same `--channels` / `--date` to both commands, and use the same values the user gave you.

Read `reports/<date>/triage.md`. It follows the agreed Block 1 report format:

| Section | Contents |
|---|---|
| **1.1** | Channel status table, total failures split by class, smoke-accuracy verdict |
| **1.2** | Classification table **grouped per channel** — one row per test, except ENV which collapses to one row per cluster |
| **1.3** | SCRIPT detail block per failure, **Prevention mandatory**; quarantined ones use the quarantine variant |
| **1.4** | APP-BUG detail block — symptom, evidence, reproduce, impact, PRO ticket, team |
| **1.5** | ENV clusters — grouped, never one line per test |
| **1.6** | The numbers for the daily log |

Rules the format enforces, which the report flags for you:

- **Action** is one of exactly four values: `Fix` · `Quarantine` · `Raise PRO` · `Monitor (ENV)`.
- **Every row needs an owner and an ETA.** Without them the row shows `⚠️` and "triage incomplete" —
  that is unfinished triage, and you should say so rather than move past it.
- **A SCRIPT failure on a smoke suite breaks smoke accuracy.** 1.1 prints `BREACHED`, and it has to
  be named in the standup post rather than buried in the table.
- **A quarantine with no ticket and no review date is a deleted test.**
- **A fix with no prevention step is a fix that comes back.**

## How to talk about it

The reader may be manual QA or a lead who has never opened this repo.

- Say what a failure means before saying what it is called. "Our test grabs the button by its
  position, so a layout change broke it" lands; "brittle-locator" does not.
- Gloss a label the first time it appears: ENV means the environment broke, APP-BUG means the
  product is genuinely wrong, SCRIPT means our own test is at fault.
- Give numbers only when they change the decision.
- When the evidence is thin, say so in those words rather than hedging with percentages.

## Step 4 — Classify each failure

Work through every row in section 1.2, plus the "failed earlier, green again now" list under 1.6.

1. Read the hint, the streak and the recent commits the tool surfaced.
2. Gather evidence before deciding:
   - **Run log (fastest route):** `gh run view <runId> --log-failed -R gravity-technologies/qa-automation`
     — the exact command is printed under each failure. `gh run view <runId>` alone shows the job
     summary; `gh run download <runId>` pulls the artifacts.
   - **Web:** open the test at the `file:line` the tool reports. Then open the page object it
     imports — that is where most script defects actually live.
   - **Mobile:** use the BrowserStack MCP — `listBuildId` → `getBuildId` → `getFailureLogs` /
     `fetchRCA` for real device logs instead of guesswork.
   - **Suspected product bug on web:** use the Playwright MCP to open the page on that environment
     and reproduce by hand. Only call something `APP-BUG` once you have reproduced it or the log
     states it plainly.
3. Apply the decision rules:

   | Label | When | Required action |
   |---|---|---|
   | `ENV` | infrastructure or environment failure: zero passes, timeout, RPC/wallet/network error | Do **not** touch the script. Note the proposal to add an env-health precondition |
   | `APP-BUG` | a product defect you can reproduce | Raise a PRO ticket **now** and draft the public-channel post (impact + next step) |
   | `SCRIPT` | the test is wrong, flaky or obsolete | Decide fix-today vs quarantine-with-ticket, then run `/script-rca` to record the root cause. `SCRIPT` on a smoke suite breaks the QE-935 100% accuracy goal and must be fixed today |

4. Record it (the command is pre-filled in triage.md — you only fill in the label):

```bash
node tools/bin/classify.js --test "<title>" --channel <key> --label <ENV|APP-BUG|SCRIPT> \
  --note "<root cause in one sentence>" --owner <name> --eta <YYYY-MM-DD> [--ticket PRO-xxxx] [--quarantine]

# APP-BUG additionally needs the fields the dev-channel message is built from:
node tools/bin/classify.js --test "..." --label APP-BUG --ticket PRO-1234 --owner viet --eta 2026-08-20 \
  --team fe --severity High --impact "signup blocked for invited users" \
  --evidence <url> --repro "1. ... 2. ..." [--prod-leak]
```

Ask the user for the owner and ETA if they have not said — do not invent them.
`node tools/bin/classify.js --incomplete` lists every row still missing something.

5. Anything red for 5+ consecutive runs with no ticket and no quarantine **must not roll over to
   tomorrow**. Either raise a ticket or quarantine it. Say so plainly if the user has not decided.

Run `node tools/bin/classify.js --pending` to confirm nothing is left unowned.

## Step 5 — PRO tickets for APP-BUG

Only after the user confirms. Use `mcp__claude_ai_Atlassian__createJiraIssue` (project `PRO`,
issue type `Bug`) with: environment plus browser/device, consecutive-failure count, Actions Job and
Test Report links, reproduction steps, impact, and the automated test key. Then re-run
`classify.js ... --ticket <new key>` to attach the ticket to the state.

## Step 6 — Block 2

1. Re-run `node tools/bin/report.js` so the standup reflects the labels you just applied.
2. `reports/<date>/standup.md` follows the agreed Block 2 format:
   - **2.1** the daily standup post for the QA channel (paste as-is, ~10 lines, numbers first)
   - **2.2** one message per bug for the dev channel — never several bugs in one post (not posted)
   - **2.3** gap analysis for bugs manual regression found that automation missed (QE-965)
   - **2.4** what meets the escalation bar and goes to Raj directly instead of waiting (not posted)
3. Hand over the row in `reports/<date>/log-row.md` for the checklist log table.
4. If any failure is labelled `SCRIPT`, run `/script-rca` next.

## Step 7 — Report back, then post

`reports/<date>/posts.md` lists every message that is meant to leave this machine, one file per
message under `posts/`, each stamped with its destination. Nothing is ever sent automatically.

**Report to the user using the format's own section numbers. Do not invent headings.** No
"Where the day landed", no "Two things you should know" — the user reviews section by section and
then posts section by section, so the reply has to line up with the file and with the threads.

Reply in this shape, one line per section, skipping nothing:

```
1.1 Channels    — <green/total per channel · smoke accuracy verdict>
1.2 Classified  — <n rows: ENV a / APP-BUG b / SCRIPT c · m incomplete>
1.3 SCRIPT      — <n blocks · what is missing, e.g. prevention on 2 of 3>
1.4 APP-BUG     — <n blocks, or "none">
1.5 ENV         — <n clusters covering m tests>
1.6 Numbers     — <flakiness · failures with no verdict>
2.1 Standup     — ready / blocked on <what>
2.2 Dev message — <n bug blocks written, m incomplete · not posted, hand over yourself>
2.3 Gap         — <recorded / nothing to record>
2.4 Escalate    — <what crossed the bar, or "nothing"> · not posted, raise it yourself
```

Then list what is ready to post, with its destination, and stop. Ask which ones to send.

When the user approves:

- Use `slack_send_message_draft` by default; `slack_send_message` only when they say "send it".
- Post the body of the file exactly, minus the `<!-- -->` header lines.
- **1.1–1.6 is cut one record per channel** — `posts/1-triage-<channel-key>.md`. Each file contains
  only that channel's failures. Post `1-triage-web-staging.md` into the staging thread and nothing
  else; a reader in the staging thread has no use for prod's numbers, and posting them there leaks
  a channel's state to people not watching it. **Never post `triage.md`** — that is the whole-day
  working copy for the person running triage, not a message.
  - When the user names one channel ("post the triage record to WEB-AUTOMATION-STAGING"), send
    that channel's file only. Do not offer or attach the others.
  - Reply into the thread of the run the record describes: `slack_send_message` with the
    `thread_ts` in the file's second header comment, so the record sits with its evidence. If the
    header says no failing run was found, ask which message to reply to rather than guessing.
- **2.1** goes to the QA channel as a new message.
- **2.2 and 2.4 are never posted.** Dev-team channels and DMs are outside the channels this tool
  writes to. Both sections stay in the report; the user hands them over themselves. Report what
  they contain, then leave them alone.
- **Only these five channels are ever written to**: `#qa-web-automation-prod`,
  `#qa-web-automation-testnet`, `#qa-web-automation-staging`, `#qa-mobile-automation-testnet`, and
  `#qa-manual-automation` (only when the user asks for it with `--channels manual-automation`).
  Anywhere else needs an explicit instruction naming the channel.
- Check `config/channels.json` → `posting`: any destination with `"confirmed": false` has not been
  verified. Ask before the first send, then set it to `true`.
- A message marked ⚠️ incomplete is missing a ticket, team, impact or evidence. Say what is
  missing and do not send it — an incomplete bug report does not get picked up.

## Rules

- **Do not invent.** If you have not opened the log or report, say "not enough evidence" rather
  than labelling something to fill the table.
- **Nothing leaves the machine without confirmation.** Creating tickets, posting to Slack and
  changing Jira status all need the user's go-ahead first.
- **Say when the data is thin.** Streaks are computed over the runs stored in `data/state.json`.
  On day one the window is short, so "12 consecutive failures" may in reality be longer. Pull more
  history by raising the Slack `limit` and re-ingesting — state accumulates, it is never overwritten.
- **`#qa-manual-automation` is ad-hoc.** It receives manual `workflow_dispatch` runs, so environment
  and suite size change from run to run. Treat its streak and flakiness numbers as indicative, and
  never quote them as a baseline.
- **A PROD failure is always priority one**, even when it recovered on its own — the PROD baseline
  is 100% green.
- The tool only reads `qa-automation`; it never edits it. Fixing tests is Block 3 work.
