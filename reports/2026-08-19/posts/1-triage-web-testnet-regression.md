<!-- Section 1.1–1.6 · post to: #qa-web-automation-testnet — thread of the regression run at 04:18 -->
<!-- channel: web-testnet · suite: regression · thread_ts: 1787087907.017519 -->
<!-- Everything below the rule is the message body. Do not paste this header. -->

---

# TRIAGE RECORD — #qa-web-automation-testnet · REGRESSION — 19/08/2026

_This record covers the **regression** suite in #qa-web-automation-testnet only. The other suites and channels are triaged in their own threads._

## 1.1 Suite status

_Reviewed: every run stored — this suite has not been signed off before._

| Channel | Suite | Latest run | Pass/Total | Fully green? | Report |
|---|---|---|---|---|---|
| WEB-AUTOMATION-TESTNET | **regression** | 08-19 10:19 | 1/1 | ✅ | [report](https://github.com/gravity-technologies/qa-automation/actions/runs/32211368643/artifacts/9350973017) |

**Total failures: 16** → ENV 1 · APP-BUG 0 · SCRIPT 15

## 1.2 Classification — one row per failing test

| # | Test | Suite/Env | Flaky or genuine? | Class | Root cause (one sentence) | Action | Ticket | Owner | ETA |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Verify long position: in-profit SL trigger price must be between… | regression/testnet | 🔁 likely our test · flaky pattern | SCRIPT | clickIconInTable (perpetualpage.ts:1179) resolves the column with header.indexOf(column)+1 || header.length;… | Fix | — | viet | 2026-08-20 |
| 2 | Verify Trade-Indicators data for all instruments is rendered as… | regression/testnet | ❔ needs a look · too early to say | SCRIPT | The all-instrument sweep ran 345s and was still going when the regression job hit its time budget; it is the… | Fix | QE-969 | viet | 2026-08-19 |
| | ↳ _triage incomplete: missing root cause_ | | | | | | | | |
| 3 | Verify all records under the Recent Trades tab are populated as… | regression/testnet | ❔ needs a look · too early to say | SCRIPT | Never ran on its own: the Trade-Indicators instrument sweep consumed 345s and the regression job hit its time… | Fix | — | viet | 2026-08-20 |
| 4 | Verify Order-Book data is displayed as expected | regression/testnet | ❔ needs a look · too early to say | SCRIPT | Never ran on its own: the Trade-Indicators instrument sweep consumed 345s and the regression job hit its time… | Fix | — | viet | 2026-08-20 |
| 5 | Verify trading chart candle-sticks are rendered as expected | regression/testnet | ❔ needs a look · too early to say | SCRIPT | Never ran on its own: the Trade-Indicators instrument sweep consumed 345s and the regression job hit its time… | Fix | — | viet | 2026-08-20 |
| 6 | Verify Order-Book is not crossed (BEST_BID lower than BEST_ASK) | regression/testnet | ❔ needs a look · too early to say | SCRIPT | Never ran on its own: the Trade-Indicators instrument sweep consumed 345s and the regression job hit its time… | Fix | — | viet | 2026-08-20 |
| 7 | Verify editing a TP target trigger price persists after Confirm | regression/testnet | ❔ needs a look · too early to say | SCRIPT | splitTPSL.spec.ts:224 reads the TP/SL table once and asserts flat.some(s => s.includes(newTrigger)); the… | Fix | — | viet | 2026-08-20 |
| 8 | Verify data resets when a row is deleted or the tab is switched | regression/testnet | ❔ needs a look · too early to say | SCRIPT | splitTPSLPage.ts:305 asserts the Confirm button is enabled the moment it is checked, and on retry… | Fix | — | viet | 2026-08-20 |
| 9 | Verify Position TP/SL size matches the position when a trading login… | regression/testnet | ❔ needs a look · too early to say | SCRIPT | clickIconInTable (perpetualpage.ts:1179) resolves the column with header.indexOf(column)+1 || header.length;… | Fix | — | viet | 2026-08-20 |
| 10 | Verify short position: TP trigger price must be less than mark price | regression/testnet | ❔ needs a look · too early to say | SCRIPT | clickIconInTable (perpetualpage.ts:1179) resolves the column with header.indexOf(column)+1 || header.length;… | Fix | — | viet | 2026-08-20 |
| 11 | Verify short position: in-profit SL trigger price must be between… | regression/testnet | ❔ needs a look · too early to say | SCRIPT | clickIconInTable (perpetualpage.ts:1179) resolves the column with header.indexOf(column)+1 || header.length;… | Fix | — | viet | 2026-08-20 |
| 12 | Verify Split TP for Short position: trigger price must be less than… | regression/testnet | ❔ needs a look · too early to say | SCRIPT | clickIconInTable (perpetualpage.ts:1179) resolves the column with header.indexOf(column)+1 || header.length;… | Fix | — | viet | 2026-08-20 |
| 13 | Verify SL trigger type can be selected at MAX slider on a Short… | regression/testnet | ❔ needs a look · too early to say | SCRIPT | clickIconInTable (perpetualpage.ts:1179) resolves the column with header.indexOf(column)+1 || header.length;… | Fix | — | viet | 2026-08-20 |
| 14 | Verify open limit order can be cancelled successfully | regression/testnet | ❔ needs a look · too early to say | SCRIPT | The Order price field is targeted as //label[div='Order price']/input, which never became visible within 30s,… | Fix | — | viet | 2026-08-20 |
| 15 | Verify theme toggle, icons, and rendering work on all public pages in… | regression/testnet | ❔ needs a look · too early to say | SCRIPT | Never ran on its own: the Trade-Indicators instrument sweep consumed 345s and the regression job hit its time… | Fix | — | viet | 2026-08-20 |
| 16 | **ENV cluster** — 1 test, one incident (detail in 1.5) | regression/testnet | — environment | ENV | approveMetamask aborted: the MetaMask extension window never opened (no chrome-extension page appeared in… | Monitor (ENV) | — | viet | 2026-08-20 |

_Action is one of: **Fix** · **Quarantine** · **Raise PRO** · **Monitor (ENV)**. A row without an owner and an ETA is not finished triage._

## 1.3 SCRIPT detail

> This is what separates "fixed it" from "understood why it broke". **Prevention is mandatory.**

```
[SCRIPT-01] Verify long position: in-profit SL trigger price must be between entry and mark prices
Env/Suite   : TESTNET / regression
Failures    : 1 consecutive run since 18 Aug
Root cause  : clickIconInTable (perpetualpage.ts:1179) resolves the column with header.indexOf(column)+1 || header.length; when the header label does not match it silently falls back to the LAST column, so the Close/icon button is looked for in div[12] (div[10] on retry) and waitFor times out at 10s.
Category    : brittle-locator (auto)
PR          : ⚠️ not linked
Verify      : ⚠️ not verified — rerun it and record the result
Prevention  : Throw when the column label is not found instead of falling back to header.length — a silent fallback to the wrong column turns a rename into eight mystery timeouts.
Owner       : viet    ETA: 2026-08-20
```

```
[SCRIPT-02] Verify Trade-Indicators data for all instruments is rendered as expected
Env/Suite   : TESTNET / regression
Failures    : 1 consecutive run since 19 Aug
Root cause  : ⚠️ not recorded — run /script-rca
Category    : ⚠️ not set
PR          : ⚠️ not linked
Verify      : ⚠️ not verified — rerun it and record the result
Prevention  : ⚠️ MISSING — without this the same class of failure returns
Owner       : viet    ETA: 2026-08-19
```

```
[SCRIPT-03] Verify all records under the Recent Trades tab are populated as expected
Env/Suite   : TESTNET / regression
Failures    : 1 consecutive run since 19 Aug
Root cause  : Never ran on its own: the Trade-Indicators instrument sweep consumed 345s and the regression job hit its time budget, so the reporter marked everything queued behind it red.
Category    : other (auto)
PR          : ⚠️ not linked
Verify      : ⚠️ not verified — rerun it and record the result
Prevention  : Cap the instrument sweep's runtime (or split it into its own job) so one slow test cannot mark the rest of the suite red without running it.
Owner       : viet    ETA: 2026-08-20
```

```
[SCRIPT-04] Verify Order-Book data is displayed as expected
Env/Suite   : TESTNET / regression
Failures    : 1 consecutive run since 19 Aug
Root cause  : Never ran on its own: the Trade-Indicators instrument sweep consumed 345s and the regression job hit its time budget, so the reporter marked everything queued behind it red.
Category    : other (auto)
PR          : ⚠️ not linked
Verify      : ⚠️ not verified — rerun it and record the result
Prevention  : Cap the instrument sweep's runtime (or split it into its own job) so one slow test cannot mark the rest of the suite red without running it.
Owner       : viet    ETA: 2026-08-20
```

```
[SCRIPT-05] Verify trading chart candle-sticks are rendered as expected
Env/Suite   : TESTNET / regression
Failures    : 1 consecutive run since 19 Aug
Root cause  : Never ran on its own: the Trade-Indicators instrument sweep consumed 345s and the regression job hit its time budget, so the reporter marked everything queued behind it red.
Category    : other (auto)
PR          : ⚠️ not linked
Verify      : ⚠️ not verified — rerun it and record the result
Prevention  : Cap the instrument sweep's runtime (or split it into its own job) so one slow test cannot mark the rest of the suite red without running it.
Owner       : viet    ETA: 2026-08-20
```

```
[SCRIPT-06] Verify Order-Book is not crossed (BEST_BID lower than BEST_ASK)
Env/Suite   : TESTNET / regression
Failures    : 1 consecutive run since 19 Aug
Root cause  : Never ran on its own: the Trade-Indicators instrument sweep consumed 345s and the regression job hit its time budget, so the reporter marked everything queued behind it red.
Category    : other (auto)
PR          : ⚠️ not linked
Verify      : ⚠️ not verified — rerun it and record the result
Prevention  : Cap the instrument sweep's runtime (or split it into its own job) so one slow test cannot mark the rest of the suite red without running it.
Owner       : viet    ETA: 2026-08-20
```

```
[SCRIPT-07] Verify editing a TP target trigger price persists after Confirm
Env/Suite   : TESTNET / regression
Failures    : 1 consecutive run since 19 Aug
Root cause  : splitTPSL.spec.ts:224 reads the TP/SL table once and asserts flat.some(s => s.includes(newTrigger)); the table updates asynchronously after Confirm, so a single read taken too early finds nothing. The retry then timed out reading the Positions table at basepage.ts:1333.
Category    : race-condition (auto)
PR          : ⚠️ not linked
Verify      : ⚠️ not verified — rerun it and record the result
Prevention  : Poll the table until it contains the new trigger price (expect.poll / toPass) instead of asserting on one snapshot, so a slow refresh is a wait rather than a failure. If it still fails once the wait is in, it is a product bug — re-classify it.
Owner       : viet    ETA: 2026-08-20
```

```
[SCRIPT-08] Verify data resets when a row is deleted or the tab is switched
Env/Suite   : TESTNET / regression
Failures    : 1 consecutive run since 19 Aug
Root cause  : splitTPSLPage.ts:305 asserts the Confirm button is enabled the moment it is checked, and on retry splitTPSLPage.ts:110 gives the modal only isModalOpen(2000) to appear; both check before the sheet has settled.
Category    : race-condition (auto)
PR          : ⚠️ not linked
Verify      : ⚠️ not verified — rerun it and record the result
Prevention  : Wait for the Confirm button to become enabled rather than asserting it already is, and drop the fixed 2000ms modal window in favour of an explicit wait.
Owner       : viet    ETA: 2026-08-20
```

```
[SCRIPT-09] Verify Position TP/SL size matches the position when a trading login is active
Env/Suite   : TESTNET / regression
Failures    : 1 consecutive run since 19 Aug
Root cause  : clickIconInTable (perpetualpage.ts:1179) resolves the column with header.indexOf(column)+1 || header.length; when the header label does not match it silently falls back to the LAST column, so the Close/icon button is looked for in div[12] (div[10] on retry) and waitFor times out at 10s.
Category    : brittle-locator (auto)
PR          : ⚠️ not linked
Verify      : ⚠️ not verified — rerun it and record the result
Prevention  : Throw when the column label is not found instead of falling back to header.length — a silent fallback to the wrong column turns a rename into eight mystery timeouts.
Owner       : viet    ETA: 2026-08-20
```

```
[SCRIPT-10] Verify short position: TP trigger price must be less than mark price
Env/Suite   : TESTNET / regression
Failures    : 1 consecutive run since 19 Aug
Root cause  : clickIconInTable (perpetualpage.ts:1179) resolves the column with header.indexOf(column)+1 || header.length; when the header label does not match it silently falls back to the LAST column, so the Close/icon button is looked for in div[12] (div[10] on retry) and waitFor times out at 10s.
Category    : brittle-locator (auto)
PR          : ⚠️ not linked
Verify      : ⚠️ not verified — rerun it and record the result
Prevention  : Throw when the column label is not found instead of falling back to header.length — a silent fallback to the wrong column turns a rename into eight mystery timeouts.
Owner       : viet    ETA: 2026-08-20
```

```
[SCRIPT-11] Verify short position: in-profit SL trigger price must be between mark and entry prices
Env/Suite   : TESTNET / regression
Failures    : 1 consecutive run since 19 Aug
Root cause  : clickIconInTable (perpetualpage.ts:1179) resolves the column with header.indexOf(column)+1 || header.length; when the header label does not match it silently falls back to the LAST column, so the Close/icon button is looked for in div[12] (div[10] on retry) and waitFor times out at 10s.
Category    : brittle-locator (auto)
PR          : ⚠️ not linked
Verify      : ⚠️ not verified — rerun it and record the result
Prevention  : Throw when the column label is not found instead of falling back to header.length — a silent fallback to the wrong column turns a rename into eight mystery timeouts.
Owner       : viet    ETA: 2026-08-20
```

```
[SCRIPT-12] Verify Split TP for Short position: trigger price must be less than mark price
Env/Suite   : TESTNET / regression
Failures    : 1 consecutive run since 19 Aug
Root cause  : clickIconInTable (perpetualpage.ts:1179) resolves the column with header.indexOf(column)+1 || header.length; when the header label does not match it silently falls back to the LAST column, so the Close/icon button is looked for in div[12] (div[10] on retry) and waitFor times out at 10s.
Category    : brittle-locator (auto)
PR          : ⚠️ not linked
Verify      : ⚠️ not verified — rerun it and record the result
Prevention  : Throw when the column label is not found instead of falling back to header.length — a silent fallback to the wrong column turns a rename into eight mystery timeouts.
Owner       : viet    ETA: 2026-08-20
```

```
[SCRIPT-13] Verify SL trigger type can be selected at MAX slider on a Short position
Env/Suite   : TESTNET / regression
Failures    : 1 consecutive run since 19 Aug
Root cause  : clickIconInTable (perpetualpage.ts:1179) resolves the column with header.indexOf(column)+1 || header.length; when the header label does not match it silently falls back to the LAST column, so the Close/icon button is looked for in div[12] (div[10] on retry) and waitFor times out at 10s.
Category    : brittle-locator (auto)
PR          : ⚠️ not linked
Verify      : ⚠️ not verified — rerun it and record the result
Prevention  : Throw when the column label is not found instead of falling back to header.length — a silent fallback to the wrong column turns a rename into eight mystery timeouts.
Owner       : viet    ETA: 2026-08-20
```

```
[SCRIPT-14] Verify open limit order can be cancelled successfully
Env/Suite   : TESTNET / regression
Failures    : 1 consecutive run since 19 Aug
Root cause  : The Order price field is targeted as //label[div='Order price']/input, which never became visible within 30s, so the limit buy was never placed and there was nothing left to cancel.
Category    : brittle-locator (auto)
PR          : ⚠️ not linked
Verify      : ⚠️ not verified — rerun it and record the result
Prevention  : Target the price input by test id rather than by its visible label text, which changes with locale and copy edits.
Owner       : viet    ETA: 2026-08-20
```

```
[SCRIPT-15] Verify theme toggle, icons, and rendering work on all public pages in both themes
Env/Suite   : TESTNET / regression
Failures    : 1 consecutive run since 19 Aug
Root cause  : Never ran on its own: the Trade-Indicators instrument sweep consumed 345s and the regression job hit its time budget, so the reporter marked everything queued behind it red.
Category    : other (auto)
PR          : ⚠️ not linked
Verify      : ⚠️ not verified — rerun it and record the result
Prevention  : Cap the instrument sweep's runtime (or split it into its own job) so one slow test cannot mark the rest of the suite red without running it.
Owner       : viet    ETA: 2026-08-20
```

## 1.4 APP-BUG detail

No product bugs found in this channel today.

## 1.5 ENV — grouped, not one line per test

```
ENV cluster : 1 test(s) — same incident, same explanation
Tests       : Verify a USDC withdrawal completes and deducts the…
Hypothesis  : approveMetamask aborted: the MetaMask extension window never opened (no chrome-extension page appeared in time), so the withdrawal could not be signed.
Owner       : viet
```

_ENV failures are never fixed by changing the test._

## 1.6 Numbers for the daily log

```
Fully-green: 30% of the last 10 regression runs
Flakiness rolling 10 runs: 5.9%   (target <3%)
Failures classified: ENV 1 / APP 0 / SCRIPT 15
Failures with no verdict: 0   ✅
Smoke accuracy: n/a — this is not a smoke suite
```

### Failed earlier, green again now

Not in the table above because the latest run passed. They still need a verdict — a test that recovers on its own is flaky or platform-specific.

- **Verify login from Trade → stays on Trade** — testnet/regression, failed 1× in 24h · [run](https://github.com/gravity-technologies/qa-automation/actions/runs/32164228559/job/95799942664)
- **Verify ISOLATED liquidation price is populated and bounded for every unit…** — testnet/regression, failed 1× in 24h · [run](https://github.com/gravity-technologies/qa-automation/actions/runs/32164228559/job/95799942664)
- **Verify CROSS liquidation price respects equity coverage across every unit…** — testnet/regression, failed 1× in 24h · [run](https://github.com/gravity-technologies/qa-automation/actions/runs/32164228559/job/95799942664)
- **Verify unit-preference switching does not change the computed liquidation price** — testnet/regression, failed 1× in 24h · [run](https://github.com/gravity-technologies/qa-automation/actions/runs/32164228559/job/95799942664)
- **Verify margin-type toggle recalculates and ISOLATED is tighter than CROSS** — testnet/regression, failed 1× in 24h · [run](https://github.com/gravity-technologies/qa-automation/actions/runs/32164228559/job/95799942664)
- **Verify liquidation price reacts to slider quantity per margin type and leaves…** — testnet/regression, failed 1× in 24h · [run](https://github.com/gravity-technologies/qa-automation/actions/runs/32164228559/job/95799942664)
- **Verify liquidation price tightens monotonically as leverage increases** — testnet/regression, failed 1× in 24h · [run](https://github.com/gravity-technologies/qa-automation/actions/runs/32164228559/job/95799942664)
- **Verify the liquidation distance matches the maintenance-margin math** — testnet/regression, failed 1× in 24h · [run](https://github.com/gravity-technologies/qa-automation/actions/runs/32164228559/job/95799942664)
- **Verify invalid and boundary quantities never produce a garbage liquidation price** — testnet/regression, failed 1× in 24h · [run](https://github.com/gravity-technologies/qa-automation/actions/runs/32164228559/job/95799942664)
- **Verify rapid quantity changes settle on the same value as a direct set** — testnet/regression, failed 1× in 24h · [run](https://github.com/gravity-technologies/qa-automation/actions/runs/32164228559/job/95799942664)
- **Verify liquidation price is recomputed per instrument when switching markets** — testnet/regression, failed 1× in 24h · [run](https://github.com/gravity-technologies/qa-automation/actions/runs/32164228559/job/95799942664)
- **Verify Market and Limit-at-mark agree at the same quantity** — testnet/regression, failed 1× in 24h · [run](https://github.com/gravity-technologies/qa-automation/actions/runs/32164228559/job/95799942664)
- **Verify the liquidation price sweep creates no orders and leaves no position…** — testnet/regression, failed 1× in 24h · [run](https://github.com/gravity-technologies/qa-automation/actions/runs/32164228559/job/95799942664)
- **Verify user can burn vault shares and the burn appears in investment history** — testnet/regression, failed 1× in 24h · [run](https://github.com/gravity-technologies/qa-automation/actions/runs/32164228559/job/95799942664)
