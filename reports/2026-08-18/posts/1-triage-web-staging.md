<!-- Section 1.1–1.6 · post to: #qa-web-automation-staging — thread of the 12:51 run -->
<!-- channel: web-staging · thread_ts: 1787032312.538709 -->
<!-- Everything below the rule is the message body. Do not paste this header. -->

---

# TRIAGE RECORD — #qa-web-automation-staging — 18/08/2026

_This record covers #qa-web-automation-staging only. Other channels are triaged in their own threads._

## 1.1 Channel status

| Channel | Latest run | Pass/Total | Fully green? | Report |
|---|---|---|---|---|
| WEB-AUTOMATION-STAGING | 08-18 12:51 | 40/43 | ❌ | [report](https://github.com/gravity-technologies/qa-automation/actions/runs/32098546549/artifacts/9312683527) |

**Total failures: 3** → ENV 0 · APP-BUG 0 · SCRIPT 1 · not yet classified 2

**Smoke accuracy: 🔴 BREACHED** — 1 script failure(s) on a smoke suite: _Verify Trade-Indicators data for all instruments is rendered as expected_.

## 1.2 Classification — one row per failing test

| # | Test | Suite/Env | Class | Root cause (one sentence) | Action | Ticket | Owner | ETA |
|---|---|---|---|---|---|---|---|---|
| 1 | Verify button layout: overflow, overlap, truncation and height… | smoke/staging | **?** | _not triaged_ | — | — | ⚠️ | ⚠️ |
| | ↳ _triage incomplete: missing owner, ETA_ | | | | | | | |
| 2 | Verify each download card points to the correct external URL | smoke/staging | **?** | _not triaged_ | — | — | ⚠️ | ⚠️ |
| | ↳ _triage incomplete: missing owner, ETA_ | | | | | | | |
| 3 | Verify Trade-Indicators data for all instruments is rendered as… | smoke/staging | SCRIPT | Same rate limit as testnet: all-instrument checks across two parallel browsers exceed the API limit and… | Fix | QE-969 | viet | 2026-08-19 |

_Action is one of: **Fix** · **Quarantine** · **Raise PRO** · **Monitor (ENV)**. A row without an owner and an ETA is not finished triage._

## 1.3 SCRIPT detail

> This is what separates "fixed it" from "understood why it broke". **Prevention is mandatory.**

```
[SCRIPT-01] Verify Trade-Indicators data for all instruments is rendered as expected
Env/Suite   : STAGING / smoke
Failures    : 1 consecutive run since 18 Aug
Root cause  : Same rate limit as testnet: all-instrument checks across two parallel browsers exceed the API limit and return error 1015.
Category    : other (auto)
PR          : ⚠️ not linked
Verify      : ⚠️ not verified — rerun it and record the result
Prevention  : Cap the concurrency this test runs at (one browser) and add a backoff between instrument calls, so the suite's own load can never trip the rate limiter.
Owner       : viet    ETA: 2026-08-19
```

## 1.4 APP-BUG detail

No product bugs found in this channel today.

## 1.5 ENV — grouped, not one line per test

No environment failures in this channel today.

## 1.6 Numbers for the daily log

```
Fully-green: 0%
Flakiness rolling 10 runs: 5.4%   (target <3%)
Failures classified: ENV 0 / APP 0 / SCRIPT 1
Failures with no verdict: 2   ⚠️ must be 0
Smoke accuracy: BREACHED
```
