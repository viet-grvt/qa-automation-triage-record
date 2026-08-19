---
name: script-rca
description: Root-cause every failure labelled SCRIPT — pull the CI failure log, scan the test and its page objects for anti-patterns, decide the actual cause (fixed-sleep, brittle-locator, race-condition, test-data, assertion-wrong, missing-testid, shared-state, env-dependency, obsolete), and record fix vs quarantine vs rewrite. Use after /daily-triage, or when the user says "script rca", "root cause", "why is this test flaky", or calls /script-rca.
---

# SCRIPT root-cause analysis

Runs after Block 1/2. A `SCRIPT` label says "the test is at fault" — it does not say why. This
skill answers why, and turns that into one of: fix today, rewrite, quarantine, or request a
`data-testid` from the FE/mobile team.

This matters for QE-935: the smoke target is **100% script accuracy**, which means zero
script-caused false positives. Every `SCRIPT` failure on a smoke suite is a target breach until it
has a root cause and an action.

Working directory: `c:\Gravity\qa-checking`. Test repo: `c:\Gravity\qa-automation` (read-only —
proposing a patch is fine, but Block 3 is where fixes actually land).

---

## Step 1 — Generate the evidence pack

```bash
cd c:/Gravity/qa-checking
node tools/bin/script-rca.js                       # every SCRIPT-labelled failure
node tools/bin/script-rca.js --test "Verify ..."   # just one
```

Writes `reports/<date>/script-rca.md`, laid out for a reader who has never seen the vocabulary:

- **Start here** — the file that sits behind more than one failure, because fixing it beats fixing
  the tests one by one
- per test: how it fails · most likely cause, in plain words · what to change, as an ordered list
  with effort and who else is needed
- the code, the diffs, the run-log command and the file history collapsed under "The code, the
  evidence, and the exact edits"

Underneath that, the signals it uses are:

- **Failure shape** — `always-red` / `intermittent` / `rare`. This alone narrows the cause: an
  intermittent failure is a race or a sleep; an always-red one is usually obsolete or a real
  product change the test never accounted for.
- **Variant split** — fails on Firefox but passes on Chrome/Brave means environment or engine
  dependency, not general breakage.
- **Anti-patterns in the spec** and, importantly, **in the page objects and helpers it imports** —
  most script defects in this repo live in `ui_tests/pages/*`, not in the spec.
- **Fixed-before-and-regressed warning** — if a past commit claims to fix this same test, the
  earlier root cause was wrong. Prefer `rewrite` over another point fix.
- **File history** and the exact `gh` command for the failing run's log.

## Step 2 — Confirm with the real log

Static hits are evidence, never a verdict. Confirm before recording:

```bash
gh run view <runId> --log-failed -R gravity-technologies/qa-automation | head -150
gh run view <runId>                      # job summary
gh run download <runId> -D ./tmp-artifacts   # trace/screenshots when the log is not enough
```

Read the actual error and match it to a cause:

| What the log says | Cause |
|---|---|
| `locator resolved to 0 elements`, `strict mode violation`, `element not found` | `brittle-locator` — the selector no longer matches |
| `Timeout ... exceeded` while waiting for something that does appear later | `fixed-sleep` or `race-condition` |
| assertion diff on a value that is legitimately variable (balances, prices, order ids) | `assertion-wrong` or `test-data` |
| test passes alone but fails inside the suite | `shared-state` |
| fails only on one browser/device | `env-dependency` |
| the flow the test drives no longer exists in the product | `obsolete` |
| the element genuinely has no stable attribute to target | `missing-testid` |

For mobile, use the BrowserStack MCP instead of `gh`: `listBuildId` → `getBuildId` →
`getFailureLogs` / `fetchRCA`, plus `fetchAutomationScreenshots` when the log is ambiguous.

When the log is inconclusive on a web test, reproduce it with the Playwright MCP against the same
environment. If it reproduces by hand, the label was wrong and it is an `APP-BUG` — go back and
re-run `classify.js` rather than forcing a script cause.

## Step 3 — Record the verdict

```bash
node tools/bin/script-rca.js --record --test "<title>" --channel <key> \
  --cause <fixed-sleep|brittle-locator|race-condition|test-data|assertion-wrong|missing-testid|shared-state|env-dependency|obsolete|other> \
  --action <fix|quarantine|rewrite|request-testid|wont-fix> \
  --detail "<one concrete sentence: which line, which selector, which value>" \
  --owner <who> [--pr <url>]
```

`--action quarantine` also marks the test quarantined in the state, so Block 1 stops re-reporting
it tomorrow as an unresolved failure.

Choosing the action:

- **fix** — cause is local and small (one selector, one wait). Do it today if the test is on smoke.
- **rewrite** — the test has been "fixed" before and regressed, or the page object it depends on is
  full of XPath and positional selectors. Patching it again just buys a few days.
- **request-testid** — the correct fix needs an attribute the product does not expose. Raise the
  request with FE/mobile the same day (QE-935 explicitly calls for this) and quarantine meanwhile.
- **quarantine** — real cause, no capacity today. Requires a ticket so it does not disappear.
- **wont-fix** — the test is obsolete. Say what replaces it, or accept the coverage loss explicitly.

## Step 4 — The suggested fix

The report already carries a **Suggested fix** section per test and a **Cross-cutting** section at
the end. Your job is to turn those into something the user can act on, not to restate them.

What the report gives you:

- **Per anti-pattern:** a `diff` block with before/after, tagged either
  `mechanical rewrite — still verify it` (derivable from the line itself, e.g. an XPath on `@role`
  maps exactly onto `getByRole`) or `shape is clear, target needs your judgement`. Anything marked
  ⚠️ needs a `data-testid` that the product does not expose yet.
- **Per test:** an ordered plan — what to change, rough effort, why, and whether it is blocked on
  another team.
- **Cross-cutting:** which page objects sit behind more than one failing test, and the single
  highest-leverage action.

Before you hand a suggestion over:

1. **Check it against the real code.** The diffs come from a static scan of one line. Open the file
   and confirm the replacement makes sense in context — especially for multi-step XPath, where the
   suggestion resolves only the first step and therefore points at an ancestor of the real target.
2. **Confirm the test id exists.** If `getByTestId("x")` is suggested, grep the frontend for it.
   If it is not there, the action is `request-testid` plus a quarantine, not a fix.
3. **Prefer the cross-cutting action.** Five separate patches that each reset a streak for a day are
   worth less than one page-object rewrite. Lead with that when the rollup shows a shared file.
4. **Give effort honestly.** "Rewrite 45 XPath locators in this page object" is not a same-day task;
   say so rather than promising it into the daily checklist.

Then present, for each test: root cause in one sentence → the concrete change → effort → who else is
needed. Do not edit `qa-automation` unless the user asks; that is Block 3 work.

Keep the explanation in the language the report uses. "The test waits a fixed three seconds instead
of waiting for the page, so it fails whenever the site is slower than usual" is something a manual
tester, a developer and a manager can all act on. "fixed-sleep anti-pattern" is something only the
person who wrote this tool understands. Use the short code only as a tag after the sentence, never
instead of it.

Lead with **Start here** when it is present — one page-object fix that clears several failures is
the thing worth the user's morning, and it is easy to miss underneath a list of individual tests.

## Step 5 — Report back, then close the loop

**Report using the report's own sections. Do not invent headings.** The user reviews section by
section and posts section by section.

```
Start here  — <the one file behind several failures, or "no shared file">
<n>. <test> — cause: <plain sentence> · action: <fix|rewrite|quarantine|request-testid> · <effort>
Blocked on  — <data-testid requests, missing logs, anything needing another team>
Recorded    — <n of m have a root cause on file>
```

Then:

- Re-run `node tools/bin/report.js`; the "SCRIPT with no recorded root cause" count should drop.
- A root cause belongs on its ticket, not in a Slack channel — add it as a comment on the QE ticket
  that owns the test, so the next person to open it sees why it broke.
- `--action request-testid` needs a message to FE/mobile. Draft it, name the exact attribute and
  the element, and send only once the user confirms.
- Anything quarantined needs a ticket **and** a review date. Say so if either is missing.

## Rules

- A static hit is not a root cause. If you have not read the log or reproduced the failure, record
  nothing and say what evidence is still missing.
- One cause per test, and it must be specific: "waitForTimeout(3000) on line 88 fires before the
  order book renders" — not "flaky test".
- If the evidence contradicts the `SCRIPT` label, say so and re-classify. Mislabelling a product
  bug as a script defect is how bugs reach production.
- Never edit files in `qa-automation` unless the user asks for it.
