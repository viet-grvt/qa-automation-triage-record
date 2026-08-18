<!-- Section 1.1–1.6 · post to: #qa-web-automation-testnet — thread of the 12:19 run -->
<!-- channel: web-testnet · thread_ts: 1787030389.704349 -->
<!-- Everything below the rule is the message body. Do not paste this header. -->

---

# TRIAGE RECORD — #qa-web-automation-testnet — 18/08/2026

_This record covers #qa-web-automation-testnet only. Other channels are triaged in their own threads._

## 1.1 Channel status

| Channel | Latest run | Pass/Total | Fully green? | Report |
|---|---|---|---|---|
| WEB-AUTOMATION-TESTNET | 08-18 14:10 | 1/1 | ✅ | [report](https://github.com/gravity-technologies/qa-automation/actions/runs/32109882299/artifacts/9314559410) |

**Total failures: 5** → ENV 0 · APP-BUG 0 · SCRIPT 2 · not yet classified 3

**Smoke accuracy: 🔴 BREACHED** — 1 script failure(s) on a smoke suite: _Verify Trade-Indicators data for all instruments is rendered as expected_.

## 1.2 Classification — one row per failing test

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

_Action is one of: **Fix** · **Quarantine** · **Raise PRO** · **Monitor (ENV)**. A row without an owner and an ETA is not finished triage._

## 1.3 SCRIPT detail

> This is what separates "fixed it" from "understood why it broke". **Prevention is mandatory.**

```
[SCRIPT-01] Verify Trade-Indicators data for all instruments is rendered as expected
Env/Suite   : TESTNET / smoke
Failures    : 1 consecutive run since 18 Aug
Root cause  : The test walks every instrument across two parallel browsers, which exceeds the testnet API rate limit; KORU-USDT returns error 1015 and the render assertion fails.
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
Category    : brittle-locator (auto)
PR          : ⚠️ not linked
Verify      : ⚠️ not verified — rerun it and record the result
Prevention  : Target the Receive amount by a stable test id rather than by position in the deposit summary, so a layout change cannot silently repoint the locator.
Owner       : viet    ETA: 2026-08-18
```

## 1.4 APP-BUG detail

No product bugs found in this channel today.

## 1.5 ENV — grouped, not one line per test

No environment failures in this channel today.

## 1.6 Numbers for the daily log

```
Fully-green: 40%
Flakiness rolling 10 runs: 1.7%   (target <3%)
Failures classified: ENV 0 / APP 0 / SCRIPT 2
Failures with no verdict: 3   ⚠️ must be 0
Smoke accuracy: BREACHED
```

### Failed earlier, green again now

Not in the table above because the latest run passed. They still need a verdict — a test that recovers on its own is flaky or platform-specific.

- **Verify every page displays the selected language correctly** — testnet/regression, failed 1× in 24h · [run](https://github.com/gravity-technologies/qa-automation/actions/runs/32049206932/job/95444237973)
- **Verify subsequent login with a new account → no onboarding screens** — testnet/regression, failed 1× in 24h · [run](https://github.com/gravity-technologies/qa-automation/actions/runs/32049206932/job/95444237973)
