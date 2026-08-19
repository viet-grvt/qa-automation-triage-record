# TRIAGE RECORD — 19/08/2026

Full record for the day. Block 2 is a summary of this file — it is never written from scratch.

## 1.1 Channel status

_Reviewed: **everything stored** — no suite has been signed off yet, so there is no "last checked" point to start from. Run `node tools/bin/report.js --mark-checked` when you finish today, and tomorrow's report will start from here._

| Channel | Suite | Runs since last check | Latest run | Pass/Total | Fully green? | Report |
|---|---|---|---|---|---|---|
| WEB-AUTOMATION-PROD | **smoke** | 29 (never checked) | 08-19 13:42 | 20/20 | ✅ | [report](https://github.com/gravity-technologies/qa-automation/actions/runs/32222247475/artifacts/9355066454) |
| WEB-AUTOMATION-TESTNET | **regression** | 10 (never checked) | 08-19 10:19 | 1/1 | ✅ | [report](https://github.com/gravity-technologies/qa-automation/actions/runs/32211368643/artifacts/9350973017) |
| WEB-AUTOMATION-TESTNET | **smoke** | 8 (never checked) | 08-19 06:58 | 45/45 | ✅ | [report](https://github.com/gravity-technologies/qa-automation/actions/runs/32191202927/artifacts/9346932741) |
| WEB-AUTOMATION-STAGING | **smoke** | 16 (never checked) | 08-19 06:25 | 25/43 | ❌ | [report](https://github.com/gravity-technologies/qa-automation/actions/runs/32191181406/artifacts/9346228263) |
| MOBILE-AUTOMATION-TESTNET | **long-running** | 3 (never checked) | 08-19 04:49 | 2/2 | 🕒 silent | [report](https://github.com/gravity-technologies/qa-automation/actions/runs/32180285404/artifacts/9343725165) |
| MOBILE-AUTOMATION-TESTNET | **manual** | 1 (never checked) | 08-17 15:48 | 23/23 | 🕒 silent | [report](https://github.com/gravity-technologies/qa-automation/actions/runs/32008291219/artifacts/9282140142) |
| MOBILE-AUTOMATION-TESTNET | **smoke** | 13 (never checked) | 08-19 10:16 | 23/23 | ✅ | [report](https://github.com/gravity-technologies/qa-automation/actions/runs/32208412030/artifacts/9350909070) |
| MOBILE-AUTOMATION-TESTNET | — of which iOS | — | — | never run | ❌ never | — |

**Total failures: 34** → ENV 1 · APP-BUG 0 · SCRIPT 33

**Smoke accuracy: 🔴 BREACHED** — 18 script failure(s) on a smoke suite: _Verify button layout: overflow, overlap, truncation and…_, _Verify encoding, translations, number format and horizontal…_, _Verify navigation layout: overflow, overlap and height…_, _Verify Trade-Indicators data for all instruments is…_, and 14 more (all listed in 1.3). This breaks the QE-935 100% accuracy target and has to be called out in Block 2, not buried here.

> ⚠️ **#qa-mobile-automation-testnet · long-running** last ran 13h ago. Check the schedule before reading anything into the tests.
> ⚠️ **#qa-mobile-automation-testnet · manual** last ran 2 days ago. Check the schedule before reading anything into the tests.
> ⚠️ **iOS has never run.** QE-948 Phase 1 is not started.

## 1.2 Classification — one row per failing test

### #qa-web-automation-testnet — 16 failures

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

### #qa-web-automation-staging — 18 failures

| # | Test | Suite/Env | Flaky or genuine? | Class | Root cause (one sentence) | Action | Ticket | Owner | ETA |
|---|---|---|---|---|---|---|---|---|---|
| 17 | Verify button layout: overflow, overlap, truncation and height… | smoke/staging | 🐞 likely the product · fails every run | SCRIPT | Not the product: 'Switch app language to each supported locale' passed on this same staging run at 23:16, one… | Fix | — | viet | 2026-08-19 |
| 18 | Verify encoding, translations, number format and horizontal scroll… | smoke/staging | ❔ needs a look · too early to say | SCRIPT | Not the product: 'Switch app language to each supported locale' passed on this same staging run at 23:16, one… | Fix | — | viet | 2026-08-19 |
| 19 | Verify navigation layout: overflow, overlap and height stability… | smoke/staging | ❔ needs a look · first failure | SCRIPT | Not the product: 'Switch app language to each supported locale' passed on this same staging run at 23:16, one… | Fix | — | viet | 2026-08-19 |
| 20 | Verify Trade-Indicators data for all instruments is rendered as… | smoke/staging | 🔁 likely our test · flaky pattern | SCRIPT | instrumentSelector (perpetualpage.ts:80) is a positional XPath keyed on the literal text 'Perpetual' with a… | Fix | QE-969 | viet | 2026-08-19 |
| 21 | Verify user can remove margin from an Isolated position | smoke/staging | 🔁 likely our test · flaky pattern | SCRIPT | instrumentSelector (perpetualpage.ts:80) is a positional XPath keyed on the literal text 'Perpetual' with a… | Fix | — | viet | 2026-08-19 |
| 22 | Verify all records under the Recent Trades tab are populated as… | smoke/staging | ❔ needs a look · too early to say | SCRIPT | instrumentSelector (perpetualpage.ts:80) is a positional XPath keyed on the literal text 'Perpetual' with a… | Fix | — | viet | 2026-08-19 |
| 23 | Verify Order-Book data is displayed as expected | smoke/staging | ❔ needs a look · too early to say | SCRIPT | instrumentSelector (perpetualpage.ts:80) is a positional XPath keyed on the literal text 'Perpetual' with a… | Fix | — | viet | 2026-08-19 |
| 24 | Verify Order-Book is not crossed (BEST_BID lower than BEST_ASK) | smoke/staging | ❔ needs a look · too early to say | SCRIPT | instrumentSelector (perpetualpage.ts:80) is a positional XPath keyed on the literal text 'Perpetual' with a… | Fix | — | viet | 2026-08-19 |
| 25 | Verify MARKET BUY/SELL order can be placed successfully | smoke/staging | ❔ needs a look · too early to say | SCRIPT | instrumentSelector (perpetualpage.ts:80) is a positional XPath keyed on the literal text 'Perpetual' with a… | Fix | — | viet | 2026-08-19 |
| 26 | Verify order placement succeeds when quantity is expressed in USDT… | smoke/staging | ❔ needs a look · too early to say | SCRIPT | instrumentSelector (perpetualpage.ts:80) is a positional XPath keyed on the literal text 'Perpetual' with a… | Fix | — | viet | 2026-08-19 |
| 27 | Verify REDUCE_ONLY type orders can be placed successfully | smoke/staging | ❔ needs a look · too early to say | SCRIPT | instrumentSelector (perpetualpage.ts:80) is a positional XPath keyed on the literal text 'Perpetual' with a… | Fix | — | viet | 2026-08-19 |
| 28 | Verify IOC type orders can be placed successfully | smoke/staging | ❔ needs a look · too early to say | SCRIPT | instrumentSelector (perpetualpage.ts:80) is a positional XPath keyed on the literal text 'Perpetual' with a… | Fix | — | viet | 2026-08-19 |
| 29 | Verify FOK type orders can be placed successfully | smoke/staging | ❔ needs a look · too early to say | SCRIPT | instrumentSelector (perpetualpage.ts:80) is a positional XPath keyed on the literal text 'Perpetual' with a… | Fix | — | viet | 2026-08-19 |
| 30 | Verify POST_ONLY type orders can be placed successfully | smoke/staging | ❔ needs a look · too early to say | SCRIPT | instrumentSelector (perpetualpage.ts:80) is a positional XPath keyed on the literal text 'Perpetual' with a… | Fix | — | viet | 2026-08-19 |
| 31 | Verify the top-level navigation header renders on every page | smoke/staging | ❔ needs a look · too early to say | SCRIPT | headerNavPage.ts:405 asserts the prod-shaped item list; staging renders only [Earn APY | Trade | Invest] on… | Fix | — | viet | 2026-08-20 |
| 32 | Verify MARKET order can be placed using Isolated margin mode | smoke/staging | ❔ needs a look · too early to say | SCRIPT | instrumentSelector (perpetualpage.ts:80) is a positional XPath keyed on the literal text 'Perpetual' with a… | Fix | — | viet | 2026-08-19 |
| 33 | Verify LIMIT order can be placed using Isolated margin mode | smoke/staging | ❔ needs a look · too early to say | SCRIPT | instrumentSelector (perpetualpage.ts:80) is a positional XPath keyed on the literal text 'Perpetual' with a… | Fix | — | viet | 2026-08-19 |
| 34 | Verify user can add margin to an Isolated position | smoke/staging | ❔ needs a look · too early to say | SCRIPT | instrumentSelector (perpetualpage.ts:80) is a positional XPath keyed on the literal text 'Perpetual' with a… | Fix | — | viet | 2026-08-19 |

_Action is one of: **Fix** · **Quarantine** · **Raise PRO** · **Monitor (ENV)**. A row without an owner and an ETA is not finished triage._

## 1.3 SCRIPT detail

> This is what separates "fixed it" from "understood why it broke". **Prevention is mandatory.**

### #qa-web-automation-testnet

```
[SCRIPT-01] Verify long position: in-profit SL trigger price must be between entry and mark prices
Env/Suite   : TESTNET / regression
Failures    : 1 consecutive run since 18 Aug
Root cause  : clickIconInTable (perpetualpage.ts:1179) resolves the column with header.indexOf(column)+1 || header.length; when the header label does not match it silently falls back to the LAST column, so the Close/icon button is looked for in div[12] (div[10] on retry) and waitFor times out at 10s.
Fix         : ⚠️ not recorded
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
Fix         : ⚠️ not recorded
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
Fix         : ⚠️ not recorded
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
Fix         : ⚠️ not recorded
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
Fix         : ⚠️ not recorded
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
Fix         : ⚠️ not recorded
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
Fix         : ⚠️ not recorded
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
Fix         : ⚠️ not recorded
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
Fix         : ⚠️ not recorded
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
Fix         : ⚠️ not recorded
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
Fix         : ⚠️ not recorded
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
Fix         : ⚠️ not recorded
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
Fix         : ⚠️ not recorded
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
Fix         : ⚠️ not recorded
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
Fix         : ⚠️ not recorded
Category    : other (auto)
PR          : ⚠️ not linked
Verify      : ⚠️ not verified — rerun it and record the result
Prevention  : Cap the instrument sweep's runtime (or split it into its own job) so one slow test cannot mark the rest of the suite red without running it.
Owner       : viet    ETA: 2026-08-20
```

### #qa-web-automation-staging

```
[SCRIPT-16] Verify button layout: overflow, overlap, truncation and height stability across all locales
Env/Suite   : STAGING / smoke
Failures    : 16 consecutive runs since 15 Aug
Root cause  : Not the product: 'Switch app language to each supported locale' passed on this same staging run at 23:16, one minute before this test failed at 23:17. The panel's English option is present but hidden, so the app is left in a state by the preceding locale test that changeLanguage (commonPage.ts:48) does not reset before the next test tries to switch back.
Fix         : ⚠️ not recorded
Category    : shared-state (auto)
PR          : ⚠️ not linked
Verify      : ⚠️ not verified — rerun it and record the result
Prevention  : Reset the locale to English in an afterEach/beforeEach rather than relying on the next test to switch back, so one locale test cannot leave the next three red.
Owner       : viet    ETA: 2026-08-19
```

```
[SCRIPT-17] Verify encoding, translations, number format and horizontal scroll across all locales
Env/Suite   : STAGING / smoke
Failures    : 2 consecutive runs since 18 Aug
Root cause  : Not the product: 'Switch app language to each supported locale' passed on this same staging run at 23:16, one minute before this test failed at 23:17. The panel's English option is present but hidden, so the app is left in a state by the preceding locale test that changeLanguage (commonPage.ts:48) does not reset before the next test tries to switch back.
Fix         : ⚠️ not recorded
Category    : shared-state (auto)
PR          : ⚠️ not linked
Verify      : ⚠️ not verified — rerun it and record the result
Prevention  : Reset the locale to English in an afterEach/beforeEach rather than relying on the next test to switch back, so one locale test cannot leave the next three red.
Owner       : viet    ETA: 2026-08-19
```

```
[SCRIPT-18] Verify navigation layout: overflow, overlap and height stability across all locales
Env/Suite   : STAGING / smoke
Failures    : 1 consecutive run since 15 Aug
Root cause  : Not the product: 'Switch app language to each supported locale' passed on this same staging run at 23:16, one minute before this test failed at 23:17. The panel's English option is present but hidden, so the app is left in a state by the preceding locale test that changeLanguage (commonPage.ts:48) does not reset before the next test tries to switch back.
Fix         : ⚠️ not recorded
Category    : shared-state (auto)
PR          : ⚠️ not linked
Verify      : ⚠️ not verified — rerun it and record the result
Prevention  : Reset the locale to English in an afterEach/beforeEach rather than relying on the next test to switch back, so one locale test cannot leave the next three red.
Owner       : viet    ETA: 2026-08-19
```

```
[SCRIPT-19] Verify Trade-Indicators data for all instruments is rendered as expected
Env/Suite   : STAGING / smoke
Failures    : 1 consecutive run since 18 Aug
Root cause  : instrumentSelector (perpetualpage.ts:80) is a positional XPath keyed on the literal text 'Perpetual' with a preceding-sibling containing 'USDT'; it matches nothing in staging's trade header, so getActiveInstrument's textContent waits the full 30s on every instrument switch.
Fix         : see PR
Category    : brittle-locator (auto)
PR          : https://grvt.atlassian.net/browse/QE-969
Verify      : ⚠️ not verified — rerun it and record the result
Prevention  : Replace the positional XPath with a stable test id on the instrument name, so the trade header can be restyled without breaking every order and market-data test at once.
Owner       : viet    ETA: 2026-08-19
```

```
[SCRIPT-20] Verify user can remove margin from an Isolated position
Env/Suite   : STAGING / smoke
Failures    : 1 consecutive run since 18 Aug
Root cause  : instrumentSelector (perpetualpage.ts:80) is a positional XPath keyed on the literal text 'Perpetual' with a preceding-sibling containing 'USDT'; it matches nothing in staging's trade header, so getActiveInstrument's textContent waits the full 30s on every instrument switch.
Fix         : ⚠️ not recorded
Category    : brittle-locator (auto)
PR          : ⚠️ not linked
Verify      : ⚠️ not verified — rerun it and record the result
Prevention  : Replace the positional XPath with a stable test id on the instrument name, so the trade header can be restyled without breaking every order and market-data test at once.
Owner       : viet    ETA: 2026-08-19
```

```
[SCRIPT-21] Verify all records under the Recent Trades tab are populated as expected
Env/Suite   : STAGING / smoke
Failures    : 1 consecutive run since 19 Aug
Root cause  : instrumentSelector (perpetualpage.ts:80) is a positional XPath keyed on the literal text 'Perpetual' with a preceding-sibling containing 'USDT'; it matches nothing in staging's trade header, so getActiveInstrument's textContent waits the full 30s on every instrument switch.
Fix         : ⚠️ not recorded
Category    : brittle-locator (auto)
PR          : ⚠️ not linked
Verify      : ⚠️ not verified — rerun it and record the result
Prevention  : Replace the positional XPath with a stable test id on the instrument name, so the trade header can be restyled without breaking every order and market-data test at once.
Owner       : viet    ETA: 2026-08-19
```

```
[SCRIPT-22] Verify Order-Book data is displayed as expected
Env/Suite   : STAGING / smoke
Failures    : 1 consecutive run since 19 Aug
Root cause  : instrumentSelector (perpetualpage.ts:80) is a positional XPath keyed on the literal text 'Perpetual' with a preceding-sibling containing 'USDT'; it matches nothing in staging's trade header, so getActiveInstrument's textContent waits the full 30s on every instrument switch.
Fix         : ⚠️ not recorded
Category    : brittle-locator (auto)
PR          : ⚠️ not linked
Verify      : ⚠️ not verified — rerun it and record the result
Prevention  : Replace the positional XPath with a stable test id on the instrument name, so the trade header can be restyled without breaking every order and market-data test at once.
Owner       : viet    ETA: 2026-08-19
```

```
[SCRIPT-23] Verify Order-Book is not crossed (BEST_BID lower than BEST_ASK)
Env/Suite   : STAGING / smoke
Failures    : 1 consecutive run since 19 Aug
Root cause  : instrumentSelector (perpetualpage.ts:80) is a positional XPath keyed on the literal text 'Perpetual' with a preceding-sibling containing 'USDT'; it matches nothing in staging's trade header, so getActiveInstrument's textContent waits the full 30s on every instrument switch.
Fix         : ⚠️ not recorded
Category    : brittle-locator (auto)
PR          : ⚠️ not linked
Verify      : ⚠️ not verified — rerun it and record the result
Prevention  : Replace the positional XPath with a stable test id on the instrument name, so the trade header can be restyled without breaking every order and market-data test at once.
Owner       : viet    ETA: 2026-08-19
```

```
[SCRIPT-24] Verify MARKET BUY/SELL order can be placed successfully
Env/Suite   : STAGING / smoke
Failures    : 1 consecutive run since 19 Aug
Root cause  : instrumentSelector (perpetualpage.ts:80) is a positional XPath keyed on the literal text 'Perpetual' with a preceding-sibling containing 'USDT'; it matches nothing in staging's trade header, so getActiveInstrument's textContent waits the full 30s on every instrument switch.
Fix         : ⚠️ not recorded
Category    : brittle-locator (auto)
PR          : ⚠️ not linked
Verify      : ⚠️ not verified — rerun it and record the result
Prevention  : Replace the positional XPath with a stable test id on the instrument name, so the trade header can be restyled without breaking every order and market-data test at once.
Owner       : viet    ETA: 2026-08-19
```

```
[SCRIPT-25] Verify order placement succeeds when quantity is expressed in USDT Notional
Env/Suite   : STAGING / smoke
Failures    : 1 consecutive run since 19 Aug
Root cause  : instrumentSelector (perpetualpage.ts:80) is a positional XPath keyed on the literal text 'Perpetual' with a preceding-sibling containing 'USDT'; it matches nothing in staging's trade header, so getActiveInstrument's textContent waits the full 30s on every instrument switch.
Fix         : ⚠️ not recorded
Category    : brittle-locator (auto)
PR          : ⚠️ not linked
Verify      : ⚠️ not verified — rerun it and record the result
Prevention  : Replace the positional XPath with a stable test id on the instrument name, so the trade header can be restyled without breaking every order and market-data test at once.
Owner       : viet    ETA: 2026-08-19
```

```
[SCRIPT-26] Verify REDUCE_ONLY type orders can be placed successfully
Env/Suite   : STAGING / smoke
Failures    : 1 consecutive run since 19 Aug
Root cause  : instrumentSelector (perpetualpage.ts:80) is a positional XPath keyed on the literal text 'Perpetual' with a preceding-sibling containing 'USDT'; it matches nothing in staging's trade header, so getActiveInstrument's textContent waits the full 30s on every instrument switch.
Fix         : ⚠️ not recorded
Category    : brittle-locator (auto)
PR          : ⚠️ not linked
Verify      : ⚠️ not verified — rerun it and record the result
Prevention  : Replace the positional XPath with a stable test id on the instrument name, so the trade header can be restyled without breaking every order and market-data test at once.
Owner       : viet    ETA: 2026-08-19
```

```
[SCRIPT-27] Verify IOC type orders can be placed successfully
Env/Suite   : STAGING / smoke
Failures    : 1 consecutive run since 19 Aug
Root cause  : instrumentSelector (perpetualpage.ts:80) is a positional XPath keyed on the literal text 'Perpetual' with a preceding-sibling containing 'USDT'; it matches nothing in staging's trade header, so getActiveInstrument's textContent waits the full 30s on every instrument switch.
Fix         : ⚠️ not recorded
Category    : brittle-locator (auto)
PR          : ⚠️ not linked
Verify      : ⚠️ not verified — rerun it and record the result
Prevention  : Replace the positional XPath with a stable test id on the instrument name, so the trade header can be restyled without breaking every order and market-data test at once.
Owner       : viet    ETA: 2026-08-19
```

```
[SCRIPT-28] Verify FOK type orders can be placed successfully
Env/Suite   : STAGING / smoke
Failures    : 1 consecutive run since 19 Aug
Root cause  : instrumentSelector (perpetualpage.ts:80) is a positional XPath keyed on the literal text 'Perpetual' with a preceding-sibling containing 'USDT'; it matches nothing in staging's trade header, so getActiveInstrument's textContent waits the full 30s on every instrument switch.
Fix         : ⚠️ not recorded
Category    : brittle-locator (auto)
PR          : ⚠️ not linked
Verify      : ⚠️ not verified — rerun it and record the result
Prevention  : Replace the positional XPath with a stable test id on the instrument name, so the trade header can be restyled without breaking every order and market-data test at once.
Owner       : viet    ETA: 2026-08-19
```

```
[SCRIPT-29] Verify POST_ONLY type orders can be placed successfully
Env/Suite   : STAGING / smoke
Failures    : 1 consecutive run since 19 Aug
Root cause  : instrumentSelector (perpetualpage.ts:80) is a positional XPath keyed on the literal text 'Perpetual' with a preceding-sibling containing 'USDT'; it matches nothing in staging's trade header, so getActiveInstrument's textContent waits the full 30s on every instrument switch.
Fix         : ⚠️ not recorded
Category    : brittle-locator (auto)
PR          : ⚠️ not linked
Verify      : ⚠️ not verified — rerun it and record the result
Prevention  : Replace the positional XPath with a stable test id on the instrument name, so the trade header can be restyled without breaking every order and market-data test at once.
Owner       : viet    ETA: 2026-08-19
```

```
[SCRIPT-30] Verify the top-level navigation header renders on every page
Env/Suite   : STAGING / smoke
Failures    : 1 consecutive run since 19 Aug
Root cause  : headerNavPage.ts:405 asserts the prod-shaped item list; staging renders only [Earn APY | Trade | Invest] on all 3 pages, so the expected set is wrong for this environment.
Fix         : ⚠️ not recorded
Category    : assertion-wrong (auto)
PR          : ⚠️ not linked
Verify      : ⚠️ not verified — rerun it and record the result
Prevention  : Derive the expected header items per environment instead of hard-coding one list, so a staging-only nav change does not read as a failure.
Owner       : viet    ETA: 2026-08-20
```

```
[SCRIPT-31] Verify MARKET order can be placed using Isolated margin mode
Env/Suite   : STAGING / smoke
Failures    : 1 consecutive run since 19 Aug
Root cause  : instrumentSelector (perpetualpage.ts:80) is a positional XPath keyed on the literal text 'Perpetual' with a preceding-sibling containing 'USDT'; it matches nothing in staging's trade header, so getActiveInstrument's textContent waits the full 30s on every instrument switch.
Fix         : ⚠️ not recorded
Category    : brittle-locator (auto)
PR          : ⚠️ not linked
Verify      : ⚠️ not verified — rerun it and record the result
Prevention  : Replace the positional XPath with a stable test id on the instrument name, so the trade header can be restyled without breaking every order and market-data test at once.
Owner       : viet    ETA: 2026-08-19
```

```
[SCRIPT-32] Verify LIMIT order can be placed using Isolated margin mode
Env/Suite   : STAGING / smoke
Failures    : 1 consecutive run since 19 Aug
Root cause  : instrumentSelector (perpetualpage.ts:80) is a positional XPath keyed on the literal text 'Perpetual' with a preceding-sibling containing 'USDT'; it matches nothing in staging's trade header, so getActiveInstrument's textContent waits the full 30s on every instrument switch.
Fix         : ⚠️ not recorded
Category    : brittle-locator (auto)
PR          : ⚠️ not linked
Verify      : ⚠️ not verified — rerun it and record the result
Prevention  : Replace the positional XPath with a stable test id on the instrument name, so the trade header can be restyled without breaking every order and market-data test at once.
Owner       : viet    ETA: 2026-08-19
```

```
[SCRIPT-33] Verify user can add margin to an Isolated position
Env/Suite   : STAGING / smoke
Failures    : 1 consecutive run since 19 Aug
Root cause  : instrumentSelector (perpetualpage.ts:80) is a positional XPath keyed on the literal text 'Perpetual' with a preceding-sibling containing 'USDT'; it matches nothing in staging's trade header, so getActiveInstrument's textContent waits the full 30s on every instrument switch.
Fix         : ⚠️ not recorded
Category    : brittle-locator (auto)
PR          : ⚠️ not linked
Verify      : ⚠️ not verified — rerun it and record the result
Prevention  : Replace the positional XPath with a stable test id on the instrument name, so the trade header can be restyled without breaking every order and market-data test at once.
Owner       : viet    ETA: 2026-08-19
```

⚠️ 1 of 33 script failures have no prevention step recorded. Record it with `node tools/bin/script-rca.js --record ... --prevention "..."`.

## 1.4 APP-BUG detail

No product bugs found today.

## 1.5 ENV — grouped, not one line per test

### #qa-web-automation-testnet

```
ENV cluster : 1 test(s) — same incident, same explanation
Tests       : Verify a USDC withdrawal completes and deducts the…
Hypothesis  : approveMetamask aborted: the MetaMask extension window never opened (no chrome-extension page appeared in time), so the withdrawal could not be signed.
Proposal    : add an env-health precondition before the suite, or retry-with-tagging so these do not count towards flakiness
Owner       : viet
```

_ENV failures are never fixed by changing the test._

## 1.6 Numbers for the daily log

```
Fully-green: PROD/smoke 100% · TESTNET/regression 30% · TESTNET/smoke 87.5% · STAGING/smoke 0% · MOBILE-TESTNET/long-running 66.7% · MOBILE-TESTNET/manual 100% · MOBILE-TESTNET/smoke 53.8%
Flakiness rolling 10 runs: WEB 6.3% · MOBILE 0%   (target <3%)
Failures classified: ENV 1 / APP 0 / SCRIPT 33
Failures with no verdict: 0   ✅
Smoke accuracy: BREACHED
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

---

<details><summary>Terms used above</summary>

| Term | Meaning | Whose job |
|---|---|---|
| **ENV** | the test environment broke, not the product and not our test | infra — we do not change the test |
| **APP-BUG** | the product genuinely misbehaves; a customer could hit this | the dev team — needs a PRO ticket |
| **SCRIPT** | the product is fine; our automated test is flaky, outdated or badly written | us — QA automation |
| **Smoke** | The short suite that runs constantly; it must be trustworthy, so a false alarm here is urgent. | — |
| **Regression** | The long suite. Slower, run less often, more tolerant of noise. | — |
| **Quarantine** | Switching a test off deliberately, always with a ticket and a review date. | — |
| **Fully green** | A run that finished with zero failures. | — |

</details>

<details><summary>Per-failure evidence and commands</summary>

**Verify button layout: overflow, overlap, truncation and height stability across all locales** — web-staging
- 16 in a row (worst 16), 100% of the last 10 runs
- Code: `ui_tests/tests/languageUiLayout.spec.ts:289`
- Last edited 2026-08-11 by Pham The Viet — fix: Verify every page displays the selected language correctly (#1313)
- [Actions job](https://github.com/gravity-technologies/qa-automation/actions/runs/32191181406/job/95885663223) · [report](https://github.com/gravity-technologies/qa-automation/actions/runs/32191181406/artifacts/9346228263)
- `gh run view 32191181406 --log-failed -R gravity-technologies/qa-automation`

**Verify encoding, translations, number format and horizontal scroll across all locales** — web-staging
- 2 in a row (worst 2), 100% of the last 2 runs
- Code: `ui_tests/tests/languageUiLayout.spec.ts:442`
- Last edited 2026-08-11 by Pham The Viet — fix: Verify every page displays the selected language correctly (#1313)
- [Actions job](https://github.com/gravity-technologies/qa-automation/actions/runs/32191181406/job/95885663223) · [report](https://github.com/gravity-technologies/qa-automation/actions/runs/32191181406/artifacts/9346228263)
- `gh run view 32191181406 --log-failed -R gravity-technologies/qa-automation`

**Verify navigation layout: overflow, overlap and height stability across all locales** — web-staging
- 1 in a row (worst 1), 10% of the last 10 runs
- Code: `ui_tests/tests/languageUiLayout.spec.ts:326`
- Last edited 2026-08-11 by Pham The Viet — fix: Verify every page displays the selected language correctly (#1313)
- [Actions job](https://github.com/gravity-technologies/qa-automation/actions/runs/32191181406/job/95885663223) · [report](https://github.com/gravity-technologies/qa-automation/actions/runs/32191181406/artifacts/9346228263)
- `gh run view 32191181406 --log-failed -R gravity-technologies/qa-automation`

**Verify Trade-Indicators data for all instruments is rendered as expected** — web-staging
- 1 in a row (worst 1), 50% of the last 4 runs
- Code: `ui_tests/tests/e2e_tests.spec.ts:59`
- Last edited 2026-08-19 by Pham The Viet — fix: Verify open limit order can be cancelled successfully (#1356)
- [Actions job](https://github.com/gravity-technologies/qa-automation/actions/runs/32191181406/job/95885663223) · [report](https://github.com/gravity-technologies/qa-automation/actions/runs/32191181406/artifacts/9346228263)
- `gh run view 32191181406 --log-failed -R gravity-technologies/qa-automation`

**Verify user can remove margin from an Isolated position** — web-staging
- 1 in a row (worst 1), 66.7% of the last 3 runs, only on chrome
- Code: `ui_tests/tests/placeOrders/isolatedMarginMode.spec.ts:260`
- Last edited 2026-08-19 by Pham The Viet — fix: Verify open limit order can be cancelled successfully (#1356)
- [Actions job](https://github.com/gravity-technologies/qa-automation/actions/runs/32191181406/job/95885663223) · [report](https://github.com/gravity-technologies/qa-automation/actions/runs/32191181406/artifacts/9346228263)
- `gh run view 32191181406 --log-failed -R gravity-technologies/qa-automation`

**Verify all records under the Recent Trades tab are populated as expected** — web-staging
- 1 in a row (worst 1), 100% of the last 1 runs
- Code: `ui_tests/tests/e2e_tests.spec.ts:139`
- Last edited 2026-08-19 by Pham The Viet — fix: Verify open limit order can be cancelled successfully (#1356)
- [Actions job](https://github.com/gravity-technologies/qa-automation/actions/runs/32191181406/job/95885663223) · [report](https://github.com/gravity-technologies/qa-automation/actions/runs/32191181406/artifacts/9346228263)
- `gh run view 32191181406 --log-failed -R gravity-technologies/qa-automation`

**Verify Order-Book data is displayed as expected** — web-staging
- 1 in a row (worst 1), 100% of the last 1 runs
- Code: `ui_tests/tests/e2e_tests.spec.ts:163`
- Last edited 2026-08-19 by Pham The Viet — fix: Verify open limit order can be cancelled successfully (#1356)
- [Actions job](https://github.com/gravity-technologies/qa-automation/actions/runs/32191181406/job/95885663223) · [report](https://github.com/gravity-technologies/qa-automation/actions/runs/32191181406/artifacts/9346228263)
- `gh run view 32191181406 --log-failed -R gravity-technologies/qa-automation`

**Verify Order-Book is not crossed (BEST_BID lower than BEST_ASK)** — web-staging
- 1 in a row (worst 1), 100% of the last 1 runs
- Code: `ui_tests/tests/e2e_tests.spec.ts:205`
- Last edited 2026-08-19 by Pham The Viet — fix: Verify open limit order can be cancelled successfully (#1356)
- [Actions job](https://github.com/gravity-technologies/qa-automation/actions/runs/32191181406/job/95885663223) · [report](https://github.com/gravity-technologies/qa-automation/actions/runs/32191181406/artifacts/9346228263)
- `gh run view 32191181406 --log-failed -R gravity-technologies/qa-automation`

**Verify MARKET BUY/SELL order can be placed successfully** — web-staging
- 1 in a row (worst 1), 100% of the last 1 runs
- Code: `ui_tests/tests/e2e_tests.spec.ts:352`
- Last edited 2026-08-19 by Pham The Viet — fix: Verify open limit order can be cancelled successfully (#1356)
- [Actions job](https://github.com/gravity-technologies/qa-automation/actions/runs/32191181406/job/95885663223) · [report](https://github.com/gravity-technologies/qa-automation/actions/runs/32191181406/artifacts/9346228263)
- `gh run view 32191181406 --log-failed -R gravity-technologies/qa-automation`

**Verify order placement succeeds when quantity is expressed in USDT Notional** — web-staging
- 1 in a row (worst 1), 100% of the last 1 runs
- Code: `ui_tests/tests/e2e_tests.spec.ts:378`
- Last edited 2026-08-19 by Pham The Viet — fix: Verify open limit order can be cancelled successfully (#1356)
- [Actions job](https://github.com/gravity-technologies/qa-automation/actions/runs/32191181406/job/95885663223) · [report](https://github.com/gravity-technologies/qa-automation/actions/runs/32191181406/artifacts/9346228263)
- `gh run view 32191181406 --log-failed -R gravity-technologies/qa-automation`

**Verify REDUCE_ONLY type orders can be placed successfully** — web-staging
- 1 in a row (worst 1), 100% of the last 1 runs
- Code: `ui_tests/tests/e2e_tests.spec.ts:405`
- Last edited 2026-08-19 by Pham The Viet — fix: Verify open limit order can be cancelled successfully (#1356)
- [Actions job](https://github.com/gravity-technologies/qa-automation/actions/runs/32191181406/job/95885663223) · [report](https://github.com/gravity-technologies/qa-automation/actions/runs/32191181406/artifacts/9346228263)
- `gh run view 32191181406 --log-failed -R gravity-technologies/qa-automation`

**Verify IOC type orders can be placed successfully** — web-staging
- 1 in a row (worst 1), 100% of the last 1 runs
- Code: `ui_tests/tests/e2e_tests.spec.ts:443`
- Last edited 2026-08-19 by Pham The Viet — fix: Verify open limit order can be cancelled successfully (#1356)
- [Actions job](https://github.com/gravity-technologies/qa-automation/actions/runs/32191181406/job/95885663223) · [report](https://github.com/gravity-technologies/qa-automation/actions/runs/32191181406/artifacts/9346228263)
- `gh run view 32191181406 --log-failed -R gravity-technologies/qa-automation`

**Verify FOK type orders can be placed successfully** — web-staging
- 1 in a row (worst 1), 100% of the last 1 runs
- Code: `ui_tests/tests/e2e_tests.spec.ts:478`
- Last edited 2026-08-19 by Pham The Viet — fix: Verify open limit order can be cancelled successfully (#1356)
- [Actions job](https://github.com/gravity-technologies/qa-automation/actions/runs/32191181406/job/95885663223) · [report](https://github.com/gravity-technologies/qa-automation/actions/runs/32191181406/artifacts/9346228263)
- `gh run view 32191181406 --log-failed -R gravity-technologies/qa-automation`

**Verify POST_ONLY type orders can be placed successfully** — web-staging
- 1 in a row (worst 1), 100% of the last 1 runs
- Code: `ui_tests/tests/e2e_tests.spec.ts:513`
- Last edited 2026-08-19 by Pham The Viet — fix: Verify open limit order can be cancelled successfully (#1356)
- [Actions job](https://github.com/gravity-technologies/qa-automation/actions/runs/32191181406/job/95885663223) · [report](https://github.com/gravity-technologies/qa-automation/actions/runs/32191181406/artifacts/9346228263)
- `gh run view 32191181406 --log-failed -R gravity-technologies/qa-automation`

**Verify the top-level navigation header renders on every page** — web-staging
- 1 in a row (worst 1), 100% of the last 1 runs
- Code: `ui_tests/tests/headerNav.spec.ts:67`
- Last edited 2026-08-18 by Pham The Viet — QE-950: Fix flaky navigation header tests on production smoke run (#1348)
- [Actions job](https://github.com/gravity-technologies/qa-automation/actions/runs/32191181406/job/95885663223) · [report](https://github.com/gravity-technologies/qa-automation/actions/runs/32191181406/artifacts/9346228263)
- `gh run view 32191181406 --log-failed -R gravity-technologies/qa-automation`

**Verify MARKET order can be placed using Isolated margin mode** — web-staging
- 1 in a row (worst 1), 100% of the last 1 runs
- Code: `ui_tests/tests/placeOrders/isolatedMarginMode.spec.ts:116`
- Last edited 2026-08-19 by Pham The Viet — fix: Verify open limit order can be cancelled successfully (#1356)
- [Actions job](https://github.com/gravity-technologies/qa-automation/actions/runs/32191181406/job/95885663223) · [report](https://github.com/gravity-technologies/qa-automation/actions/runs/32191181406/artifacts/9346228263)
- `gh run view 32191181406 --log-failed -R gravity-technologies/qa-automation`

**Verify LIMIT order can be placed using Isolated margin mode** — web-staging
- 1 in a row (worst 1), 100% of the last 1 runs
- Code: `ui_tests/tests/placeOrders/isolatedMarginMode.spec.ts:153`
- Last edited 2026-08-19 by Pham The Viet — fix: Verify open limit order can be cancelled successfully (#1356)
- [Actions job](https://github.com/gravity-technologies/qa-automation/actions/runs/32191181406/job/95885663223) · [report](https://github.com/gravity-technologies/qa-automation/actions/runs/32191181406/artifacts/9346228263)
- `gh run view 32191181406 --log-failed -R gravity-technologies/qa-automation`

**Verify user can add margin to an Isolated position** — web-staging
- 1 in a row (worst 1), 100% of the last 1 runs
- Code: `ui_tests/tests/placeOrders/isolatedMarginMode.spec.ts:195`
- Last edited 2026-08-19 by Pham The Viet — fix: Verify open limit order can be cancelled successfully (#1356)
- [Actions job](https://github.com/gravity-technologies/qa-automation/actions/runs/32191181406/job/95885663223) · [report](https://github.com/gravity-technologies/qa-automation/actions/runs/32191181406/artifacts/9346228263)
- `gh run view 32191181406 --log-failed -R gravity-technologies/qa-automation`

**Verify long position: in-profit SL trigger price must be between entry and mark prices** — web-testnet
- 1 in a row (worst 1), 66.7% of the last 3 runs
- Code: `ui_tests/tests/placeOrders/tpslTriggerPriceRangeValidation.spec.ts:49`
- Last edited 2026-08-19 by Pham The Viet — fix: Verify open limit order can be cancelled successfully (#1356)
- [Actions job](https://github.com/gravity-technologies/qa-automation/actions/runs/32163926749/job/95798956155) · [report](https://github.com/gravity-technologies/qa-automation/actions/runs/32163926749/artifacts/9342813999)
- `gh run view 32163926749 --log-failed -R gravity-technologies/qa-automation`

**Verify a USDC withdrawal completes and deducts the Funding account balance** — web-testnet
- 1 in a row (worst 1), 100% of the last 1 runs
- Code: `ui_tests/tests/deposit/withdrawal.spec.ts:201`
- Last edited 2026-08-19 by Pham The Viet — fix: Verify open limit order can be cancelled successfully (#1356)
- [Actions job](https://github.com/gravity-technologies/qa-automation/actions/runs/32163926749/job/95798956155) · [report](https://github.com/gravity-technologies/qa-automation/actions/runs/32163926749/artifacts/9342813999)
- `gh run view 32163926749 --log-failed -R gravity-technologies/qa-automation`

**Verify Trade-Indicators data for all instruments is rendered as expected** — web-testnet
- 1 in a row (worst 1), 100% of the last 1 runs
- Code: `ui_tests/tests/e2e_tests.spec.ts:59`
- Last edited 2026-08-19 by Pham The Viet — fix: Verify open limit order can be cancelled successfully (#1356)
- [Actions job](https://github.com/gravity-technologies/qa-automation/actions/runs/32163926749/job/95798956155) · [report](https://github.com/gravity-technologies/qa-automation/actions/runs/32163926749/artifacts/9342813999)
- `gh run view 32163926749 --log-failed -R gravity-technologies/qa-automation`

**Verify all records under the Recent Trades tab are populated as expected** — web-testnet
- 1 in a row (worst 1), 100% of the last 1 runs
- Code: `ui_tests/tests/e2e_tests.spec.ts:139`
- Last edited 2026-08-19 by Pham The Viet — fix: Verify open limit order can be cancelled successfully (#1356)
- [Actions job](https://github.com/gravity-technologies/qa-automation/actions/runs/32163926749/job/95798956155) · [report](https://github.com/gravity-technologies/qa-automation/actions/runs/32163926749/artifacts/9342813999)
- `gh run view 32163926749 --log-failed -R gravity-technologies/qa-automation`

**Verify Order-Book data is displayed as expected** — web-testnet
- 1 in a row (worst 1), 100% of the last 1 runs
- Code: `ui_tests/tests/e2e_tests.spec.ts:163`
- Last edited 2026-08-19 by Pham The Viet — fix: Verify open limit order can be cancelled successfully (#1356)
- [Actions job](https://github.com/gravity-technologies/qa-automation/actions/runs/32163926749/job/95798956155) · [report](https://github.com/gravity-technologies/qa-automation/actions/runs/32163926749/artifacts/9342813999)
- `gh run view 32163926749 --log-failed -R gravity-technologies/qa-automation`

**Verify trading chart candle-sticks are rendered as expected** — web-testnet
- 1 in a row (worst 1), 100% of the last 1 runs
- Code: `ui_tests/tests/e2e_tests.spec.ts:189`
- Last edited 2026-08-19 by Pham The Viet — fix: Verify open limit order can be cancelled successfully (#1356)
- [Actions job](https://github.com/gravity-technologies/qa-automation/actions/runs/32163926749/job/95798956155) · [report](https://github.com/gravity-technologies/qa-automation/actions/runs/32163926749/artifacts/9342813999)
- `gh run view 32163926749 --log-failed -R gravity-technologies/qa-automation`

**Verify Order-Book is not crossed (BEST_BID lower than BEST_ASK)** — web-testnet
- 1 in a row (worst 1), 100% of the last 1 runs
- Code: `ui_tests/tests/e2e_tests.spec.ts:205`
- Last edited 2026-08-19 by Pham The Viet — fix: Verify open limit order can be cancelled successfully (#1356)
- [Actions job](https://github.com/gravity-technologies/qa-automation/actions/runs/32163926749/job/95798956155) · [report](https://github.com/gravity-technologies/qa-automation/actions/runs/32163926749/artifacts/9342813999)
- `gh run view 32163926749 --log-failed -R gravity-technologies/qa-automation`

**Verify editing a TP target trigger price persists after Confirm** — web-testnet
- 1 in a row (worst 1), 100% of the last 1 runs
- Code: `ui_tests/tests/placeOrders/splitTPSL.spec.ts:194`
- Last edited 2026-08-19 by Pham The Viet — fix: Verify open limit order can be cancelled successfully (#1356)
- [Actions job](https://github.com/gravity-technologies/qa-automation/actions/runs/32163926749/job/95798956155) · [report](https://github.com/gravity-technologies/qa-automation/actions/runs/32163926749/artifacts/9342813999)
- `gh run view 32163926749 --log-failed -R gravity-technologies/qa-automation`

**Verify data resets when a row is deleted or the tab is switched** — web-testnet
- 1 in a row (worst 1), 100% of the last 1 runs
- Code: `ui_tests/tests/placeOrders/splitTPSL.spec.ts:386`
- Last edited 2026-08-19 by Pham The Viet — fix: Verify open limit order can be cancelled successfully (#1356)
- [Actions job](https://github.com/gravity-technologies/qa-automation/actions/runs/32163926749/job/95798956155) · [report](https://github.com/gravity-technologies/qa-automation/actions/runs/32163926749/artifacts/9342813999)
- `gh run view 32163926749 --log-failed -R gravity-technologies/qa-automation`

**Verify Position TP/SL size matches the position when a trading login is active** — web-testnet
- 1 in a row (worst 1), 100% of the last 1 runs
- Code: `ui_tests/tests/placeOrders/tpslSendReasonableSize.spec.ts:37`
- Last edited 2026-08-19 by Pham The Viet — fix: Verify open limit order can be cancelled successfully (#1356)
- [Actions job](https://github.com/gravity-technologies/qa-automation/actions/runs/32163926749/job/95798956155) · [report](https://github.com/gravity-technologies/qa-automation/actions/runs/32163926749/artifacts/9342813999)
- `gh run view 32163926749 --log-failed -R gravity-technologies/qa-automation`

**Verify short position: TP trigger price must be less than mark price** — web-testnet
- 1 in a row (worst 1), 100% of the last 1 runs
- Code: `ui_tests/tests/placeOrders/tpslTriggerPriceRangeValidation.spec.ts:62`
- Last edited 2026-08-19 by Pham The Viet — fix: Verify open limit order can be cancelled successfully (#1356)
- [Actions job](https://github.com/gravity-technologies/qa-automation/actions/runs/32163926749/job/95798956155) · [report](https://github.com/gravity-technologies/qa-automation/actions/runs/32163926749/artifacts/9342813999)
- `gh run view 32163926749 --log-failed -R gravity-technologies/qa-automation`

**Verify short position: in-profit SL trigger price must be between mark and entry prices** — web-testnet
- 1 in a row (worst 1), 100% of the last 1 runs
- Code: `ui_tests/tests/placeOrders/tpslTriggerPriceRangeValidation.spec.ts:76`
- Last edited 2026-08-19 by Pham The Viet — fix: Verify open limit order can be cancelled successfully (#1356)
- [Actions job](https://github.com/gravity-technologies/qa-automation/actions/runs/32163926749/job/95798956155) · [report](https://github.com/gravity-technologies/qa-automation/actions/runs/32163926749/artifacts/9342813999)
- `gh run view 32163926749 --log-failed -R gravity-technologies/qa-automation`

**Verify Split TP for Short position: trigger price must be less than mark price** — web-testnet
- 1 in a row (worst 1), 100% of the last 1 runs
- Code: `ui_tests/tests/placeOrders/tpslTriggerPriceRangeValidation.spec.ts:116`
- Last edited 2026-08-19 by Pham The Viet — fix: Verify open limit order can be cancelled successfully (#1356)
- [Actions job](https://github.com/gravity-technologies/qa-automation/actions/runs/32163926749/job/95798956155) · [report](https://github.com/gravity-technologies/qa-automation/actions/runs/32163926749/artifacts/9342813999)
- `gh run view 32163926749 --log-failed -R gravity-technologies/qa-automation`

**Verify SL trigger type can be selected at MAX slider on a Short position** — web-testnet
- 1 in a row (worst 1), 100% of the last 1 runs
- Code: `ui_tests/tests/placeOrders/tpslTriggerTypeAtMaxSlider.spec.ts:51`
- Last edited 2026-08-19 by Pham The Viet — fix: Verify open limit order can be cancelled successfully (#1356)
- [Actions job](https://github.com/gravity-technologies/qa-automation/actions/runs/32163926749/job/95798956155) · [report](https://github.com/gravity-technologies/qa-automation/actions/runs/32163926749/artifacts/9342813999)
- `gh run view 32163926749 --log-failed -R gravity-technologies/qa-automation`

**Verify open limit order can be cancelled successfully** — web-testnet
- 1 in a row (worst 1), 100% of the last 1 runs
- Code: `ui_tests/tests/spot/spotTrading.spec.ts:283`
- Last edited 2026-08-19 by Pham The Viet — fix: Verify open limit order can be cancelled successfully (#1356)
- [Actions job](https://github.com/gravity-technologies/qa-automation/actions/runs/32163926749/job/95798956155) · [report](https://github.com/gravity-technologies/qa-automation/actions/runs/32163926749/artifacts/9342813999)
- `gh run view 32163926749 --log-failed -R gravity-technologies/qa-automation`

**Verify theme toggle, icons, and rendering work on all public pages in both themes** — web-testnet
- 1 in a row (worst 1), 100% of the last 1 runs
- Code: `ui_tests/tests/themeUiLayout.spec.ts:165`
- Last edited 2026-08-19 by Pham The Viet — fix: Verify open limit order can be cancelled successfully (#1356)
- [Actions job](https://github.com/gravity-technologies/qa-automation/actions/runs/32163926749/job/95798956155) · [report](https://github.com/gravity-technologies/qa-automation/actions/runs/32163926749/artifacts/9342813999)
- `gh run view 32163926749 --log-failed -R gravity-technologies/qa-automation`

</details>

