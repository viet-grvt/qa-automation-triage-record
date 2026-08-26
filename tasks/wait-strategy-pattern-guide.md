# Wait Strategy Pattern Guide — Web E2E

**Reference implementation:** Web TP/SL suite (QE-939) · **Parent:** QE-935 (SMOKE flakiness <3%)
**Status:** Draft — pending approval by QA lead
**Scope:** `ui_tests/` (Playwright). Mobile (`mobile_tests/`, WebdriverIO + Cucumber) has a different
waiting model and is **not** covered here.

## Why

A fixed sleep waits too long on a fast run and too little on a slow one. Every sleep is therefore
either wasted runtime or a future flake — it never makes a test correct. The rules below replace
time-based waiting with state-based waiting.

## Rules

**R1 — Never wait on time. Wait on state.**
```ts
// ✗ passes or fails depending on machine speed
await page.waitForTimeout(2000);
await expect(confirmBtn).toBeEnabled();

// ✓ returns as soon as the condition holds
await expect(confirmBtn).toBeEnabled();
```
Playwright web-first assertions retry internally. An explicit wait before an assertion is redundant.

**R2 — Assert the thing you care about, not a proxy for it.**
```ts
// ✗ spinner gone does not mean data arrived
await expect(page.locator(".spinner")).toBeHidden();
await expect(orderRow).toHaveText("0.5");

// ✓ assert the data directly
await expect(orderRow).toHaveText("0.5");
```

**R3 — For server-driven state, poll with an explicit budget.**
```ts
// ✓ order lifecycle: state converges, timing varies
await expect
  .poll(() => api.getOpenOrders().then((o) => o.length), { timeout: TIMEOUTS.serverState })
  .toBe(0);
```
Use `expect.poll` / `expect(...).toPass()` whenever the wait depends on the backend — never a raw
sleep. Existing example: `ui_tests/tests/vault/vaultStrategy.spec.ts:123`.

**R4 — Scope network waits to the action that triggers them.**
```ts
// ✗ networkidle never settles on a page with a live price feed
await page.waitForLoadState("networkidle");

// ✓ tie the wait to the specific request
await Promise.all([
  page.waitForResponse((r) => r.url().includes("/create_order") && r.ok()),
  confirmBtn.click(),
]);
```
`BasePage.waitUntilIdleNetwork()` (`basepage.ts:1057`) is the one remaining `networkidle` caller and
must not gain new ones. Use `BasePage.waitForResponse()` (`basepage.ts:1780`) instead.

**R5 — Asserting absence needs a positive anchor first.**
```ts
// ✗ passes trivially if the list has not rendered yet
await expect(page.getByTestId("order-row")).toHaveCount(0);

// ✓ anchor on a rendered state, then assert absence
await expect(page.getByTestId("orders-panel")).toBeVisible();
await expect(page.getByTestId("order-row")).toHaveCount(0);
```
This is the most common source of false-greens in the suite.

**R6 — For transient bugs, assert persistence, not appearance.**
```ts
// bug class: validation error flashes, then disappears
await expect(errorMessage).toBeVisible();
await expect(errorMessage).toBeVisible({ timeout: TIMEOUTS.persistence });
```
Checking that something is *still* there after the window is what catches a flash.

**R7 — All timeouts come from one constants file. No inline numbers.**
```ts
import { TIMEOUTS } from "../helpers/timeouts";
```
Current state: **92 inline `timeout: <number>` literals** across `ui_tests/`. `helpers/timeouts.ts`
does not exist yet — creating it and migrating callers is part of adopting this guide, not a
prerequisite for it.

**R8 — Retries do not fix flakes.** `retries` stays at its current value. A test that only passes on
retry gets root-caused or quarantined under a ticket — never silently retried.

## Timeout budget — *needs lead confirmation*

| Constant | Proposed | Applies to |
|---|---|---|
| `element` | 5s | Element visible / enabled / text |
| `navigation` | 15s | Page load, route change |
| `serverState` | 10s | Order placed / cancelled / amended — backend convergence |
| `priceFeed` | 3s | WebSocket-driven price or order-book update |
| `persistence` | 2s | R6 — value must still hold after this window |

Starting values from the TP/SL refactor. Raising one is a decision, not a fix — record the reason in
the PR.

## Locator ladder

1. `getByTestId()` — preferred
2. `getByRole()` with accessible name
3. `getByLabel()`
4. `getByText()` — content assertions only, never navigation
5. CSS — last resort
6. **XPath — not permitted in new or refactored code**

Current state: 8 `getByTestId` vs 30 `getByText` and heavy XPath, e.g.
`pages/splitTPSLPage.ts` matches on hashed CSS-module classes
(`contains(@class,'style_toggleItem__')`) — these break on any FE rebuild.

**Interim rule while PRO-8993 is open** (365 elements missing `data-testid`; QA-side tracking in
QE-1019): use the highest available rung and mark it `// TODO(QE-1019): replace with testid`.
Missing attributes do not block a refactor, but no new XPath enters the codebase.

## Applying this to the next module

1. Grep the module for `waitForTimeout`, `sleep`, `setTimeout`, `networkidle` — every hit is a defect.
2. Replace using the rule that matches the *class* of wait (UI state → R1/R2, backend → R3, request → R4).
3. Import timeouts from the constants file; delete inline numbers.
4. Run the module **10 consecutive times**. Below 10/10 means the refactor is not finished.
5. Log every locator that had to drop below `getByTestId` into QE-1019.

## Evidence from the TP/SL module

| Metric | Before | After |
|---|---|---|
| Fixed sleeps (`waitForTimeout`) | `<n>` | 0 |
| `networkidle` waits | `<n>` | 0 |
| Inline timeout literals | `<n>` | `<n>` |
| XPath locators | `<n>` | `<n>` |
| Module runtime | `<n>` | `<n>` |
| Consecutive green runs | — | `<n>/10` |

## Open decisions for the QA lead

1. **Timeout budget** — confirm the five constants above before other modules adopt them.
2. **XPath ban** — confirm the interim rule (highest-available locator + TODO) is preferred over
   waiting for PRO-8993 to land.
3. **Retry policy (R8)** — confirm root-cause-or-quarantine, since it changes day-to-day workflow.

## Not covered

Mobile (`mobile_tests/`, WebdriverIO + Cucumber). A mobile counterpart can follow once these
conventions are settled.
