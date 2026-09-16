---
name: script-rca
description: Root-cause every failure labelled SCRIPT — pull the CI failure log, scan the test and its page objects for anti-patterns, decide the actual cause (fixed-sleep, brittle-locator, race-condition, test-data, assertion-wrong, missing-testid, shared-state, env-dependency, obsolete), and record fix vs quarantine vs rewrite. Use after /daily-triage, or when the user says "script rca", "root cause", "why is this test flaky", or calls /script-rca.
---

# SCRIPT root-cause analysis

A `SCRIPT` label says "the test is at fault". It does not say why. This skill answers why and turns
it into one of: fix today, rewrite, quarantine, or request a `data-testid`.

QE-935 targets **100% script accuracy on smoke**, so every SCRIPT failure on a smoke suite is a
breach until it has a root cause and an action.

Working dir: `c:\Gravity\qa-checking`. Test repo: `c:\Gravity\qa-automation` — **read-only**;
proposing a patch is fine, landing it is Block 3.

## Step 1 — Evidence pack

```bash
node tools/bin/script-rca.js                       # every SCRIPT failure
node tools/bin/script-rca.js --test "Verify ..."   # one
```

`reports/<date>/script-rca.md` gives you: **Start here** (the file behind more than one failure),
then per test — how it fails, the likely cause in plain words, an ordered fix plan with effort and
blockers, and the code/diffs/log commands collapsed underneath.

The signals it uses: failure shape (`always-red` = obsolete or a real product change; `intermittent`
= race or sleep), variant split (one browser only = engine dependency), anti-patterns **in the page
objects the spec imports** (most defects here live in `ui_tests/pages/*`, not the spec), and a
warning when a past commit already claimed to fix this test — that means the earlier root cause was
wrong, so prefer `rewrite` over another point fix.

## Step 2 — Confirm against the real log

**A static hit is evidence, never a verdict.**

```bash
gh run view <runId> --log-failed -R gravity-technologies/qa-automation | head -150
gh run download <runId> -D ./tmp-artifacts     # trace/screenshots when the log is not enough
```

| What the log says | Cause |
|---|---|
| `locator resolved to 0 elements`, `strict mode violation` | `brittle-locator` |
| `Timeout ... exceeded` on something that does appear later | `fixed-sleep` or `race-condition` |
| assertion diff on a variable value (balance, price, order id) | `assertion-wrong` or `test-data` |
| passes alone, fails inside the suite | `shared-state` |
| fails on one browser/device only | `env-dependency` |
| the flow no longer exists in the product | `obsolete` |
| no stable attribute to target | `missing-testid` |

Two groups in the Slack message settle the question before the log does. **FAILED (env-dependent)**
means the spec is tagged `@envDependent` in the test repo — it asserts on account state that must
already be there — so check the account before reading the code; the usual answer is ENV, not
SCRIPT. **BLOCKED (preflight)** means the account gate failed and the suite body never ran: there is
nothing to root-cause, and the run does not count toward the pass rate.

A sharded regression run is several Slack messages under one workflow run id.
`gh run view <runId> --log-failed` covers all of them, so run it once per run, not once per message.

Mobile: BrowserStack MCP — `listBuildId` → `getBuildId` → `getFailureLogs` / `fetchRCA`, plus
`fetchAutomationScreenshots` when ambiguous.

Web and inconclusive: reproduce with the Playwright MCP on that environment. **If it reproduces by
hand, the label was wrong** — it is an `APP-BUG`. Go back to `classify.js` rather than forcing a
script cause.

## Step 3 — Record

```bash
node tools/bin/script-rca.js --record --test "<title>" --channel <key> \
  --cause <fixed-sleep|brittle-locator|race-condition|test-data|assertion-wrong|missing-testid|shared-state|env-dependency|obsolete|other> \
  --action <fix|quarantine|rewrite|request-testid|wont-fix> \
  --detail "<which line, which selector, which value>" \
  --prevention "<what stops this class of failure returning>" \
  --owner <who> [--pr <url>]
```

`--prevention` is mandatory — a fix without it comes back. `--action quarantine` marks the test
quarantined so Block 1 stops re-reporting it, and needs a ticket **and** a review date.

Choosing the action:

- **fix** — local and small (one selector, one wait). Today, if it is on smoke.
- **rewrite** — fixed before and regressed, or the page object is full of XPath and positional
  selectors. Patching again buys days.
- **request-testid** — the correct fix needs an attribute the product does not expose. Raise it with
  FE/mobile the same day and quarantine meanwhile.
- **quarantine** — real cause, no capacity today. Needs a ticket.
- **wont-fix** — obsolete. Say what replaces it, or accept the coverage loss explicitly.

## Step 4 — The suggested fix

The report carries before/after diffs per anti-pattern, an ordered plan per test, and a
cross-cutting rollup. Before handing any of it over:

1. **Check it against the real code.** The diffs come from a static scan of one line. Multi-step
   XPath in particular resolves only its first step, so the suggestion can point at an *ancestor*
   of the real target.
2. **Confirm the test id exists.** `getByTestId("x")` suggested? Grep the frontend. Not there →
   `request-testid` plus quarantine, not a fix.
3. **Lead with the cross-cutting action.** One page-object rewrite that clears five failures beats
   five patches that each reset a streak for a day.
4. **Give effort honestly.** "Rewrite 45 XPath locators" is not a same-day task — say so instead of
   promising it into the daily checklist.

Present per test: root cause in one sentence → the concrete change → effort → who else is needed.

Write it for a manual tester. "The test waits a fixed three seconds instead of waiting for the page,
so it fails whenever the site is slower than usual" is actionable; "fixed-sleep anti-pattern" is
not. Use the short code as a tag after the sentence, never instead of it.

## Step 5 — Report back, then close the loop

**Use the report's own sections. Do not invent headings.**

```
Start here  — <the one file behind several failures, or "no shared file">
<n>. <test> — cause: <plain sentence> · action: <fix|rewrite|quarantine|request-testid> · <effort>
Blocked on  — <testid requests, missing logs, anything needing another team>
Recorded    — <n of m have a root cause on file>
```

Then:

- Re-run `node tools/bin/report.js` — "SCRIPT with no recorded root cause" should drop.
- Put the root cause as a comment on the QE ticket that owns the test, **not** in a Slack channel,
  so the next person to open it sees why it broke.
- Track it: `node tools/bin/track.js --test "..." --channel <key> --status in-review --pr <url>`,
  then `--verify --run <runId>` once a run is green. `--verify` refuses to close a still-red test.
- `request-testid` needs a message to FE/mobile: name the exact attribute and element, send only on
  the user's confirmation.

## Rules

- No log read, no reproduction → record nothing, and say what evidence is missing.
- One cause per test, specific: "waitForTimeout(3000) on line 88 fires before the order book
  renders" — not "flaky test".
- Evidence contradicts the SCRIPT label → say so and re-classify. Mislabelling a product bug as a
  script defect is how bugs reach production.
- Never edit `qa-automation` unless asked.
