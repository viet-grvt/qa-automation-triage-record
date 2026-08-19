# Automation coverage analysis — PRE-RELEASE v3.3.0 mobile regression (Raj's 18-Aug sign-off)

Source: Slack thread `C07E8H6L0R4` / `p1787049786049509` (Raj Tilak, 2026-08-18 17:43 +07) — sign-off **NO-GO**.
Repo checked (read-only): `c:/Gravity/qa-automation` @ `93b13c60`. Index: `data/test-index.json` (web 1073 / mobile 129).

## Verdict summary

| Ticket | Area | Sev | Covered by automation? |
|---|---|---|---|
| PRO-8844 | Quick Order hangs after nav from Advanced Order with active error toast (BLOCKER) | Highest | **No** |
| PRO-8843 | Order price = 0 reaches confirmation sheet | Medium | **No** |
| PRO-8842 | Quick Order (Spot) missing insufficient-balance error | Medium | **No** |
| PRO-8841 | Amount input has no max cap (WEB caps at 1,000,000,000) | Medium | **No** |
| PRO-8840 | Price Alerts — Mark Price offered on Spot pairs | Medium | **No** (mobile); web suite exists but never exercises the Spot path |
| PRO-8839 | Earn "Earning x% APY on …" left-shifted in Japanese | Low | **Partial** — screen is visited in JA, but only text translation is asserted, never layout |
| PRO-8818 | Instrument selector — "Spot" tag missing | Medium | **No** |

**0 of 7 would have been caught by the current suite.**

## Cross-cutting reasons the automation could not have caught any of these

These apply to every ticket above and matter more than the per-ticket gaps:

1. **The suite never runs against the PRE-RELEASE build.** `mobile_tests/envs/` contains only `dev.conf`, `staging.conf`, `testnet.conf`, and `.github/workflows/mobile-e2e-tests-bs.yml` defaults `target_env` to `testnet` on every cron. There is no pre-release env config and no BrowserStack app slot for a pre-release `.apk`/`.ipa`. Even a perfect test would not have run on v3.3.0 pre-release.
2. **iOS is effectively unscheduled.** The iOS crons in `mobile-e2e-tests-bs.yml:10` and `:12` are commented out; only Android/OKX and Android/MetaMask run nightly. PRO-8844 / 8843 / 8842 / 8841 were all found on iPhone 14E / iOS 26.6.
3. **iOS pre-release cannot be installed on BrowserStack at all** — Luy flagged this in the thread (unregistered-device / standalone `.ipa` limitation). That is a hard blocker on automating any iOS pre-release regression until a TestFlight or registered-device path exists.
4. **No negative/validation lane on the mobile order form.** Every mobile trade scenario in `features/e2e-tests-privy.feature` is happy-path placement. The only mobile negative assertions in the repo are TPSL trigger validation and split-TPSL max size (`features/tpsl.feature:30`, `step_definitions/trade.steps.ts:573`). PRO-8841 / 8842 / 8843 all live in the untested validation lane.
5. **Layout assertions exist on mobile but are never applied to locales.** `features/language.feature` M-047 walks 33 screens in Japanese, but its only assertion is "no untranslated text" — so PRO-8839 was on screen during an automated run and went unflagged. Note the capability is *not* missing: `step_definitions/home.steps.ts:15-50` (M-084, `features/e2e-menus.feature:20`) already asserts market-tab label geometry via rects + `driver.getWindowSize()` with overflow and wrap detection, and `page_object/abstracts/language_page.ts:677` `locateRect()` resolves the bounding box of arbitrary text across both platforms. The gap is application, not tooling — see [automatability assessment](pre-release-v3.3.0-automatability.md).

## Per-ticket detail

### PRO-8844 — Quick Order hangs after navigating from Advanced Order with active error (BLOCKER)
- Nearest existing coverage: 3 Quick Order scenarios — `features/e2e-tests-privy.feature:258` (perp market/limit), `:284` (spot, margin/leverage hidden), `:316` (amount slider).
- Why they miss it: all three open Quick Order directly from the chart view and immediately place a valid order. `grep -rin "advanced.order"` over `mobile_tests` returns **zero hits** — the Advanced Place Order form is not modelled in the page objects at all, so the Advanced → error state → Quick Order transition that triggers the hang has no path in the suite.
- Second miss: nothing asserts *tap responsiveness*. The bug leaves the screen scrollable, so a WebDriver `isDisplayed()` check still passes; only an actual tap-then-assert-effect (or a stale-error-visible assertion) would fail.

### PRO-8843 — Price 0 reaches the confirmation sheet
- No coverage. No scenario sets an invalid price, and there is no step definition for the "Confirm order?" sheet's *Order value* field (`grep "Confirm order|order value"` across `page_object`/`step_definitions` → zero hits).

### PRO-8842 — Quick Order Spot missing insufficient-balance error
- Nearest: `features/e2e-tests-privy.feature:284` places qty 10 / qty 7 on USDC Spot — always within balance. The scenario asserts only that the margin selector and leverage control are absent.
- The Jira notes the same surface leaked PRO-8509 to prod earlier: Quick Order Spot is a repeat offender with happy-path-only coverage.

### PRO-8841 — Amount input max cap misaligned with WEB
- No coverage on either platform. `grep "1000000000"` matches only USDT minting helpers (`ui_tests/pages/api.ts:374`, `ui_tests/pages/flow/authenFlow.ts:192`), never an input-cap assertion. The web-vs-mobile parity rule the ticket asserts is not encoded anywhere.

### PRO-8840 — Price Alerts: Mark Price shown for Spot pairs
- Mobile: zero price-alert tests (only a notification-title regex in `helpers/langDetect.ts:178`).
- Web: `ui_tests/tests/priceAlert/priceAlert.spec.ts` has ~10 tests, but `INSTRUMENT` is hard-pinned to `BTC_USDT_Perp` (line 18) and every test passes `priceType: "Mark Price"`. The suite therefore asserts the *presence* of Mark Price and never opens the form on a Spot pair — structurally incapable of catching "Mark Price should be absent on Spot".

### PRO-8839 — Earn APY text left-shifted in Japanese
- Partial: `features/language.feature:20` (M-047) does run Japanese and does include the `Earn` screen in its 33-screen sweep — the bug was on screen during an automated run and was not flagged, because the assertion is "no untranslated `ja` text" only.
- No alignment/centering, bounding-box or screenshot-diff assertion exists on mobile.

### PRO-8818 — "Spot" tag missing in the instrument selector
- No coverage. Spot selection exists as a step (`page_object/android/android_trade_page.ts:212`, `page_object/ios/ios_trade_page.ts:140` tap the "Spot" market tab) but nothing asserts the resulting instrument label carries a Spot tag.
- This ticket is at **READY DEPLOY** and was also on the 17-Aug list, reappearing on the 18-Aug run — so it is a re-open/verification gap as well as a coverage gap.

## Proposed automation tasks (drafts — not yet created in Jira)

Estimates assume one mobile automation engineer, Android-first on testnet, iOS following once the pre-release install path is resolved.

| # | Proposed task | Covers | Est. | Target date |
|---|---|---|---|---|
| A1 | **Pre-release env + BrowserStack app slot for mobile suite** — add `envs/pre-release.conf`, pre-release `BS_ANDROID_APP`/`BS_IOS_APP` vars, a `target_env: pre-release` option and an on-demand trigger fired at build hand-off | prerequisite for all 7 | 3 d | **Fri 21 Aug 2026** |
| A2 | **Re-enable iOS crons + resolve iOS pre-release install** (TestFlight build or device registration, with Luy) | prerequisite for 8844/8843/8842/8841 | 2 d + external dependency | **Mon 24 Aug 2026** (dependency-gated) |
| B1 | **Advanced Order page object + error-state → Quick Order navigation scenario, with tap-responsiveness assertion** | PRO-8844 | 3 d | **Fri 21 Aug 2026** |
| B2 | **Order-form negative-validation lane** — new `features/order-validation.feature`: price = 0 blocked before confirmation; amount cap 1,000,000,000 enforced; Quick Order Spot insufficient-balance error shown (parity with Advanced) | PRO-8843, PRO-8841, PRO-8842 | 4 d | **Tue 25 Aug 2026** |
| B3 | **Mobile Price Alerts coverage + Spot price-type matrix**, plus parameterise `ui_tests/tests/priceAlert/priceAlert.spec.ts` off `BTC_USDT_Perp` so the Spot form is exercised on web too | PRO-8840 | 3 d | **Thu 27 Aug 2026** |
| B4 | **Spot tag assertion on the instrument selector / trade form** (bolt onto the existing spot-selection steps; cheapest of the set) | PRO-8818 | 1 d | **Wed 19 Aug 2026** |
| B5 | **Mobile layout-regression assertions per locale** — generic centering / overflow step reusing the existing `locateRect()` + M-084 rect pattern, wired into `features/language.feature` for Earn + Trade in `ja` and `ru` | PRO-8839, plus PRO-8822 / PRO-8827 from the 17-Aug run | 2 d | **Wed 26 Aug 2026** |

Critical path: A1 → B1/B4 land first (blocker + cheapest win), B2/B3/B5 by end of next week. Without A1 and A2 the new tests still never see a pre-release build, so those two should be sequenced first regardless of severity ordering.
