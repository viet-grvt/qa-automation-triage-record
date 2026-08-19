# QE automation task drafts — 7 ticket PRO từ PRE-RELEASE v3.3.0

**Nguồn:** post sign-off của Raj ngày 18/08/2026 ([Slack thread](https://gravity-group-co.slack.com/archives/C07E8H6L0R4/p1787049786049509?thread_ts=1786929270.014159&cid=C07E8H6L0R4)) — NO-GO.
**Truy vết:** đây là output của bước "Review manual regression results" trong [QE-965](https://grvt.atlassian.net/browse/QE-965), epic [QE-964](https://grvt.atlassian.net/browse/QE-964).
**Phân tích nền:** [coverage-gap](pre-release-v3.3.0-coverage-gap.md) · [automatability](pre-release-v3.3.0-automatability.md)

**Về ngôn ngữ:** title và description viết bằng tiếng Anh để khớp convention project QE (toàn bộ QE ticket hiện tại đều tiếng Anh). Phần ghi chú cho anh/chị bằng tiếng Việt, không paste vào Jira.

**Format đã bám theo [QE-913](https://grvt.atlassian.net/browse/QE-913)** — mẫu chuẩn cho task coverage mới: `### 📊 Overview` → `🧩 Preconditions` → `🔁 Test flow` → `✅ Assertions` → `📋 Implementation notes` → `🎯 Acceptance criteria`.

**Field chung cho cả 7 task:**

| Field | Giá trị |
|---|---|
| Project / Type | QE / Task |
| Parent epic | [QE-964](https://grvt.atlassian.net/browse/QE-964) — [QA] Automation enhancements for WEB and MOBILE |
| Assignee | (để trống — chờ phân) |
| Labels | `auto:mobile:new` hoặc `auto:web:new` + `regression` |

> ⚠️ **Về parent epic:** tôi chỉ liệt kê được 5/23 epic của project QE (tool Jira read-only cap 5 dòng/trang, cùng giới hạn đã ghi trong QE-957). Trong 5 dòng đó không có epic "MOBILE UI Automation - Expansion" tương ứng với [QE-392](https://grvt.atlassian.net/browse/QE-392) của web. Nếu epic đó tồn tại thì T1/T3/T4/T5/T7 nên treo vào đó thay vì QE-964 — cần check trên UI trước khi tạo.

---

## Thứ tự đề xuất

| # | Task | Ticket | Est. | Due |
|---|---|---|---|---|
| T1 | Spot tag assertion | PRO-8818 | 1 d | 19/08 |
| T2 | Price Alert price-type matrix (web trước) | PRO-8840 | 0.5 + 3 d | 27/08 |
| T3 | Quick Order interaction integrity | PRO-8844 | 3 d | 21/08 |
| T4 | Order price = 0 validation | PRO-8843 | 1.5 d | 25/08 |
| T5 | Quick Order Spot insufficient balance | PRO-8842 | 2 d | 25/08 |
| T6 | Amount max cap parity | PRO-8841 | 1 d | 26/08 |
| T7 | Locale layout assertions | PRO-8839 | 2 d | 26/08 |

---
---

# T1 — PRO-8818

### Title
```
[MOBILE] Automate Spot instrument tag assertion on the trade form header after selecting a Spot pair
```

### Description

```markdown
### 📊 Overview

Add Appium/Cucumber coverage asserting that the **"Spot" tag** is rendered next to the instrument
name on the trade form after a Spot pair is selected from the instrument modal. Source bug
[PRO-8818](https://grvt.atlassian.net/browse/PRO-8818) — the tag was missing, making Spot
instruments indistinguishable from Perp at a glance.

This is a pure presence assertion on an already-automated navigation path — **no order is
submitted**, so it is safe and deterministic on TESTNET. Cheapest item in the v3.3.0 coverage
backlog per ROI.

### 🧩 Preconditions

| Item | Value |
| --- | --- |
| Environment | TESTNET |
| Platform | ANDROID + iOS (single platform-agnostic scenario) |
| Instrument | One Spot pair (`GRVT/USDT` or `USDC`) + one Perp pair as the negative control |
| Account | Any logged-in trading account; no balance requirement |
| Existing steps reused | `I select "<x>" spot pair`, `I select "<x>" perpetual` |

### 🔁 Test flow

1. Log in and open the **Trade** tab
2. Open the instrument modal and switch to the **Spot** tab
3. Select a Spot pair
4. Read the trade form header region (instrument name + adjacent tag)
5. Repeat steps 2–4 selecting a **Perp** pair as the negative control

### ✅ Assertions

| # | Condition |
| --- | --- |
| 1 | After selecting a Spot pair, a "Spot" tag is displayed **within the trade form header**, adjacent to the instrument name |
| 2 | The tag is scoped to the header — a match found anywhere else on screen does **not** satisfy the assertion |
| 3 | After selecting a Perp pair, no "Spot" tag is present in the same header region (negative control) |
| 4 | The instrument name itself matches the pair that was selected |

### 📋 Implementation notes

* **Scoping is the whole difficulty of this ticket.** The string "Spot" also appears as a market
  tab label — `android_trade_page.ts:212` and `ios_trade_page.ts:140` both tap
  `marketTabLoc("Spot")`. A global text match (`//*[@text='Spot']`) will pass while the bug is
  present. Anchor the locator to the instrument-name node and search only its sibling/parent
  subtree.
* Add the getter to `page_object/abstracts/trade_page.ts` and implement in both
  `android_trade_page.ts` and `ios_trade_page.ts`, following the existing abstract pattern.
* The Perp negative control is not optional — without it a locator that always resolves truthy
  would look green.
* Request a `testID` on the tag node from the mobile team if the iOS header proves to need a
  positional XPath chain; `ios_trade_page.ts` already relies on fragile
  `following-sibling::XCUIElementTypeOther[n]` chains and this should not add another.

### 🎯 Acceptance criteria

- [ ] Scenario green on ANDROID and iOS on TESTNET for 3 consecutive CI runs
- [ ] Negative control (Perp) included and asserted
- [ ] Locator scoped to the trade form header, verified by confirming the test **fails** against a build with the bug present
- [ ] Tagged with the source ticket key and added to the `@regression` suite
- [ ] Comment posted on PRO-8818 linking to the spec
```

**Ghi chú:** điều kiện "verified by confirming the test fails against a build with the bug present" là quan trọng nhất trong AC — PRO-8818 đang ở READY DEPLOY nên còn build lỗi để verify. Nếu fix deploy xong mới viết test thì mất cơ hội chứng minh test thật sự bắt được bug.

---
---

# T2 — PRO-8840

### Title
```
[WEB + MOBILE] Automate Price Alert price-type matrix — Mark Price must be absent for Spot pairs
```

### Description

```markdown
### 📊 Overview

Assert that the Price Alert creation form offers only price types applicable to the selected
instrument class: **Mark Price must not be offered for Spot pairs**, while remaining available for
Perp. Source bug [PRO-8840](https://grvt.atlassian.net/browse/PRO-8840).

Two halves with very different cost, deliverable independently:

* **WEB (~0.5 d)** — the Price Alert page objects already exist and are fully functional. Only the
  instrument dimension is missing.
* **MOBILE (~3 d)** — no Price Alerts page object exists at all; must be built from scratch.

Ship the WEB half first: it guards the same product rule at a sixth of the cost.

### 🧩 Preconditions

| Item | Value |
| --- | --- |
| Environment | TESTNET |
| Instruments | One Perp (`BTC_USDT_Perp`) + one Spot (`GRVT/USDT`) |
| Account | Logged-in account with chart access |
| Cleanup | Alerts deleted before and after each run — `deleteAllAlertsBestEffort()` already exists |

### 🔁 Test flow

**WEB**
1. Open the Price Alerts list from the chart toolbar on a **Perp** instrument
2. Click Add Alert and read the full option list from the price-type selector
3. Switch to a **Spot** instrument and repeat steps 1–2
4. Compare the two option sets

**MOBILE**
1. Navigate to Price Alerts and start creating an alert for a Spot pair
2. Read the price-type selector options
3. Repeat for a Perp pair

### ✅ Assertions

| # | Condition |
| --- | --- |
| 1 | For a **Spot** pair, `"Mark Price"` is **not** among the price-type options |
| 2 | For a **Perp** pair, `"Mark Price"` **is** among the price-type options (guards against over-fixing) |
| 3 | The Spot option list is non-empty — at least Last Price is offered |
| 4 | Assertion is on the option set, not on the default selection |

### 📋 Implementation notes

* **WEB — reuse, do not rewrite.** `ui_tests/pages/priceAlertFormDialog.ts` already exposes
  `getPriceType()` returning the option list. The only change needed is that
  `ui_tests/tests/priceAlert/priceAlert.spec.ts:18` hard-pins
  `const INSTRUMENT = "BTC_USDT_Perp"` and every existing test passes
  `priceType: "Mark Price"`. Parameterise the instrument, then add the two matrix assertions.
* That hardcoding is exactly why the existing 10-test web suite could not catch this: it asserts
  Mark Price is *present* and never opens the form on a Spot pair.
* **MOBILE** needs a new page object — the repo currently has zero Price Alerts modelling
  (`helpers/langDetect.ts:178` holds only a notification-title regex).
* Assert on absence from a **read option set**, never on "clicking Mark Price fails" — the latter
  passes for the wrong reasons.
* Keep the two platforms as separate PRs so the WEB guard is not blocked by mobile page-object work.

### 🎯 Acceptance criteria

- [ ] WEB: Spot + Perp matrix green on TESTNET for 3 consecutive CI runs
- [ ] WEB: existing 10 price-alert tests still green after the instrument parameterisation
- [ ] MOBILE: Spot + Perp matrix green on ANDROID (iOS if the pre-release install path allows)
- [ ] Both halves tagged with the source ticket key
- [ ] Comment posted on PRO-8840 linking to both specs
```

**Ghi chú:** nên tách thành 2 Jira task riêng (web / mobile) nếu muốn track velocity tách bạch — tôi để chung một task vì cùng một business rule, nhưng phần WEB làm được ngay trong ngày còn MOBILE mất 3 ngày, để chung sẽ làm task đứng "In Progress" lâu.

---
---

# T3 — PRO-8844 (blocker, ưu tiên cao nhất)

### Title
```
[MOBILE] Automate Quick Order interaction integrity after navigating from the Advanced Order form with an active validation error
```

### Description

```markdown
### 📊 Overview

Cover the v3.3.0 release blocker [PRO-8844](https://grvt.atlassian.net/browse/PRO-8844): when the
Advanced Order form holds an active validation error and the user navigates to **Quick Order**, the
Quick Order screen enters an unrecoverable state — still scrollable, but no tap target responds.
A force restart is required. Reproduced on Perp and Spot, on both ANDROID and iOS.

Highest-value item in the v3.3.0 set: full loss of trading interaction on a money flow.

### 🧩 Preconditions

| Item | Value |
| --- | --- |
| Environment | TESTNET (PRE-RELEASE once the env config lands) |
| Platform | ANDROID + iOS |
| Instrument | One Spot pair **and** one Perp pair (bug reproduces on both) |
| Balance | Known available balance, low enough that an over-max amount is reachable |
| Order state | No open orders / positions for the instrument — assert-and-clean before running |

### 🔁 Test flow

1. Log in, open the **Trade** tab and select the instrument
2. Open the **Advanced Place Order** form
3. Enter an Amount that exceeds available balance so the validation error / toast appears
   (e.g. `available × 10`) and assert the error is actually displayed
4. While the error state is active, navigate to the **Quick Order** screen
5. Assert the carried-over error is not rendered on the Quick Order panel
6. Tap **Buy** and assert the expected next state appears
7. Repeat for the other instrument class and the Sell side

### ✅ Assertions

| # | Condition |
| --- | --- |
| 1 | The Advanced form error is confirmed **present** before navigating — otherwise the scenario is not exercising the bug |
| 2 | After navigating, the Advanced form's error message is **not** rendered on the Quick Order panel |
| 3 | Tapping **Buy** produces its expected effect (confirmation sheet or toast) within the standard timeout |
| 4 | The Amount input on Quick Order accepts input and reflects the typed value |
| 5 | Assertion 3 holds for both Perp and Spot, and for both Buy and Sell |

### 📋 Implementation notes

* **Do not try to detect "the screen is hung" directly.** The bug leaves the screen scrollable and
  the elements present, so `isDisplayed()` still returns true and a visibility-based check passes
  while the app is dead. Assert the **effect of a tap** (assertion 3) instead — that is what fails
  when the bug is present.
* Assertion 2 is the more precise guard: the leaked error message rendering on Quick Order is the
  direct symptom of the shared validation state the ticket hypothesises.
* **Main cost driver:** the Advanced Place Order form is not modelled anywhere —
  `grep -rin "advanced.order" mobile_tests` returns zero hits. New methods are needed on
  `page_object/abstracts/trade_page.ts` plus both platform implementations. The assertions
  themselves are cheap; the page object is the 3 days.
* **Recovery is mandatory.** If the bug reproduces in CI the app is stuck, and every subsequent
  scenario in the spec will cascade. Add an `After` hook that force-restarts the app when this
  scenario fails — the repo already has app-restart handling (`com.openApp()`, the
  `@notReloadSession` tag) but it must be wired in explicitly here.
* Derive the over-max amount from the balance read at runtime, not a hardcoded number — accounts
  are minted with 1,000,000,000 USDT (`ui_tests/pages/flow/authenFlow.ts:192`), so a fixed
  "large" value will not trigger the error.
* Request `testID`s on the Advanced form inputs and the Quick Order error node. iOS locators in
  `ios_trade_page.ts` currently use positional chains such as
  `following-sibling::XCUIElementTypeOther[8]`; adding another would make this scenario a flake
  source. This is the single cheapest lever on both effort and stability.

### 🎯 Acceptance criteria

- [ ] Scenario green on ANDROID for 3 consecutive CI runs; green on iOS or a documented reason why not
- [ ] Verified to **fail** against a build with the bug present, before the fix lands
- [ ] Perp and Spot both covered; Buy and Sell both covered
- [ ] `After` hook restarts the app on failure — a failing run does not cascade into later scenarios
- [ ] No order left behind; no position state leaked
- [ ] Added to the `@smoke` suite (release blocker class), tagged with the source ticket key
- [ ] Comment posted on PRO-8844 linking to the spec
```

**Ghi chú:** đây là task tôi khuyên bắt đầu ngay, không chờ A1. Lý do: PRO-8844 hiện đang To Do, nên vẫn còn build lỗi để verify test thật sự bắt được bug — AC số 2. Fix deploy rồi thì chỉ verify được chiều "pass", không chứng minh được test có tác dụng.

---
---

# T4 — PRO-8843

### Title
```
[MOBILE] Automate order-form price validation — a zero price must not reach the order confirmation sheet
```

### Description

```markdown
### 📊 Overview

Cover [PRO-8843](https://grvt.atlassian.net/browse/PRO-8843): the mobile order form accepts
`Price = 0` (`0.00000`) and lets the user reach the confirmation sheet, which then renders an
indeterminate `Order value: -- USDT`. Price 0 should be rejected at input/validation stage.

Read-only pre-trade validation — **no order is submitted**, safe on TESTNET.

### 🧩 Preconditions

| Item | Value |
| --- | --- |
| Environment | TESTNET |
| Platform | ANDROID + iOS |
| Instrument | One Perp pair, Limit order type, Cross margin |
| Order state | No open orders for the instrument |

### 🔁 Test flow

1. Log in, open the **Trade** tab, select a Perp instrument and order type **Limit**
2. Set **Price = 0**
3. Enter a valid Amount
4. Attempt to proceed via **Buy / Long**
5. Assert the order cannot progress
6. Repeat for **Sell / Short**

### ✅ Assertions

| # | Condition |
| --- | --- |
| 1 | The order confirmation sheet is **not** displayed while Price = 0 |
| 2 | The order is blocked by at least one of: Buy/Sell disabled, or an inline validation error on the Price field |
| 3 | No order request is issued — verified via order history remaining unchanged |
| 4 | After correcting the price to a valid value, the confirmation sheet **is** reachable (guards against over-blocking) |

### 📋 Implementation notes

* **Assert the invariant, not the mechanism.** The fix may land as a disabled button *or* as an
  inline error — this is not yet decided. Make assertion 1 ("confirmation sheet is not reachable
  with price 0") the primary assertion since it holds regardless of which mechanism ships, and
  treat assertion 2 as a secondary OR-condition. A test pinned to one mechanism will need
  rewriting when the fix chooses the other.
* Assertion 4 is the counterweight — without it, a fix that disables Buy unconditionally would pass.
* Reuse the existing step `Then("The {string} button should be disabled")`
  (`step_definitions/trade.steps.ts:441`) for the button half.
* A **new step is required** for "the confirmation sheet is not shown" — nothing in the repo
  models the confirmation sheet today (`grep "Confirm order"` returns zero hits). Add a getter for
  the sheet and for its `Order value` field; the latter is also what T6 needs.
* Consider pairing with T6 in the same feature file (`features/order-validation.feature`) and the
  same PR — both are order-form input validation on the same screen and share the sheet getter.

### 🎯 Acceptance criteria

- [ ] Scenario green on ANDROID and iOS on TESTNET for 3 consecutive CI runs
- [ ] Primary assertion is mechanism-independent (confirmation sheet unreachable)
- [ ] Positive control included — valid price still reaches the sheet
- [ ] No orders created; order history unchanged after the run
- [ ] Tagged with the source ticket key, added to `@regression`
- [ ] Comment posted on PRO-8843 linking to the spec
```

**Ghi chú:** cần chốt với dev expected behaviour là disable nút hay inline error trước khi viết assertion số 2. Assertion số 1 thì viết được ngay, không phụ thuộc.

---
---

# T5 — PRO-8842

### Title
```
[MOBILE] Automate Quick Order insufficient-balance validation on Spot pairs
```

### Description

```markdown
### 📊 Overview

Cover [PRO-8842](https://grvt.atlassian.net/browse/PRO-8842): the Quick Order panel on a Spot pair
shows no error prompt when the input USDT value exceeds available balance, while the Advanced Place
Order form shows it correctly for identical input. Validation is missing only in Quick Order.

Quick Order on Spot is a repeat offender — [PRO-8509](https://grvt.atlassian.net/browse/PRO-8509)
(margin/leverage sections wrongly shown on Spot) leaked to production from the same surface, and
the existing Quick Order Spot scenario is happy-path only.

### 🧩 Preconditions

| Item | Value |
| --- | --- |
| Environment | TESTNET |
| Platform | ANDROID + iOS |
| Instrument | One Spot pair (`GRVT/USDT` or `USDC`) |
| Balance | Any — the over-balance amount is computed at runtime, see notes |
| Order state | No open orders / positions for the instrument |

### 🔁 Test flow

1. Log in, open the **Trade** tab, select a Spot pair, open the chart view
2. Read the **available balance** shown on the Quick Order panel
3. Open Quick Order and enter an Amount well above that balance (`available × 10`)
4. Assert the insufficient-balance error prompt is displayed
5. Reduce the Amount to within balance and assert the error clears
6. *(Optional, depends on T3's Advanced Order page object)* enter the same over-balance value in
   the Advanced form and assert both surfaces show an equivalent error

### ✅ Assertions

| # | Condition |
| --- | --- |
| 1 | An explicit insufficient-balance error prompt is displayed on the Quick Order panel |
| 2 | Red-coloured figures alone do **not** satisfy assertion 1 — an actual message node is required |
| 3 | The error clears when the Amount is reduced within balance |
| 4 | *(Optional)* Advanced and Quick Order show an equivalent error for identical input |

### 📋 Implementation notes

* **The hard part is test data, not the assertion.** Accounts are minted with 1,000,000,000 USDT
  (`ui_tests/pages/flow/authenFlow.ts:192`), so no hardcoded "large" amount reliably exceeds
  balance. Read available balance at runtime and derive the input from it — that stays correct
  regardless of how the account was funded, and avoids maintaining a dedicated low-balance account.
* Assertion 2 matters because the bug report notes the *only* current signal is red colouring of
  the Sell-side figures. A locator that matches on colour or on the figures themselves would pass
  while the bug is present.
* Requires a new locator for the Quick Order error-prompt node.
* Assertion 4 needs the Advanced Order page object from **T3**. Ship assertions 1–3 first — they
  already guard the regression; add 4 once T3 lands rather than blocking on it.
* Extend `features/e2e-tests-privy.feature`'s existing `@spot_quick_order` scenario area
  (line 284) or add to `features/order-validation.feature`; do not duplicate the Spot selection flow.

### 🎯 Acceptance criteria

- [ ] Assertions 1–3 green on ANDROID and iOS on TESTNET for 3 consecutive CI runs
- [ ] Over-balance amount derived from runtime balance, not hardcoded
- [ ] Error assertion targets a message node, not colour styling
- [ ] Parity assertion (4) either implemented or explicitly deferred to T3 with a note
- [ ] No orders created
- [ ] Tagged with the source ticket key, added to `@regression`
- [ ] Comment posted on PRO-8842 linking to the spec
```

---
---

# T6 — PRO-8841

### Title
```
[WEB + MOBILE] Automate Amount input maximum-value cap parity at 1,000,000,000 USDT
```

### Description

```markdown
### 📊 Overview

Cover [PRO-8841](https://grvt.atlassian.net/browse/PRO-8841): the mobile order-form Amount input
(USDT) has no effective maximum and accepts quadrillion-scale values, computing
`Qty 1,000,000,000,000,001,700` and `Cost 10,000,000,000,000,020.00 USDT`. WEB caps the same input
at **1,000,000,000 USDT**.

The ticket is framed as a web-vs-mobile parity defect, so the coverage should be written as a
**parity assertion driven from a single shared constant**, not as two independent tests.

### 🧩 Preconditions

| Item | Value |
| --- | --- |
| Environment | TESTNET |
| Platform | MOBILE (ANDROID + iOS) and WEB |
| Instrument | One Perp pair, Limit order type |
| Shared constant | `MAX_ORDER_AMOUNT_USDT = 1_000_000_000` in a location both suites can read |

### 🔁 Test flow

1. Open the order form (Limit) on the target instrument
2. Enter an Amount above the cap, e.g. `10000000000000000`
3. Read back the Amount field value and the derived Qty / Cost fields
4. Assert the cap is enforced
5. Enter exactly `1,000,000,000` and assert it is accepted (boundary)
6. Run the same flow on the other platform and compare behaviour

### ✅ Assertions

| # | Condition |
| --- | --- |
| 1 | An Amount above the cap is rejected or clamped — the effective value never exceeds `MAX_ORDER_AMOUNT_USDT` |
| 2 | Derived Qty / Cost are consistent with the effective (capped) Amount, not with the raw input |
| 3 | Exactly `1,000,000,000` is accepted — the boundary is inclusive |
| 4 | WEB and MOBILE enforce the same cap value, read from the shared constant |

### 📋 Implementation notes

* **Neither platform has this covered today.** `grep "1000000000"` across the repo matches only
  USDT minting helpers (`ui_tests/pages/api.ts:374`,
  `ui_tests/pages/flow/authenFlow.ts:192`) — never an input-cap assertion. So this task adds the
  web guard too, it is not mobile-only.
* Drive both suites from one constant. Two hardcoded `1000000000` literals in two repos' test
  files is exactly the drift the ticket is complaining about.
* **Blocked on a product decision:** clamp-to-max vs reject-input vs show-error is not specified.
  Assertion 1 is written as "effective value never exceeds the cap", which holds for clamp and for
  reject; do not pin it to a specific mechanism until the fix is agreed.
* Consider adding the equivalent boundary check to `api_tests` if the BE also enforces a limit —
  an API-level assertion is cheaper and far more stable than a UI one, and would catch cap
  regressions on both platforms at once. UI coverage then only needs to prove the client blocks
  before submit.
* Pair with **T4** in `features/order-validation.feature` and the same PR — same screen, same
  input, shares the confirmation-sheet getter.

### 🎯 Acceptance criteria

- [ ] Cap enforced and asserted on MOBILE (ANDROID + iOS) and WEB
- [ ] Both suites read the same `MAX_ORDER_AMOUNT_USDT` constant
- [ ] Boundary value `1,000,000,000` asserted as accepted
- [ ] Expected mechanism (clamp / reject / error) confirmed with the mobile team and recorded in the ticket before merge
- [ ] API-level equivalent added, or a note explaining why it is not applicable
- [ ] Comment posted on PRO-8841 linking to the specs
```

**Ghi chú:** task này là ứng viên tốt nhất để đẩy xuống `api_tests`. Nếu BE cũng reject thì một test API rẻ hơn nhiều và guard được cả 2 platform, UI chỉ cần chứng minh client chặn trước khi submit.

---
---

# T7 — PRO-8839

### Title
```
[MOBILE] Automate locale layout assertions for Earn and Trade — text centering and overflow across ja and ru
```

### Description

```markdown
### 📊 Overview

Cover [PRO-8839](https://grvt.atlassian.net/browse/PRO-8839): the Earn
`"Earning 3.50% APY on 0.00 USDT"` text shifts left instead of staying centered when Japanese is
selected.

**Deliberately scoped as a generic locale-layout step, not a single-string test.** The mobile suite
already walks 33 screens in Japanese (`features/language.feature` M-047) and asserts only "no
untranslated text" — which is why this bug was on screen during an automated run and went
unflagged. A reusable geometry step closes that class of gap; a one-off assertion on one Earn
string would not justify its maintenance cost.

Same step also covers [PRO-8822](https://grvt.atlassian.net/browse/PRO-8822) (Russian
TradingAccount1 dropdown misaligned) and
[PRO-8827](https://grvt.atlassian.net/browse/PRO-8827) (Spread value cut off) from the 17-Aug run.

### 🧩 Preconditions

| Item | Value |
| --- | --- |
| Environment | TESTNET |
| Platform | ANDROID (iOS once locators are verified) |
| Locales | `en` (baseline), `ja`, `ru` |
| Screens | Earn (APY line), Trade (account dropdown, Spread value) |
| Existing infrastructure | `locateRect()`, `e.getRect()`, `driver.getWindowSize()`, `sharp` |

### 🔁 Test flow

1. Log in and set the app language to `en`
2. For each target element, capture its bounding rect and compute its center offset ratio
   relative to its container width — this is the baseline
3. Switch to `ja`, then `ru`
4. Re-capture the same elements and recompute
5. Compare each locale's offset ratio against the `en` baseline
6. On failure, attach an annotated screenshot marking the measured element

### ✅ Assertions

| # | Condition |
| --- | --- |
| 1 | A centered element's center-offset ratio in `ja` / `ru` matches its `en` baseline within tolerance |
| 2 | No target element overflows the screen bounds (`x < 0` or `x + width > screenWidth`) |
| 3 | No target element is truncated — width is not clipped against its container |
| 4 | Every target element is located and measured; a missing element fails loudly rather than being skipped |

### 📋 Implementation notes

* **The tooling already exists — this is an application gap, not a capability gap.** Reuse:
  * `step_definitions/home.steps.ts:15-50` (M-084, `features/e2e-menus.feature:20`) — the
    established pattern: collect rects, compare against `driver.getWindowSize()`, detect overflow
    and wrapping by height ratio. Copy this structure.
  * `page_object/abstracts/language_page.ts:677` `locateRect(word)` — resolves the bounding box of
    arbitrary text, trying `@text / @content-desc / @label / @name / @value` in turn, so it works
    on both platforms.
  * `language_page.ts:660-675` — `sharp` + SVG overlay + Allure attachment, already used to mark
    untranslated words. Reuse it to mark the measured element on failure.
* **Self-baseline against `en`; do not hardcode pixel positions.** Asserting "must be centered
  ± N px" breaks across device sizes and per-locale font metrics. Comparing each locale's offset
  *ratio* to the same element's `en` ratio isolates the locale regression from device variance.
* **Match the text by stable prefix or regex.** The Earn string embeds a live APY value and a live
  balance (`"Earning 3.50% APY on 0.00 USDT"`), so an exact-string locator will break on any rate
  or balance change.
* Choose the tolerance from measured noise across two device profiles, and record the chosen value
  in the ticket. An undocumented magic number here becomes an unexplainable flake later.
* Extend `features/language.feature` rather than creating a parallel locale feature file — the
  language switching and login flow are already there.

### 🎯 Acceptance criteria

- [ ] Generic step implemented and driven from a table of (screen, element, expected-alignment)
- [ ] Green on ANDROID for `en` / `ja` / `ru` across 3 consecutive CI runs with no tolerance-driven flakes
- [ ] Verified to **fail** on the Earn APY line against a build with PRO-8839 present
- [ ] Same step applied to at least one element from PRO-8822 or PRO-8827, proving reusability
- [ ] Failure output includes measured rects and an annotated screenshot
- [ ] Tolerance value documented in the ticket with the measurements behind it
- [ ] Comments posted on PRO-8839 (and PRO-8822 / PRO-8827 where applied) linking to the spec
```

**Ghi chú:** nếu không làm dạng generic thì tôi khuyên **không** tạo task này, để manual — severity Low, một string ở màn Earn không đáng maintenance cost. AC "applied to at least one element from PRO-8822 or PRO-8827" là để đảm bảo task thật sự đi theo hướng generic chứ không lặng lẽ thu về one-off.

---
---

## Hai task hạ tầng chưa nằm trong 7 ticket, nhưng chặn cả 7

Không phải coverage task nên tôi không viết full description, nhưng cần có nếu muốn 7 test trên thật sự bảo vệ được đợt pre-release sau:

**T0a — `[MOBILE] Add PRE-RELEASE env config and BrowserStack app slot to the mobile suite`**
`mobile_tests/envs/` chỉ có dev/staging/testnet, và `mobile-e2e-tests-bs.yml` default `target_env: testnet`. Viết xong 7 test mà suite vẫn chỉ chạy testnet thì không test nào trong số đó chạy trên build pre-release — tức là không đổi được kết quả của đợt sign-off tiếp theo. Est. 3 d.

**T0b — `[MOBILE] Re-enable iOS scheduled runs and resolve iOS PRE-RELEASE installability`**
Cron iOS ở `mobile-e2e-tests-bs.yml:10` và `:12` đang comment → chỉ Android chạy nightly. 4/7 bug tìm thấy trên iPhone. Thêm nữa Luy đã flag iOS pre-release `.ipa` không install được trên BrowserStack (cần registered device hoặc TestFlight) — phần iOS của T3/T4/T5/T6 vẫn phải test tay cho tới khi giải quyết. Est. 2 d + phụ thuộc mobile team.

---

## Tổng

7 coverage task (T1–T7) + 2 hạ tầng (T0a, T0b). Tổng ~13.5 ngày công cho phần coverage, 5 ngày cho hạ tầng.

Chưa tạo gì trên Jira. Cần confirm 3 điểm trước khi tạo:
1. Parent epic — QE-964 hay epic MOBILE expansion (nếu tồn tại, tôi chưa enumerate được hết 23 epic).
2. T2 để một task hay tách web/mobile thành hai.
3. T7 có làm generic không — nếu không thì bỏ task này, để manual.
