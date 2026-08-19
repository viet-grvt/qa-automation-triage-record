<!-- Section 1.1–1.6 · post to: #qa-web-automation-staging — thread of the 06:25 run -->
<!-- channel: web-staging · thread_ts: 1787095559.102759 -->
<!-- Everything below the rule is the message body. Do not paste this header. -->

---

# TRIAGE RECORD — #qa-web-automation-staging — 19/08/2026

_This record covers #qa-web-automation-staging only. Other channels are triaged in their own threads._

## 1.1 Channel status

| Channel | Latest run | Pass/Total | Fully green? | Report |
|---|---|---|---|---|
| WEB-AUTOMATION-STAGING | 08-19 06:25 | 25/43 | ❌ | [report](https://github.com/gravity-technologies/qa-automation/actions/runs/32191181406/artifacts/9346228263) |

**Total failures: 18** → ENV 0 · APP-BUG 0 · SCRIPT 18

**Smoke accuracy: 🔴 BREACHED** — 18 script failure(s) on a smoke suite: _Verify button layout: overflow, overlap, truncation and height stability across all locales_, _Verify encoding, translations, number format and horizontal scroll across all locales_, _Verify navigation layout: overflow, overlap and height stability across all locales_, _Verify Trade-Indicators data for all instruments is rendered as expected_, _Verify user can remove margin from an Isolated position_, _Verify all records under the Recent Trades tab are populated as expected_, _Verify Order-Book data is displayed as expected_, _Verify Order-Book is not crossed (BEST_BID lower than BEST_ASK)_, _Verify MARKET BUY/SELL order can be placed successfully_, _Verify order placement succeeds when quantity is expressed in USDT Notional_, _Verify REDUCE_ONLY type orders can be placed successfully_, _Verify IOC type orders can be placed successfully_, _Verify FOK type orders can be placed successfully_, _Verify POST_ONLY type orders can be placed successfully_, _Verify the top-level navigation header renders on every page_, _Verify MARKET order can be placed using Isolated margin mode_, _Verify LIMIT order can be placed using Isolated margin mode_, _Verify user can add margin to an Isolated position_.

## 1.2 Classification — one row per failing test

| # | Test | Suite/Env | Class | Root cause (one sentence) | Action | Ticket | Owner | ETA |
|---|---|---|---|---|---|---|---|---|
| 1 | Verify button layout: overflow, overlap, truncation and height… | smoke/staging | SCRIPT | changeLanguage (commonPage.ts:48) opens the panel via //*[@aria-label='Language'] then looks for the locale… | Fix | — | viet | 2026-08-19 |
| 2 | Verify encoding, translations, number format and horizontal scroll… | smoke/staging | SCRIPT | changeLanguage (commonPage.ts:48) opens the panel via //*[@aria-label='Language'] then looks for the locale… | Fix | — | viet | 2026-08-19 |
| 3 | Verify navigation layout: overflow, overlap and height stability… | smoke/staging | SCRIPT | changeLanguage (commonPage.ts:48) opens the panel via //*[@aria-label='Language'] then looks for the locale… | Fix | — | viet | 2026-08-19 |
| 4 | Verify Trade-Indicators data for all instruments is rendered as… | smoke/staging | SCRIPT | instrumentSelector (perpetualpage.ts:80) is a positional XPath keyed on the literal text 'Perpetual' with a… | Fix | QE-969 | viet | 2026-08-19 |
| 5 | Verify user can remove margin from an Isolated position | smoke/staging | SCRIPT | instrumentSelector (perpetualpage.ts:80) is a positional XPath keyed on the literal text 'Perpetual' with a… | Fix | — | viet | 2026-08-19 |
| 6 | Verify all records under the Recent Trades tab are populated as… | smoke/staging | SCRIPT | instrumentSelector (perpetualpage.ts:80) is a positional XPath keyed on the literal text 'Perpetual' with a… | Fix | — | viet | 2026-08-19 |
| 7 | Verify Order-Book data is displayed as expected | smoke/staging | SCRIPT | instrumentSelector (perpetualpage.ts:80) is a positional XPath keyed on the literal text 'Perpetual' with a… | Fix | — | viet | 2026-08-19 |
| 8 | Verify Order-Book is not crossed (BEST_BID lower than BEST_ASK) | smoke/staging | SCRIPT | instrumentSelector (perpetualpage.ts:80) is a positional XPath keyed on the literal text 'Perpetual' with a… | Fix | — | viet | 2026-08-19 |
| 9 | Verify MARKET BUY/SELL order can be placed successfully | smoke/staging | SCRIPT | instrumentSelector (perpetualpage.ts:80) is a positional XPath keyed on the literal text 'Perpetual' with a… | Fix | — | viet | 2026-08-19 |
| 10 | Verify order placement succeeds when quantity is expressed in USDT… | smoke/staging | SCRIPT | instrumentSelector (perpetualpage.ts:80) is a positional XPath keyed on the literal text 'Perpetual' with a… | Fix | — | viet | 2026-08-19 |
| 11 | Verify REDUCE_ONLY type orders can be placed successfully | smoke/staging | SCRIPT | instrumentSelector (perpetualpage.ts:80) is a positional XPath keyed on the literal text 'Perpetual' with a… | Fix | — | viet | 2026-08-19 |
| 12 | Verify IOC type orders can be placed successfully | smoke/staging | SCRIPT | instrumentSelector (perpetualpage.ts:80) is a positional XPath keyed on the literal text 'Perpetual' with a… | Fix | — | viet | 2026-08-19 |
| 13 | Verify FOK type orders can be placed successfully | smoke/staging | SCRIPT | instrumentSelector (perpetualpage.ts:80) is a positional XPath keyed on the literal text 'Perpetual' with a… | Fix | — | viet | 2026-08-19 |
| 14 | Verify POST_ONLY type orders can be placed successfully | smoke/staging | SCRIPT | instrumentSelector (perpetualpage.ts:80) is a positional XPath keyed on the literal text 'Perpetual' with a… | Fix | — | viet | 2026-08-19 |
| 15 | Verify the top-level navigation header renders on every page | smoke/staging | SCRIPT | headerNavPage.ts:405 asserts the prod-shaped item list; staging renders only [Earn APY | Trade | Invest] on… | Fix | — | viet | 2026-08-20 |
| 16 | Verify MARKET order can be placed using Isolated margin mode | smoke/staging | SCRIPT | instrumentSelector (perpetualpage.ts:80) is a positional XPath keyed on the literal text 'Perpetual' with a… | Fix | — | viet | 2026-08-19 |
| 17 | Verify LIMIT order can be placed using Isolated margin mode | smoke/staging | SCRIPT | instrumentSelector (perpetualpage.ts:80) is a positional XPath keyed on the literal text 'Perpetual' with a… | Fix | — | viet | 2026-08-19 |
| 18 | Verify user can add margin to an Isolated position | smoke/staging | SCRIPT | instrumentSelector (perpetualpage.ts:80) is a positional XPath keyed on the literal text 'Perpetual' with a… | Fix | — | viet | 2026-08-19 |

_Action is one of: **Fix** · **Quarantine** · **Raise PRO** · **Monitor (ENV)**. A row without an owner and an ETA is not finished triage._

## 1.3 SCRIPT detail

> This is what separates "fixed it" from "understood why it broke". **Prevention is mandatory.**

```
[SCRIPT-01] Verify button layout: overflow, overlap, truncation and height stability across all locales
Env/Suite   : STAGING / smoke
Failures    : 16 consecutive runs since 15 Aug
Root cause  : changeLanguage (commonPage.ts:48) opens the panel via //*[@aria-label='Language'] then looks for the locale under its following-sibling; on staging the panel never becomes visible, so all 3 attempts time out and the locale sweep never starts.
Category    : brittle-locator (auto)
PR          : ⚠️ not linked
Verify      : ⚠️ not verified — rerun it and record the result
Prevention  : Target the language control and its panel by test id rather than by aria-label plus sibling position, and assert the panel is open before selecting a locale.
Owner       : viet    ETA: 2026-08-19
```

```
[SCRIPT-02] Verify encoding, translations, number format and horizontal scroll across all locales
Env/Suite   : STAGING / smoke
Failures    : 2 consecutive runs since 18 Aug
Root cause  : changeLanguage (commonPage.ts:48) opens the panel via //*[@aria-label='Language'] then looks for the locale under its following-sibling; on staging the panel never becomes visible, so all 3 attempts time out and the locale sweep never starts.
Category    : brittle-locator (auto)
PR          : ⚠️ not linked
Verify      : ⚠️ not verified — rerun it and record the result
Prevention  : Target the language control and its panel by test id rather than by aria-label plus sibling position, and assert the panel is open before selecting a locale.
Owner       : viet    ETA: 2026-08-19
```

```
[SCRIPT-03] Verify navigation layout: overflow, overlap and height stability across all locales
Env/Suite   : STAGING / smoke
Failures    : 1 consecutive run since 15 Aug
Root cause  : changeLanguage (commonPage.ts:48) opens the panel via //*[@aria-label='Language'] then looks for the locale under its following-sibling; on staging the panel never becomes visible, so all 3 attempts time out and the locale sweep never starts.
Category    : brittle-locator (auto)
PR          : ⚠️ not linked
Verify      : ⚠️ not verified — rerun it and record the result
Prevention  : Target the language control and its panel by test id rather than by aria-label plus sibling position, and assert the panel is open before selecting a locale.
Owner       : viet    ETA: 2026-08-19
```

```
[SCRIPT-04] Verify Trade-Indicators data for all instruments is rendered as expected
Env/Suite   : STAGING / smoke
Failures    : 1 consecutive run since 18 Aug
Root cause  : instrumentSelector (perpetualpage.ts:80) is a positional XPath keyed on the literal text 'Perpetual' with a preceding-sibling containing 'USDT'; it matches nothing in staging's trade header, so getActiveInstrument's textContent waits the full 30s on every instrument switch.
Category    : brittle-locator (auto)
PR          : https://grvt.atlassian.net/browse/QE-969
Verify      : ⚠️ not verified — rerun it and record the result
Prevention  : Replace the positional XPath with a stable test id on the instrument name, so the trade header can be restyled without breaking every order and market-data test at once.
Owner       : viet    ETA: 2026-08-19
```

```
[SCRIPT-05] Verify user can remove margin from an Isolated position
Env/Suite   : STAGING / smoke
Failures    : 1 consecutive run since 18 Aug
Root cause  : instrumentSelector (perpetualpage.ts:80) is a positional XPath keyed on the literal text 'Perpetual' with a preceding-sibling containing 'USDT'; it matches nothing in staging's trade header, so getActiveInstrument's textContent waits the full 30s on every instrument switch.
Category    : brittle-locator (auto)
PR          : ⚠️ not linked
Verify      : ⚠️ not verified — rerun it and record the result
Prevention  : Replace the positional XPath with a stable test id on the instrument name, so the trade header can be restyled without breaking every order and market-data test at once.
Owner       : viet    ETA: 2026-08-19
```

```
[SCRIPT-06] Verify all records under the Recent Trades tab are populated as expected
Env/Suite   : STAGING / smoke
Failures    : 1 consecutive run since 18 Aug
Root cause  : instrumentSelector (perpetualpage.ts:80) is a positional XPath keyed on the literal text 'Perpetual' with a preceding-sibling containing 'USDT'; it matches nothing in staging's trade header, so getActiveInstrument's textContent waits the full 30s on every instrument switch.
Category    : brittle-locator (auto)
PR          : ⚠️ not linked
Verify      : ⚠️ not verified — rerun it and record the result
Prevention  : Replace the positional XPath with a stable test id on the instrument name, so the trade header can be restyled without breaking every order and market-data test at once.
Owner       : viet    ETA: 2026-08-19
```

```
[SCRIPT-07] Verify Order-Book data is displayed as expected
Env/Suite   : STAGING / smoke
Failures    : 1 consecutive run since 18 Aug
Root cause  : instrumentSelector (perpetualpage.ts:80) is a positional XPath keyed on the literal text 'Perpetual' with a preceding-sibling containing 'USDT'; it matches nothing in staging's trade header, so getActiveInstrument's textContent waits the full 30s on every instrument switch.
Category    : brittle-locator (auto)
PR          : ⚠️ not linked
Verify      : ⚠️ not verified — rerun it and record the result
Prevention  : Replace the positional XPath with a stable test id on the instrument name, so the trade header can be restyled without breaking every order and market-data test at once.
Owner       : viet    ETA: 2026-08-19
```

```
[SCRIPT-08] Verify Order-Book is not crossed (BEST_BID lower than BEST_ASK)
Env/Suite   : STAGING / smoke
Failures    : 1 consecutive run since 18 Aug
Root cause  : instrumentSelector (perpetualpage.ts:80) is a positional XPath keyed on the literal text 'Perpetual' with a preceding-sibling containing 'USDT'; it matches nothing in staging's trade header, so getActiveInstrument's textContent waits the full 30s on every instrument switch.
Category    : brittle-locator (auto)
PR          : ⚠️ not linked
Verify      : ⚠️ not verified — rerun it and record the result
Prevention  : Replace the positional XPath with a stable test id on the instrument name, so the trade header can be restyled without breaking every order and market-data test at once.
Owner       : viet    ETA: 2026-08-19
```

```
[SCRIPT-09] Verify MARKET BUY/SELL order can be placed successfully
Env/Suite   : STAGING / smoke
Failures    : 1 consecutive run since 18 Aug
Root cause  : instrumentSelector (perpetualpage.ts:80) is a positional XPath keyed on the literal text 'Perpetual' with a preceding-sibling containing 'USDT'; it matches nothing in staging's trade header, so getActiveInstrument's textContent waits the full 30s on every instrument switch.
Category    : brittle-locator (auto)
PR          : ⚠️ not linked
Verify      : ⚠️ not verified — rerun it and record the result
Prevention  : Replace the positional XPath with a stable test id on the instrument name, so the trade header can be restyled without breaking every order and market-data test at once.
Owner       : viet    ETA: 2026-08-19
```

```
[SCRIPT-10] Verify order placement succeeds when quantity is expressed in USDT Notional
Env/Suite   : STAGING / smoke
Failures    : 1 consecutive run since 18 Aug
Root cause  : instrumentSelector (perpetualpage.ts:80) is a positional XPath keyed on the literal text 'Perpetual' with a preceding-sibling containing 'USDT'; it matches nothing in staging's trade header, so getActiveInstrument's textContent waits the full 30s on every instrument switch.
Category    : brittle-locator (auto)
PR          : ⚠️ not linked
Verify      : ⚠️ not verified — rerun it and record the result
Prevention  : Replace the positional XPath with a stable test id on the instrument name, so the trade header can be restyled without breaking every order and market-data test at once.
Owner       : viet    ETA: 2026-08-19
```

```
[SCRIPT-11] Verify REDUCE_ONLY type orders can be placed successfully
Env/Suite   : STAGING / smoke
Failures    : 1 consecutive run since 18 Aug
Root cause  : instrumentSelector (perpetualpage.ts:80) is a positional XPath keyed on the literal text 'Perpetual' with a preceding-sibling containing 'USDT'; it matches nothing in staging's trade header, so getActiveInstrument's textContent waits the full 30s on every instrument switch.
Category    : brittle-locator (auto)
PR          : ⚠️ not linked
Verify      : ⚠️ not verified — rerun it and record the result
Prevention  : Replace the positional XPath with a stable test id on the instrument name, so the trade header can be restyled without breaking every order and market-data test at once.
Owner       : viet    ETA: 2026-08-19
```

```
[SCRIPT-12] Verify IOC type orders can be placed successfully
Env/Suite   : STAGING / smoke
Failures    : 1 consecutive run since 18 Aug
Root cause  : instrumentSelector (perpetualpage.ts:80) is a positional XPath keyed on the literal text 'Perpetual' with a preceding-sibling containing 'USDT'; it matches nothing in staging's trade header, so getActiveInstrument's textContent waits the full 30s on every instrument switch.
Category    : brittle-locator (auto)
PR          : ⚠️ not linked
Verify      : ⚠️ not verified — rerun it and record the result
Prevention  : Replace the positional XPath with a stable test id on the instrument name, so the trade header can be restyled without breaking every order and market-data test at once.
Owner       : viet    ETA: 2026-08-19
```

```
[SCRIPT-13] Verify FOK type orders can be placed successfully
Env/Suite   : STAGING / smoke
Failures    : 1 consecutive run since 18 Aug
Root cause  : instrumentSelector (perpetualpage.ts:80) is a positional XPath keyed on the literal text 'Perpetual' with a preceding-sibling containing 'USDT'; it matches nothing in staging's trade header, so getActiveInstrument's textContent waits the full 30s on every instrument switch.
Category    : brittle-locator (auto)
PR          : ⚠️ not linked
Verify      : ⚠️ not verified — rerun it and record the result
Prevention  : Replace the positional XPath with a stable test id on the instrument name, so the trade header can be restyled without breaking every order and market-data test at once.
Owner       : viet    ETA: 2026-08-19
```

```
[SCRIPT-14] Verify POST_ONLY type orders can be placed successfully
Env/Suite   : STAGING / smoke
Failures    : 1 consecutive run since 18 Aug
Root cause  : instrumentSelector (perpetualpage.ts:80) is a positional XPath keyed on the literal text 'Perpetual' with a preceding-sibling containing 'USDT'; it matches nothing in staging's trade header, so getActiveInstrument's textContent waits the full 30s on every instrument switch.
Category    : brittle-locator (auto)
PR          : ⚠️ not linked
Verify      : ⚠️ not verified — rerun it and record the result
Prevention  : Replace the positional XPath with a stable test id on the instrument name, so the trade header can be restyled without breaking every order and market-data test at once.
Owner       : viet    ETA: 2026-08-19
```

```
[SCRIPT-15] Verify the top-level navigation header renders on every page
Env/Suite   : STAGING / smoke
Failures    : 1 consecutive run since 18 Aug
Root cause  : headerNavPage.ts:405 asserts the prod-shaped item list; staging renders only [Earn APY | Trade | Invest] on all 3 pages, so the expected set is wrong for this environment.
Category    : assertion-wrong (auto)
PR          : ⚠️ not linked
Verify      : ⚠️ not verified — rerun it and record the result
Prevention  : Derive the expected header items per environment instead of hard-coding one list, so a staging-only nav change does not read as a failure.
Owner       : viet    ETA: 2026-08-20
```

```
[SCRIPT-16] Verify MARKET order can be placed using Isolated margin mode
Env/Suite   : STAGING / smoke
Failures    : 1 consecutive run since 18 Aug
Root cause  : instrumentSelector (perpetualpage.ts:80) is a positional XPath keyed on the literal text 'Perpetual' with a preceding-sibling containing 'USDT'; it matches nothing in staging's trade header, so getActiveInstrument's textContent waits the full 30s on every instrument switch.
Category    : brittle-locator (auto)
PR          : ⚠️ not linked
Verify      : ⚠️ not verified — rerun it and record the result
Prevention  : Replace the positional XPath with a stable test id on the instrument name, so the trade header can be restyled without breaking every order and market-data test at once.
Owner       : viet    ETA: 2026-08-19
```

```
[SCRIPT-17] Verify LIMIT order can be placed using Isolated margin mode
Env/Suite   : STAGING / smoke
Failures    : 1 consecutive run since 18 Aug
Root cause  : instrumentSelector (perpetualpage.ts:80) is a positional XPath keyed on the literal text 'Perpetual' with a preceding-sibling containing 'USDT'; it matches nothing in staging's trade header, so getActiveInstrument's textContent waits the full 30s on every instrument switch.
Category    : brittle-locator (auto)
PR          : ⚠️ not linked
Verify      : ⚠️ not verified — rerun it and record the result
Prevention  : Replace the positional XPath with a stable test id on the instrument name, so the trade header can be restyled without breaking every order and market-data test at once.
Owner       : viet    ETA: 2026-08-19
```

```
[SCRIPT-18] Verify user can add margin to an Isolated position
Env/Suite   : STAGING / smoke
Failures    : 1 consecutive run since 18 Aug
Root cause  : instrumentSelector (perpetualpage.ts:80) is a positional XPath keyed on the literal text 'Perpetual' with a preceding-sibling containing 'USDT'; it matches nothing in staging's trade header, so getActiveInstrument's textContent waits the full 30s on every instrument switch.
Category    : brittle-locator (auto)
PR          : ⚠️ not linked
Verify      : ⚠️ not verified — rerun it and record the result
Prevention  : Replace the positional XPath with a stable test id on the instrument name, so the trade header can be restyled without breaking every order and market-data test at once.
Owner       : viet    ETA: 2026-08-19
```

## 1.4 APP-BUG detail

No product bugs found in this channel today.

## 1.5 ENV — grouped, not one line per test

No environment failures in this channel today.

## 1.6 Numbers for the daily log

```
Fully-green: 0%
Flakiness rolling 10 runs: 10.1%   (target <3%)
Failures classified: ENV 0 / APP 0 / SCRIPT 18
Failures with no verdict: 0   ✅
Smoke accuracy: BREACHED
```

### Failed earlier, green again now

Not in the table above because the latest run passed. They still need a verdict — a test that recovers on its own is flaky or platform-specific.

- **Verify each download card points to the correct external URL** — staging/smoke, failed 1× in 24h · [run](https://github.com/gravity-technologies/qa-automation/actions/runs/32098546549/job/95594514219)
