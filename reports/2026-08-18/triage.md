# TRIAGE RECORD — 18/08/2026

Full record for the day. Block 2 is a summary of this file — it is never written from scratch.

## 1.1 Channel status

| Channel | Latest run | Pass/Total | Fully green? | Report |
|---|---|---|---|---|
| WEB-AUTOMATION-PROD | 08-18 15:52 | 20/20 | ✅ | [report](https://github.com/gravity-technologies/qa-automation/actions/runs/32114985892/artifacts/9317638434) |
| WEB-AUTOMATION-TESTNET | 08-18 14:10 | 1/1 | ✅ | [report](https://github.com/gravity-technologies/qa-automation/actions/runs/32109882299/artifacts/9314559410) |
| WEB-AUTOMATION-STAGING | 08-18 12:51 | 40/43 | ❌ | [report](https://github.com/gravity-technologies/qa-automation/actions/runs/32098546549/artifacts/9312683527) |
| MOBILE-AUTOMATION-TESTNET | 08-18 06:06 | 23/23 | ✅ | [report](https://github.com/gravity-technologies/qa-automation/actions/runs/32074222939/artifacts/9304427789) |
| — of which iOS | — | never run | ❌ never | — |

**Total failures: 8** → ENV 0 · APP-BUG 0 · SCRIPT 3 · not yet classified 5

**Smoke accuracy: 🔴 BREACHED** — 2 script failure(s) on a smoke suite: _Verify Trade-Indicators data for all instruments is rendered as expected_, _Verify Trade-Indicators data for all instruments is rendered as expected_. This breaks the QE-935 100% accuracy target and has to be called out in Block 2, not buried here.

> ⚠️ **iOS has never run.** QE-948 Phase 1 is not started.

## 1.2 Classification — one row per failing test

### #qa-web-automation-testnet — 5 failures

| # | Test | Suite/Env | Class | Root cause (one sentence) | Action | Ticket | Owner | ETA |
|---|---|---|---|---|---|---|---|---|
| 1 | Verify Trade-Indicators data for all instruments is rendered as… | smoke/testnet | SCRIPT | The test walks every instrument across two parallel browsers, which exceeds the testnet API rate limit;… | Fix | QE-969 | viet | 2026-08-19 |
| 2 | Verify deposit progress is rejected when user cancels wallet… | regression/testnet | SCRIPT | The receiveValue locator matched the wrong element, so the test read an incorrect Receive amount and the… | Fix | QE-963 | viet | 2026-08-18 |
| 3 | Verify deposit warnings show for insufficient balance, missing gas… | regression/testnet | **?** | _not triaged_ | — | — | ⚠️ | ⚠️ |
| | ↳ _triage incomplete: missing owner, ETA_ | | | | | | | |
| 4 | Verify long position: in-profit SL trigger price must be between… | regression/testnet | **?** | _not triaged_ | — | — | ⚠️ | ⚠️ |
| | ↳ _triage incomplete: missing owner, ETA_ | | | | | | | |
| 5 | Verify limit sell order can be placed successfully | regression/testnet | **?** | _not triaged_ | — | — | ⚠️ | ⚠️ |
| | ↳ _triage incomplete: missing owner, ETA_ | | | | | | | |

### #qa-web-automation-staging — 3 failures

| # | Test | Suite/Env | Class | Root cause (one sentence) | Action | Ticket | Owner | ETA |
|---|---|---|---|---|---|---|---|---|
| 6 | Verify button layout: overflow, overlap, truncation and height… | smoke/staging | **?** | _not triaged_ | — | — | ⚠️ | ⚠️ |
| | ↳ _triage incomplete: missing owner, ETA_ | | | | | | | |
| 7 | Verify each download card points to the correct external URL | smoke/staging | **?** | _not triaged_ | — | — | ⚠️ | ⚠️ |
| | ↳ _triage incomplete: missing owner, ETA_ | | | | | | | |
| 8 | Verify Trade-Indicators data for all instruments is rendered as… | smoke/staging | SCRIPT | Same rate limit as testnet: all-instrument checks across two parallel browsers exceed the API limit and… | Fix | QE-969 | viet | 2026-08-19 |

_Action is one of: **Fix** · **Quarantine** · **Raise PRO** · **Monitor (ENV)**. A row without an owner and an ETA is not finished triage._

## 1.3 SCRIPT detail

> This is what separates "fixed it" from "understood why it broke". **Prevention is mandatory.**

### #qa-web-automation-testnet

```
[SCRIPT-01] Verify Trade-Indicators data for all instruments is rendered as expected
Env/Suite   : TESTNET / smoke
Failures    : 1 consecutive run since 18 Aug
Root cause  : The test walks every instrument across two parallel browsers, which exceeds the testnet API rate limit; KORU-USDT returns error 1015 and the render assertion fails.
Fix         : ⚠️ not recorded
Category    : other (auto)
PR          : ⚠️ not linked
Verify      : ⚠️ not verified — rerun it and record the result
Prevention  : Cap the concurrency this test runs at (one browser) and add a backoff between instrument calls, so the suite's own load can never trip the rate limiter.
Owner       : viet    ETA: 2026-08-19
```

```
[SCRIPT-02] Verify deposit progress is rejected when user cancels wallet connection
Env/Suite   : TESTNET / regression
Failures    : 1 consecutive run since 17 Aug
Root cause  : The receiveValue locator matched the wrong element, so the test read an incorrect Receive amount and the rejection assertion failed.
Fix         : ⚠️ not recorded
Category    : brittle-locator (auto)
PR          : ⚠️ not linked
Verify      : ⚠️ not verified — rerun it and record the result
Prevention  : Target the Receive amount by a stable test id rather than by position in the deposit summary, so a layout change cannot silently repoint the locator.
Owner       : viet    ETA: 2026-08-18
```

### #qa-web-automation-staging

```
[SCRIPT-03] Verify Trade-Indicators data for all instruments is rendered as expected
Env/Suite   : STAGING / smoke
Failures    : 1 consecutive run since 18 Aug
Root cause  : Same rate limit as testnet: all-instrument checks across two parallel browsers exceed the API limit and return error 1015.
Fix         : ⚠️ not recorded
Category    : other (auto)
PR          : ⚠️ not linked
Verify      : ⚠️ not verified — rerun it and record the result
Prevention  : Cap the concurrency this test runs at (one browser) and add a backoff between instrument calls, so the suite's own load can never trip the rate limiter.
Owner       : viet    ETA: 2026-08-19
```

## 1.4 APP-BUG detail

No product bugs found today.

## 1.5 ENV — grouped, not one line per test

No environment failures today.

## 1.6 Numbers for the daily log

```
Fully-green: PROD 91.7% · TESTNET 40% · STAGING 0% · TESTNET 100%
Flakiness rolling 10 runs: WEB 3% · MOBILE 39.9%   (target <3%)
Failures classified: ENV 0 / APP 0 / SCRIPT 3
Failures with no verdict: 5   ⚠️ must be 0
Smoke accuracy: BREACHED
```

### Failed earlier, green again now

Not in the table above because the latest run passed. They still need a verdict — a test that recovers on its own is flaky or platform-specific.

- **Verify the navigation header renders correctly across all supported locales** — prod/smoke, failed 1× in 24h, only on firefox · 🚨 PROD, needs an answer today · [run](https://github.com/gravity-technologies/qa-automation/actions/runs/32074382983/job/95524293289)
- **Verify the navigation header stays identical across repeated reloads** — prod/smoke, failed 1× in 24h, only on firefox · 🚨 PROD, needs an answer today · [run](https://github.com/gravity-technologies/qa-automation/actions/runs/32074382983/job/95524293289)
- **Verify every page displays the selected language correctly** — testnet/regression, failed 1× in 24h · [run](https://github.com/gravity-technologies/qa-automation/actions/runs/32049206932/job/95444237973)
- **Verify subsequent login with a new account → no onboarding screens** — testnet/regression, failed 1× in 24h · [run](https://github.com/gravity-technologies/qa-automation/actions/runs/32049206932/job/95444237973)

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
- 12 in a row (worst 12), 100% of the last 10 runs
- Code: `ui_tests/tests/languageUiLayout.spec.ts:289`
- Last edited 2026-08-11 by Pham The Viet — fix: Verify every page displays the selected language correctly (#1313)
- [Actions job](https://github.com/gravity-technologies/qa-automation/actions/runs/32098546549/job/95594514219) · [report](https://github.com/gravity-technologies/qa-automation/actions/runs/32098546549/artifacts/9312683527)
- `gh run view 32098546549 --log-failed -R gravity-technologies/qa-automation`
- `node tools/bin/classify.js --test "Verify button layout: overflow, overlap, truncation and height stability across all locales" --channel web-staging --label <ENV|APP-BUG|SCRIPT> --owner <name> --eta <YYYY-MM-DD> --note "..."`

**Verify each download card points to the correct external URL** — web-staging
- 4 in a row (worst 4), 70% of the last 10 runs
- Code: `ui_tests/tests/downloadApp.spec.ts:38`
- [Actions job](https://github.com/gravity-technologies/qa-automation/actions/runs/32098546549/job/95594514219) · [report](https://github.com/gravity-technologies/qa-automation/actions/runs/32098546549/artifacts/9312683527)
- `gh run view 32098546549 --log-failed -R gravity-technologies/qa-automation`
- `node tools/bin/classify.js --test "Verify each download card points to the correct external URL" --channel web-staging --label <ENV|APP-BUG|SCRIPT> --owner <name> --eta <YYYY-MM-DD> --note "..."`

**Verify Trade-Indicators data for all instruments is rendered as expected** — web-staging
- 1 in a row (worst 1), 100% of the last 1 runs
- Code: `ui_tests/tests/e2e_tests.spec.ts:59`
- Last edited 2026-08-12 by Pham The Viet — fix: Verify a new Sub-Account can be created (#1318)
- [Actions job](https://github.com/gravity-technologies/qa-automation/actions/runs/32098546549/job/95594514219) · [report](https://github.com/gravity-technologies/qa-automation/actions/runs/32098546549/artifacts/9312683527)
- `gh run view 32098546549 --log-failed -R gravity-technologies/qa-automation`

**Verify Trade-Indicators data for all instruments is rendered as expected** — web-testnet
- 1 in a row (worst 1), 100% of the last 1 runs
- Code: `ui_tests/tests/e2e_tests.spec.ts:59`
- Last edited 2026-08-12 by Pham The Viet — fix: Verify a new Sub-Account can be created (#1318)
- [Actions job](https://github.com/gravity-technologies/qa-automation/actions/runs/32098545871/job/95594507960) · [report](https://github.com/gravity-technologies/qa-automation/actions/runs/32098545871/artifacts/9312013378)
- `gh run view 32098545871 --log-failed -R gravity-technologies/qa-automation`

**Verify deposit progress is rejected when user cancels wallet connection** — web-testnet
- 1 in a row (worst 1), 100% of the last 1 runs
- Code: `ui_tests/tests/deposit/deposit.spec.ts:102`
- Last edited 2026-08-13 by Pham The Viet — Fix app version not displayed in allure report (#1328)
- [Actions job](https://github.com/gravity-technologies/qa-automation/actions/runs/32048932937/job/95443323644) · [report](https://github.com/gravity-technologies/qa-automation/actions/runs/32048932937/artifacts/9300668373)
- `gh run view 32048932937 --log-failed -R gravity-technologies/qa-automation`

**Verify deposit warnings show for insufficient balance, missing gas fee, and spending limit** — web-testnet
- 1 in a row (worst 1), 100% of the last 1 runs
- Code: `ui_tests/tests/deposit/deposit.spec.ts:135`
- Last edited 2026-08-13 by Pham The Viet — Fix app version not displayed in allure report (#1328)
- [Actions job](https://github.com/gravity-technologies/qa-automation/actions/runs/32048932937/job/95443323644) · [report](https://github.com/gravity-technologies/qa-automation/actions/runs/32048932937/artifacts/9300668373)
- `gh run view 32048932937 --log-failed -R gravity-technologies/qa-automation`
- `node tools/bin/classify.js --test "Verify deposit warnings show for insufficient balance, missing gas fee, and spending limit" --channel web-testnet --label <ENV|APP-BUG|SCRIPT> --owner <name> --eta <YYYY-MM-DD> --note "..."`

**Verify long position: in-profit SL trigger price must be between entry and mark prices** — web-testnet
- 1 in a row (worst 1), 100% of the last 1 runs
- Code: `ui_tests/tests/placeOrders/tpslTriggerPriceRangeValidation.spec.ts:49`
- Last edited 2026-08-11 by Pham The Viet — fix: Verify every page displays the selected language correctly (#1313)
- [Actions job](https://github.com/gravity-technologies/qa-automation/actions/runs/32048932937/job/95443323644) · [report](https://github.com/gravity-technologies/qa-automation/actions/runs/32048932937/artifacts/9300668373)
- `gh run view 32048932937 --log-failed -R gravity-technologies/qa-automation`
- `node tools/bin/classify.js --test "Verify long position: in-profit SL trigger price must be between entry and mark prices" --channel web-testnet --label <ENV|APP-BUG|SCRIPT> --owner <name> --eta <YYYY-MM-DD> --note "..."`

**Verify limit sell order can be placed successfully** — web-testnet
- 1 in a row (worst 1), 100% of the last 1 runs
- Code: `ui_tests/tests/spot/spotTrading.spec.ts:234`
- Last edited 2026-08-12 by Pham The Viet — fix: Verify a new Sub-Account can be created (#1318)
- [Actions job](https://github.com/gravity-technologies/qa-automation/actions/runs/32048932937/job/95443323644) · [report](https://github.com/gravity-technologies/qa-automation/actions/runs/32048932937/artifacts/9300668373)
- `gh run view 32048932937 --log-failed -R gravity-technologies/qa-automation`
- `node tools/bin/classify.js --test "Verify limit sell order can be placed successfully" --channel web-testnet --label <ENV|APP-BUG|SCRIPT> --owner <name> --eta <YYYY-MM-DD> --note "..."`

</details>

