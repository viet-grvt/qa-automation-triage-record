---
name: review-results
description: Review a set of automated test failures end to end — for each one decide flaky test vs genuine product issue with evidence, root-cause and track the flaky ones, and for the genuine ones raise a task and post it to the public channel with impact and next steps. Use when the user says "review test results", "review the failures", "flaky or real", "check this run", names a runId or channel, or calls /review-results.
---

# Review automated test results

One question per failure: **is our test wrong, or is the product wrong?** Everything else follows
from the answer. This skill is the fast path for that loop — a single run, a single channel, or
whatever failures are currently open — without the rest of the daily checklist.

Working dir: `c:\Gravity\qa-checking`. Test repo: `c:\Gravity\qa-automation` — **read-only**.

| Use | Instead of |
|---|---|
| **`/review-results`** — review failures now: verdict → fix or task → post | `/daily-triage` when you want the whole morning: Slack pull, coverage, SLA, standup, sign-off |
| **`/review-results`** — the verdict and what each verdict obliges | `/script-rca` when everything is already labelled SCRIPT and you only want the code-level cause |

`/daily-triage` calls this loop as its Step 4–6. Running this skill alone does **not** sign off the
review window and does **not** by itself satisfy the QE-964 red-run SLA — say so if the user
expects it to.

## Arguments

| Argument | Effect |
|---|---|
| _(none)_ | **Today**, all enabled channels — the default |
| `--date <YYYY-MM-DD>` | Read `data/raw/<date>/`, write `reports/<date>/`, evaluate **as of 23:59 that day** |
| `--channels <key[,key]>` | Only these channels. Keys: `web-prod`, `web-testnet`, `web-staging`, `mobile-testnet`, `manual-automation` |
| `--window <n>` | Runs per suite in the health table (default 20) |
| `--run <runId>` / a channel name in plain words | Narrow the review to that run or channel — still resolved against the same date |

Pass the same arguments to `ingest.js` and `report.js`; they must match or the report describes a
different day than the one that was ingested.

**A past date reports only on data already ingested.** If `data/raw/<date>/` is missing, say so
rather than producing an empty report — or pull that history now and ingest it (state accumulates,
back-filling is safe). Never present an un-ingested day as "no failures".

**Only the report is date-aware.** `classify.js`, `script-rca.js --record` and `track.js` always
stamp today — they write to live state, not to that date's snapshot. So reviewing 18/08 on 27/08 is
fine for reading, but every verdict you record is dated 27/08. Say that when the user asks for a
back-dated review, and do not post a message into an old run's thread without checking it is still
the right thing to send.

## Speed rules

Fast comes from **not re-deriving what the tools already computed**, never from skipping evidence.

- Read `reports/<date>/triage.md` §1.2 first. It already carries the leaning, the pattern, the
  history and the test→file mapping. Do not re-count streaks by hand.
- **One log read per failure cluster, not per test.** Fifteen tests failing on the same page object
  or the same 502 is one investigation.
- Time-box each failure to its evidence: the tools' leaning plus one confirming artefact. If the
  two disagree, that failure is unclassified — move on and come back, do not stall the batch.
- Classify in one batched pass at the end; do not alternate investigate → classify → investigate.
- **Never trade accuracy for speed.** "Not enough evidence" is a valid and fast answer. A failure
  written off as flaky is how a real bug reaches users.

## Step 1 — Get the failures and the evidence

Data already ingested today (the usual case after `/daily-triage` phase 1):

```bash
node tools/bin/report.js [--channels <key[,key]>] [--date <YYYY-MM-DD>]
node tools/bin/classify.js --pending     # every failure with no verdict yet — the work list
```

Nothing ingested yet — pull Slack first (`mcp__claude_ai_Slack__slack_read_channel`, `limit: 12`,
`response_format: "detailed"` — concise drops the timestamps), write `messages` **verbatim** to
`data/raw/<date>/<key>.txt`, then:

```bash
node tools/bin/ingest.js [--channels ...] && node tools/bin/report.js [--channels ...]
```

Channel keys: `web-prod` · `web-testnet` · `web-staging` · `mobile-testnet` · `manual-automation`.

`reports/<date>/triage.md` §1.2 is the working table — one row per test with a **Flaky or genuine?**
column, plus an evidence block for everything still without a verdict. §1.3–1.5 hold the detail.

## Step 2 — Decide: flaky test, or genuine product issue?

The table gives the leaning. **You decide**, and the leaning is never the decision on its own.

| Pattern | What the history shows | Usually |
|---|---|---|
| `intermittent` | passes and fails on the same code | **our test** — the product does not change between two runs ten minutes apart |
| `always-fails` | red every run since the streak started, never green | **something really changed** |
| `variant-only` | fails on one browser/device, passes on the others | ambiguous — a browser-specific defect and a locator that only matches elsewhere look identical |
| `first-time` | clean until now, failed once | not a pattern yet — but this is how a regression starts |
| `too-early` | under 3 observations | say exactly that; do not classify on one data point |

`always-fails` **plus a commit to the test's own file just before the streak started** is ours, not
the product's — the report names that commit, read the diff before anything else.

One confirming artefact per cluster, then decide:

- **Web CI:** `gh run view <runId> --log-failed -R gravity-technologies/qa-automation | head -150`
  (the runId is printed under each failure). `gh run download <runId> -D ./tmp-artifacts` for
  traces and screenshots when the log is not enough.
- **Mobile:** BrowserStack MCP — `listBuildId` → `getBuildId` → `getFailureLogs` / `fetchRCA`.
- **Suspected product bug:** reproduce by hand with the Playwright MCP on that environment.
  **Reproducing by hand is what makes it APP-BUG.** Not reproduced and not stated plainly in the
  log → it stays unclassified.

| Label | When | Then |
|---|---|---|
| `ENV` | infra: zero passes across the suite, timeouts, RPC/wallet/network errors | Do **not** touch the script. One line naming the condition, then monitor |
| `APP-BUG` | a product defect you reproduced, or the log states it outright | **Step 4** |
| `SCRIPT` | our test is wrong, flaky or obsolete | **Step 3** |

Record the batch in one pass — owner and ETA come from the user, never invented:

```bash
node tools/bin/classify.js --test "<title>" --channel <key> --label <ENV|APP-BUG|SCRIPT> \
  --note "<one sentence>" --owner <name> --eta <YYYY-MM-DD> [--ticket PRO-xxxx] [--quarantine]
```

`--incomplete` lists what is still missing. Anything red 5+ runs with no ticket and no quarantine
must not roll over to tomorrow.

## Step 3 — Flaky: root cause it, then track the fix

A `SCRIPT` label says the test is at fault; it does not say why. **A label with no root cause is a
nicer way of ignoring it.**

1. `/script-rca` for the code-level cause and the proposed change — or, for a single test:
   `node tools/bin/script-rca.js --test "<title>"`
2. Record it. `--prevention` is mandatory; a fix without one comes back:

```bash
node tools/bin/script-rca.js --record --test "<title>" --channel <key> \
  --cause <fixed-sleep|brittle-locator|race-condition|test-data|assertion-wrong|missing-testid|shared-state|env-dependency|obsolete|other> \
  --action <fix|quarantine|rewrite|request-testid|wont-fix> \
  --detail "<which line, which selector, which value>" \
  --prevention "<what stops this class of failure returning>" --owner <who> [--pr <url>]
```

3. Track it until it is really fixed:

```bash
node tools/bin/track.js --overdue                                     # past ETA, unowned, merged-but-still-red
node tools/bin/track.js --test "..." --channel <key> --status in-review --pr <url>
node tools/bin/track.js --test "..." --channel <key> --verify --run <runId>
```

`--verify` **refuses to close anything still red** — a merged PR is not a fix, a green run is. Say
that plainly if asked to mark it done anyway. Run `--overdue` at the start of every review: an
unfixed decision from last week matters more than a new failure today.

A quarantine needs a ticket **and** a review date, or it is a deleted test. If the evidence turns
out to contradict the SCRIPT label, re-run `classify.js` with `APP-BUG` — never force a script
cause onto a product bug.

## Step 4 — Genuine: raise a task, then say so publicly

**Both, always.** Only the task is how bugs sit unnoticed; only the message is how they are
forgotten once the thread scrolls away.

**Task.** `reports/<date>/tasks/` holds a draft per APP-BUG with no ticket. Fill the gaps it marks,
then — **only after the user confirms** — `mcp__claude_ai_Atlassian__createJiraIssue`, project
`PRO`, type `Bug`. Record the key immediately, or the next report drafts it again:

```bash
node tools/bin/classify.js --test "..." --channel <key> --ticket PRO-xxxx
```

The APP-BUG fields the message is built from, all set on `classify.js`:
`--team <fe|mobile|backend|...> --severity <...> --impact "..." --evidence <url> --repro "1. ... 2. ..."`
(`--repro-automation-only` when it only reproduces in automation, `--prod-leak` when it is live).

**Message.** `node tools/bin/report.js` rebuilds `posts/2.2-*.md`, one per bug. Each must carry:

| | |
|---|---|
| **What happens** | what a person sees, not what the assertion says |
| **Impact** | who is affected, which flow, and whether it is live in production |
| **Next steps** | who confirms, who owns it, when QA re-checks |
| **Evidence** | the failing run, screenshot or trace link |

Missing ticket / team / impact / evidence → the tool marks it ⚠️ incomplete and it is not sent.

Posting, on the user's approval only:

- Into the **failing run's own thread** in that suite's channel, with the owning team @-mentioned.
  A dev-team channel only if the user names one — do not pick one yourself.
- `slack_send_message_draft` by default; `slack_send_message` only on "send it". Post the body
  exactly, minus the `<!-- -->` headers.
- **One message per *ticket*, not per failing test.** Seven tests knocked out by one bug is one
  thing for the team to act on; seven near-identical messages get muted, and muting is how the next
  real one is missed. Never merge two different bugs into one message either.
- Only the five channels in `config/channels.json` are ever written to. Anything marked
  `"confirmed": false` needs a go-ahead first.
- If this review covers a red run under the daily SLA, log the reply the moment it is sent — the ts
  is the evidence the acceptance criteria are checked against:
  `node tools/bin/triage-log.js --record --run <runId> --reply-ts <ts>`

## Step 5 — Report back, then stop

Use these headings. One line per failure, no prose around them.

```
Reviewed    — <n failures across <m> suites · <runId(s) or channel>>
Verdicts    — flaky <a> · genuine <b> · env <c> · not enough evidence <d>
<n>. <test> — <flaky|genuine|env> · <one-sentence why, from the evidence> · <action>
Flaky       — <n root-caused · m awaiting /script-rca · k tracked fixes overdue>
Genuine     — <n tickets drafted / created> · <n messages ready, m incomplete and why>
Unresolved  — <what evidence is missing before these can be called>
```

Then list what is ready to leave the machine, with its destination, and **stop**. Ask which to send.

## Rules

- **Do not invent.** No log opened, no reproduction → "not enough evidence", not a label that fills
  the table.
- **Nothing leaves the machine without confirmation** — Jira tickets, Slack posts, Jira transitions.
- **Never label something SCRIPT because it is inconvenient.** If you cannot say why the test is
  wrong, it is unclassified, and saying so is the honest answer.
- **One cause per test, specific:** "waitForTimeout(3000) on line 88 fires before the order book
  renders" — not "flaky test".
- **Smoke and regression are separate suites.** A green smoke run does not answer a red regression
  run, and a reply belongs in its own suite's thread.
- **Never edit `qa-automation`** unless asked. Proposing a patch is fine; landing it is Block 3.
- **Write for a manual tester.** Gloss each label the first time: ENV = the environment broke,
  APP-BUG = the product is wrong, SCRIPT = our test is at fault. Numbers only when they change the
  decision.
