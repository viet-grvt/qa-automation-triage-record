# QA Daily Triage — tooling for Block 1 + Block 2 (Epic QE-964)

Turns the 60 minutes of morning triage and standup into a few minutes of reading and deciding.

The **mechanical** part (parsing Slack, counting streaks, computing flakiness, mapping tests to
files, drafting messages) is plain Node — no network, no dependencies, same input always gives the
same output. The **judgement** part (reading logs, classifying, writing tickets) is Claude's, via
the skills, and the user makes the final call on anything that leaves the machine.

## Running it

In Claude Code, from `c:\Gravity\qa-checking`:

```
/daily-triage      Block 1 + Block 2
/script-rca        root-cause everything labelled SCRIPT (run after the above)
```

Manual invocation:

```bash
node tools/bin/index-tests.js       # build the "test title → file:line" index from qa-automation
node tools/bin/ingest.js            # parse the Slack dumps in data/raw/<today>/
node tools/bin/report.js            # write reports/<today>/{triage,standup,log-row}.md
node tools/bin/classify.js --pending
node tools/bin/classify.js --test "..." --channel web-staging --label APP-BUG --ticket PRO-1234
node tools/bin/script-rca.js        # write reports/<today>/script-rca.md
node tools/bin/script-rca.js --record --test "..." --cause brittle-locator --action rewrite
```

## Arguments

Both slash commands and the scripts take the same options:

| Argument | Effect |
|---|---|
| `--channels <key[,key]>` | Only these channels, overriding the `enabled` flags |
| `--date <YYYY-MM-DD>` | Read `data/raw/<date>/`, write `reports/<date>/`, and for a past date evaluate everything **as of 23:59 on that date** |
| `--window <n>` | Runs per channel in the health table (default 20) |

```
/daily-triage --channels web-staging
/daily-triage --channels manual-automation --date 2026-08-17
```

A past date only covers data that was already ingested — the tool cannot re-read Slack for an
arbitrary day. If `data/raw/<date>/` is missing, back-fill it first (raise the Slack `limit` so it
reaches that far back, write the dumps, then ingest); state accumulates, so back-filling is safe.

## Which channels it reads

`config/channels.json` drives everything. Only entries with `"enabled": true` are read.

**The four automation channels run every day**: `#qa-web-automation-prod`,
`#qa-web-automation-testnet`, `#qa-web-automation-staging`, `#qa-mobile-automation-testnet`.
`#qa-manual-automation` is configured with `"enabled": false` and is read only when you ask for it
by name — it receives ad-hoc `workflow_dispatch` runs, so its environment and suite size vary per
run and its streaks are not a baseline.

```bash
# add the optional channel for one run
node tools/bin/ingest.js --channels manual-automation
node tools/bin/report.js --channels manual-automation

# permanent: flip "enabled" in config/channels.json
```

`#qa-manual-automation` is marked `adhoc`: it carries manual `workflow_dispatch` runs, so the
environment and the suite size change from run to run. The reports label its numbers as indicative
rather than a baseline.

## Output

Output follows the agreed report format (`QE-964-block1-2-report-format.md`), grouped per channel.

| File | Structure |
|---|---|
| `reports/<date>/triage.md` | **1.1** channel status + failure split + smoke-accuracy verdict · **1.2** classification table per channel (Test / Suite-Env / Class / Root cause / Action / Ticket / Owner / ETA) · **1.3** SCRIPT blocks with mandatory Prevention · **1.4** APP-BUG blocks · **1.5** ENV clusters · **1.6** numbers for the daily log |
| `reports/<date>/standup.md` | **2.1** the standup post to paste · **2.2** one dev-team message per bug (not posted) · **2.3** gap analysis for bugs automation missed · **2.4** what to escalate immediately (not posted) |
| `reports/<date>/log-row.md` | The row for the checklist's daily log table |
| `reports/<date>/posts.md` | Index of every message meant to leave this machine — section, destination, ready/incomplete |
| `reports/<date>/posts/*.md` | **One file = one message = one thread.** Each is stamped with its destination and contains only the body to paste |
| `reports/<date>/script-rca.md` | Why our own tests fail — **Start here** (the one file behind several failures), then per test: how it fails, the cause in plain words, what to change. Diffs and code in a collapsed block |

What the format enforces, and the tool flags:

- `Action` is one of exactly four values — Fix · Quarantine · Raise PRO · Monitor (ENV).
- Every row needs an **owner and an ETA**; without them it is marked "triage incomplete".
- A SCRIPT failure on a smoke suite prints **smoke accuracy: BREACHED** and is repeated in the
  standup post rather than buried.
- A quarantine with no ticket and no review date is called out as a deleted test.
- A SCRIPT fix with no **Prevention** step is called out as a fix that will come back.
- ENV failures are grouped into clusters — twenty checks knocked out by one bad run is one item,
  not twenty rows.

## What it catches on its own

- **Real streaks, not impressions** — "red for 12 consecutive runs" comes from stored history, kept
  separate per suite (smoke ≠ regression) and per channel.
- **Silent channels** — no new run for 12h is flagged before you start triaging tests that were
  never actually executed.
- **Partial runs** — a green run covering 5 of 20 cases is **not** used to infer that a test passed,
  which would otherwise wipe out a genuine streak.
- **Browser/device-specific failures** — a test red only on Firefox while Chrome and Brave are green
  gets named as such instead of being written off as flaky.
- **Failed-then-recovered within 24h** — still needs a verdict, especially on PROD where the
  baseline is 100% green.
- **A stale local checkout** — when a test cannot be mapped to a file, the report names the local
  branch and commit so you know to pull rather than assume the test is missing.
- **Anti-patterns in page objects** — the RCA scans not just the spec but the page objects and
  helpers it imports, which is where this repo's script defects actually live.
- **Previously fixed and regressed** — if a past commit claims to fix the same test, the RCA says so
  and pushes towards a rewrite instead of another point fix.
- **Concrete fixes, honestly graded** — each anti-pattern comes with a before/after diff marked
  either mechanical (derivable from the line, e.g. an XPath on `@role` → `getByRole`) or
  judgement-required. Multi-step XPath is always the latter, because collapsing it would point the
  test at an ancestor of the real target.
- **The leverage point** — when several failing tests share one page object, the rollup says to fix
  that file rather than patching each test, and turns missing attributes into one batched
  `data-testid` request to FE.
- **iOS** — a daily yes/no on whether an iOS run happened, and the coverage gap against Android
  (QE-948 Phase 1).
- **Thin evidence, stated as thin** — with only one or two recorded runs the reports say so instead
  of turning 1 failure out of 1 into "fails 100% of the time".

## Layout

```
config/channels.json      channels, baselines, watchlist, thresholds   ← edit here
tools/lib/parse-slack.js  parser for the qa-ui-bot / mobile bot messages
tools/lib/state.js        state I/O, channel selection, title normalisation
tools/lib/hints.js        test → file mapping, git history, label heuristics
tools/lib/smells.js       anti-pattern rules and local-import resolution
tools/lib/propose.js      before/after fix suggestions and the per-test fix plan
tools/lib/plain.js        plain-language layer: turns every number into a sentence
tools/bin/*.js            index-tests · ingest · report · classify · script-rca
data/state.json           run history, streaks and verdicts (survives every re-ingest)
data/raw/<date>/          raw Slack dumps (gitignored)
```

## Posting to the team

Nothing is ever sent automatically. `reports/<date>/posts.md` lists each message with where it
goes; review, then ask Claude to post the ones you approve.

| Section | Message | Destination |
|---|---|---|
| 1.1–1.6 | The triage record, **one file per channel** | the thread of that channel's run — `1-triage-web-staging.md` goes to the staging thread and nowhere else |
| 2.1 | Daily standup post | the QA channel |
| 2.2 | One message per bug | **not posted** — hand it to the team yourself |
| 2.4 | Escalation | **not posted** — raise it yourself |

The tool only ever writes into the five automation channels above. Sections 2.2 and 2.4 stay in
the report as text for you to pass on; no dev-team channels, no DMs. Destinations live in
`config/channels.json` → `posting`; anything still `"confirmed": false` needs your go-ahead
before the first send. A message the tool marks ⚠️ incomplete is missing a ticket, team, impact or
evidence; sending it as-is means nobody picks it up.

## Requirements

- Node 22 (installed).
- `gh` 2.97 at `%LOCALAPPDATA%\Programs\gh\bin`, already on the user PATH. Run `gh auth login`
  once in a normal terminal — the reports print ready-to-run `gh run view ... --log-failed`
  commands, and without auth those will fail.

## Known boundaries

- The data source is **Slack messages**, not the GitHub API. If the bot's format changes,
  `tools/lib/parse-slack.js` has to change with it. The current format matches
  `.github/actions/slack-reporter-{frontend,mobile}/slack_custom_formatter.sh` in qa-automation.
- Slack only lists failing tests, so "pass" is inferred: a test absent from the failure list of a
  full run counts as passed. Zero-pass, timed-out and partial runs are excluded from that inference.
- The mobile reporter truncates its failure list at 30 lines; ingest warns when it sees a truncated
  run.
- The history window is however many messages have been ingested. Day one gives roughly 8–12 runs
  per channel; state accumulates across days, so streak and flakiness accuracy improves over time.
