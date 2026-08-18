# Why our own tests are failing — 18 Aug

These 5 tests were judged to be **our fault, not the product's**. This page says why each one breaks and what to change.

Everything below comes from reading the test code automatically. It is a strong starting point, not proof — the run log is what settles it.

## Start here

**3 of these 5 failures go through the same file — `ui_tests/helpers/utilities.ts`.** Fixing that one file is worth more than fixing the tests one at a time, because each individual patch only buys a few days before the next change breaks it again.

| File | Failing tests using it | Problems found |
|---|---|---|
| `ui_tests/helpers/utilities.ts` | 3 | 15 |
| `ui_tests/pages/transferpage.ts` | 3 | 81 |
| `ui_tests/fixtures/fixtures.ts` | 3 | 10 |
| `ui_tests/pages/homepage.ts` | 3 | 3 |
| `ui_tests/pages/headerNavPage.ts` | 2 | 6 |

Across all 5, the recurring problems are: the test finds elements by their position or styling instead of a stable name (5 tests); it only breaks on one browser, device or environment (2 tests).

Anything that has no stable label for the tests to grab becomes **one** request to the frontend team rather than several — that is the action QE-935 asks for, and it is what moves the flakiness number instead of resetting a streak for a day.

## 1. Verify the navigation header renders correctly across all supported locales

**Area:** Header Nav · **Where:** the prod smoke run

**How it fails.** It fails occasionally — 20% of the last 5 runs. It only ever fails on firefox.

**Most likely cause.** It only breaks on one browser, device or environment. The test logic is fine elsewhere, so this is about that specific platform, not about the test as a whole.

**Note from triage:** Language switch fired while the Liquidity League page was still navigating so the language panel never opened; on retry the Strategies page exceeded the test's 15s header wait.

**What to change.**

1. Replace the 25 XPath/text locator(s) on the failing path with test ids — _small_
   The selector no longer matches the DOM; the product itself may be fine.
   ⚠️ Any element without a stable attribute needs a data-testid from FE — raise that request today (QE-935 action 3).
2. Reproduce on `firefox` specifically and decide: engine-specific product bug, or a locator/wait that only that engine exposes — _investigation first_
   It passes on brave, chrome, so the test logic is not wholesale wrong.
   ⚠️ If the product genuinely behaves differently there, this is an APP-BUG, not a SCRIPT defect — re-classify it.

<details><summary>The code, the evidence, and the exact edits</summary>

### Source

`ui_tests/tests/headerNav.spec.ts:126` (exact match, file has 226 lines)

Run log for the latest failure:
```bash
gh run view 32074382983 --log-failed -R gravity-technologies/qa-automation | head -120
```

### Anti-patterns near the test (0 hit(s) in this file)

No static anti-pattern found. That points away from the test code itself — check the run log, the fixture/page-object it calls, and whether the product actually changed.

### Anti-patterns in the page objects / helpers this spec imports

| File | Hits | Kinds | On this test's path? |
|---|---|---|---|
| `ui_tests/pages/headerNavPage.ts` | 6 | arbitrary-timeout, xpath-locator | likely — the filename matches the test |
| `ui_tests/pages/commonPage.ts` | 21 | xpath-locator, conditional-assert | imported, relevance unclear |
| `ui_tests/helpers/utilities.ts` | 15 | shared-mutable-state, conditional-assert, xpath-locator | imported, relevance unclear |

**XPath locator** — `ui_tests/pages/headerNavPage.ts:411`

```ts
  409       const page = await this.setBasePage();
  410       await page
  411 >       .locator(`xpath=//*[@class="Toastify"]//*[@fill="none"]`)
  412         .click({ timeout: 1000 })
  413         .catch(() => {});
```

- XPath chains break on any DOM restructure, which is exactly the kind of failure that gets misread as a product bug.
- Fix (shape is clear, target needs your judgement):

```diff
- .locator(`xpath=//*[@class="Toastify"]//*[@fill="none"]`)
+ .getByTestId("toastify")
```

  This XPath walks 2 steps — the suggestion below only resolves the first one, so it targets the ancestor, not the element the test actually clicks. Pick the real target before applying it. The XPath pins the exact class list ("Toastify"), so one utility-class change breaks it.
  ⚠️ Needs FE/mobile to add `data-testid="toastify"` — raise it today, quarantine meanwhile.

**XPath locator** — `ui_tests/pages/headerNavPage.ts:416`

```ts
  414       await page
  415         .locator(
  416 >         `xpath=//*[@role='dialog' and contains(@style,'1001')]//span[contains(@class,'pointer')]`,
  417         )
  418         .click({ timeout: 1000 })
```

- XPath chains break on any DOM restructure, which is exactly the kind of failure that gets misread as a product bug.
- Fix (shape is clear, target needs your judgement):

```diff
- `xpath=//*[@role='dialog' and contains(@style,'1001')]//span[contains(@class,'pointer')]`,
+ page.getByRole("dialog"),
```

  This XPath walks 2 steps — the suggestion below only resolves the first one, so it targets the ancestor, not the element the test actually clicks. Pick the real target before applying it.

### File history (30 days)

- `e30d8053` 2026-08-18 Pham The Viet — QE-950: Fix flaky navigation header tests on production smoke run (#1348)
- `76d5d7ae` 2026-08-17 Pham The Viet — QE-793: Add navigation header checks across pages and locales (#1346)

### Likely cause

- `env-dependency`
- `brittle-locator`

</details>

**Record the decision**

```bash
node tools/bin/script-rca.js --record --test "Verify the navigation header renders correctly across all supported locales" --channel web-prod \
  --cause <env-dependency> --action <fix|quarantine|rewrite|request-testid|wont-fix> --detail "..." --owner me
```

> Reminder: a `SCRIPT` failure on a smoke suite breaks the QE-935 100% accuracy goal, so it is either fixed today or quarantined with a ticket.

## 2. Verify the navigation header stays identical across repeated reloads

**Area:** Header Nav · **Where:** the prod smoke run

**How it fails.** It fails occasionally — 20% of the last 5 runs. It only ever fails on firefox.

**Most likely cause.** It only breaks on one browser, device or environment. The test logic is fine elsewhere, so this is about that specific platform, not about the test as a whole.

**Note from triage:** Strategies header renders 3 items before APY data lands and 4 after, so the baseline fingerprint is captured loaded while post-reload snapshots are captured unloaded.

**What to change.**

1. Replace the 25 XPath/text locator(s) on the failing path with test ids — _small_
   The selector no longer matches the DOM; the product itself may be fine.
   ⚠️ Any element without a stable attribute needs a data-testid from FE — raise that request today (QE-935 action 3).
2. Reproduce on `firefox` specifically and decide: engine-specific product bug, or a locator/wait that only that engine exposes — _investigation first_
   It passes on brave, chrome, so the test logic is not wholesale wrong.
   ⚠️ If the product genuinely behaves differently there, this is an APP-BUG, not a SCRIPT defect — re-classify it.

<details><summary>The code, the evidence, and the exact edits</summary>

### Source

`ui_tests/tests/headerNav.spec.ts:179` (exact match, file has 226 lines)

Run log for the latest failure:
```bash
gh run view 32074382983 --log-failed -R gravity-technologies/qa-automation | head -120
```

### Anti-patterns near the test (0 hit(s) in this file)

No static anti-pattern found. That points away from the test code itself — check the run log, the fixture/page-object it calls, and whether the product actually changed.

### Anti-patterns in the page objects / helpers this spec imports

| File | Hits | Kinds | On this test's path? |
|---|---|---|---|
| `ui_tests/pages/headerNavPage.ts` | 6 | arbitrary-timeout, xpath-locator | likely — the filename matches the test |
| `ui_tests/pages/commonPage.ts` | 21 | xpath-locator, conditional-assert | imported, relevance unclear |
| `ui_tests/helpers/utilities.ts` | 15 | shared-mutable-state, conditional-assert, xpath-locator | imported, relevance unclear |

**XPath locator** — `ui_tests/pages/headerNavPage.ts:411`

```ts
  409       const page = await this.setBasePage();
  410       await page
  411 >       .locator(`xpath=//*[@class="Toastify"]//*[@fill="none"]`)
  412         .click({ timeout: 1000 })
  413         .catch(() => {});
```

- XPath chains break on any DOM restructure, which is exactly the kind of failure that gets misread as a product bug.
- Fix (shape is clear, target needs your judgement):

```diff
- .locator(`xpath=//*[@class="Toastify"]//*[@fill="none"]`)
+ .getByTestId("toastify")
```

  This XPath walks 2 steps — the suggestion below only resolves the first one, so it targets the ancestor, not the element the test actually clicks. Pick the real target before applying it. The XPath pins the exact class list ("Toastify"), so one utility-class change breaks it.
  ⚠️ Needs FE/mobile to add `data-testid="toastify"` — raise it today, quarantine meanwhile.

**XPath locator** — `ui_tests/pages/headerNavPage.ts:416`

```ts
  414       await page
  415         .locator(
  416 >         `xpath=//*[@role='dialog' and contains(@style,'1001')]//span[contains(@class,'pointer')]`,
  417         )
  418         .click({ timeout: 1000 })
```

- XPath chains break on any DOM restructure, which is exactly the kind of failure that gets misread as a product bug.
- Fix (shape is clear, target needs your judgement):

```diff
- `xpath=//*[@role='dialog' and contains(@style,'1001')]//span[contains(@class,'pointer')]`,
+ page.getByRole("dialog"),
```

  This XPath walks 2 steps — the suggestion below only resolves the first one, so it targets the ancestor, not the element the test actually clicks. Pick the real target before applying it.

### File history (30 days)

- `e30d8053` 2026-08-18 Pham The Viet — QE-950: Fix flaky navigation header tests on production smoke run (#1348)
- `76d5d7ae` 2026-08-17 Pham The Viet — QE-793: Add navigation header checks across pages and locales (#1346)

### Likely cause

- `env-dependency`
- `brittle-locator`

</details>

**Record the decision**

```bash
node tools/bin/script-rca.js --record --test "Verify the navigation header stays identical across repeated reloads" --channel web-prod \
  --cause <env-dependency> --action <fix|quarantine|rewrite|request-testid|wont-fix> --detail "..." --owner me
```

> Reminder: a `SCRIPT` failure on a smoke suite breaks the QE-935 100% accuracy goal, so it is either fixed today or quarantined with a ticket.

## 3. Verify Trade-Indicators data for all instruments is rendered as expected

**Area:** E2e Tests · **Where:** the testnet smoke run

**How it fails.** Only 1 run has been recorded for this test so far, which is not enough to tell a real pattern from bad luck.

**Most likely cause.** Too early to say. Let it run a few more times, or read the log from the one failure we have.

⚠️ **This was already "fixed" once and came back** — 4 Aug, "fix: Verify trading chart candle-sticks are rendered as expected (#1280)". Whatever was changed then did not address the real cause, so patching it a second time is unlikely to hold.

**Note from triage:** Checking every instrument across two parallel browsers exceeds the testnet API rate limit and KORU-USDT returns error 1015; the suite's own load causes the failure.

**What to change.**

1. Rewrite rather than patch — _—_
   This test was already "fixed" in 82fd6b91 and came back. The earlier root cause was not the real one.
2. Rewrite the locators in `ui_tests/pages/perpetualpage.ts` (122 XPath expressions) — _large — a page-object rewrite, not a one-line fix_
   Patching one selector here buys a few days; the whole file breaks on the next DOM change.
   ⚠️ Any element without a stable attribute needs a data-testid from FE — raise that request today (QE-935 action 3).

<details><summary>The code, the evidence, and the exact edits</summary>

### Source

`ui_tests/tests/e2e_tests.spec.ts:59` (exact match, file has 802 lines)

Run log for the latest failure:
```bash
gh run view 32098545871 --log-failed -R gravity-technologies/qa-automation | head -120
```

### Anti-patterns near the test (0 hit(s) in this file)

No static anti-pattern found. That points away from the test code itself — check the run log, the fixture/page-object it calls, and whether the product actually changed.

### Anti-patterns in the page objects / helpers this spec imports

| File | Hits | Kinds | On this test's path? |
|---|---|---|---|
| `ui_tests/pages/perpetualpage.ts` | 171 | xpath-locator, shared-mutable-state, conditional-assert, arbitrary-timeout, text-locator, empty-catch | imported, relevance unclear |
| `ui_tests/pages/transferpage.ts` | 81 | xpath-locator, hardcoded-account, conditional-assert | imported, relevance unclear |
| `ui_tests/pages/accountpage.ts` | 54 | xpath-locator, conditional-assert, empty-catch, arbitrary-timeout | imported, relevance unclear |
| `ui_tests/fixtures/fixtures.ts` | 10 | conditional-assert, arbitrary-timeout | imported, relevance unclear |
| `ui_tests/pages/homepage.ts` | 3 | xpath-locator, conditional-assert | imported, relevance unclear |
| `ui_tests/pages/flow/tradingFlow.ts` | 1 | xpath-locator | imported, relevance unclear |

**XPath locator** — `ui_tests/pages/perpetualpage.ts:55`

```ts
   53   };
   54   
   55 > const tableTab = `//*[contains(@class,'tabItem')]//*[contains(text(),'{0}') or contains(text(),'{1}')]`;
   56   const openOrderTab = String.format(tableTab, "Open Orders", "Open orders");
   57   const positionTab = `//*[contains(@class,'tabItem')]//*[contains(text(),'Positions')]`;
```

- XPath chains break on any DOM restructure, which is exactly the kind of failure that gets misread as a product bug.
- Fix (shape is clear, target needs your judgement):

```diff
- const tableTab = `//*[contains(@class,'tabItem')]//*[contains(text(),'{0}') or contains(text(),'{1}')]`;
+ const tableTab = "tab-item";
+ // call site:  page.getByTestId(tableTab)
```

  This XPath walks 2 steps — the suggestion below only resolves the first one, so it targets the ancestor, not the element the test actually clicks. Pick the real target before applying it. Derived from the class name "tabItem". A class is a styling hook, so this breaks on any CSS refactor.
  ⚠️ Needs FE/mobile to add `data-testid="tab-item"` — raise it today, quarantine meanwhile.

**XPath locator** — `ui_tests/pages/perpetualpage.ts:57`

```ts
   55   const tableTab = `//*[contains(@class,'tabItem')]//*[contains(text(),'{0}') or contains(text(),'{1}')]`;
   56   const openOrderTab = String.format(tableTab, "Open Orders", "Open orders");
   57 > const positionTab = `//*[contains(@class,'tabItem')]//*[contains(text(),'Positions')]`;
   58   const orderHistoryTab = String.format(
   59     tableTab,
```

- XPath chains break on any DOM restructure, which is exactly the kind of failure that gets misread as a product bug.
- Fix (shape is clear, target needs your judgement):

```diff
- const positionTab = `//*[contains(@class,'tabItem')]//*[contains(text(),'Positions')]`;
+ const positionTab = "tab-item";
+ // call site:  page.getByTestId(positionTab)
```

  This XPath walks 2 steps — the suggestion below only resolves the first one, so it targets the ancestor, not the element the test actually clicks. Pick the real target before applying it. Derived from the class name "tabItem". A class is a styling hook, so this breaks on any CSS refactor.
  ⚠️ Needs FE/mobile to add `data-testid="tab-item"` — raise it today, quarantine meanwhile.

### File history (30 days)

- `84fdabe6` 2026-08-12 Pham The Viet — fix: Verify a new Sub-Account can be created (#1318)
- `8d657d1e` 2026-08-11 Pham The Viet — fix: Verify every page displays the selected language correctly (#1313)
- `c6394745` 2026-08-07 Pham The Viet — Disable ETH minting tests on web (#1296)
- `82fd6b91` 2026-08-04 Pham The Viet — fix: Verify trading chart candle-sticks are rendered as expected (#1280)
- `76d2f6c7` 2026-08-03 Pham The Viet — update: titles of test cases (#1275)

### Likely cause

- `brittle-locator`

</details>

**Record the decision**

```bash
node tools/bin/script-rca.js --record --test "Verify Trade-Indicators data for all instruments is rendered as expected" --channel web-testnet \
  --cause <brittle-locator> --action <fix|quarantine|rewrite|request-testid|wont-fix> --detail "..." --owner me
```

> Reminder: a `SCRIPT` failure on a smoke suite breaks the QE-935 100% accuracy goal, so it is either fixed today or quarantined with a ticket.

## 4. Verify deposit progress is rejected when user cancels wallet connection

**Area:** Deposit · **Where:** the testnet regression run

**How it fails.** Only 1 run has been recorded for this test so far, which is not enough to tell a real pattern from bad luck.

**Most likely cause.** Too early to say. Let it run a few more times, or read the log from the one failure we have.

**Note from triage:** The receiveValue locator matched the wrong element so the test read an incorrect Receive amount; locator corrected.

**What to change.**

1. Rewrite the locators in `ui_tests/pages/transferpage.ts` (61 XPath expressions) — _large — a page-object rewrite, not a one-line fix_
   Patching one selector here buys a few days; the whole file breaks on the next DOM change.
   ⚠️ Any element without a stable attribute needs a data-testid from FE — raise that request today (QE-935 action 3).

<details><summary>The code, the evidence, and the exact edits</summary>

### Source

`ui_tests/tests/deposit/deposit.spec.ts:102` (exact match, file has 198 lines)

Run log for the latest failure:
```bash
gh run view 32048932937 --log-failed -R gravity-technologies/qa-automation | head -120
```

### Anti-patterns near the test (0 hit(s) in this file)

No static anti-pattern found. That points away from the test code itself — check the run log, the fixture/page-object it calls, and whether the product actually changed.

### Anti-patterns in the page objects / helpers this spec imports

| File | Hits | Kinds | On this test's path? |
|---|---|---|---|
| `ui_tests/pages/transferpage.ts` | 81 | xpath-locator, hardcoded-account, conditional-assert | imported, relevance unclear |
| `ui_tests/pages/metamaskpage.ts` | 30 | xpath-locator, text-locator, conditional-assert, arbitrary-timeout | imported, relevance unclear |
| `ui_tests/helpers/utilities.ts` | 15 | shared-mutable-state, conditional-assert, xpath-locator | imported, relevance unclear |
| `ui_tests/fixtures/fixtures.ts` | 10 | conditional-assert, arbitrary-timeout | imported, relevance unclear |
| `ui_tests/pages/homepage.ts` | 3 | xpath-locator, conditional-assert | imported, relevance unclear |
| `ui_tests/pages/flow/authenFlow.ts` | 1 | empty-catch | imported, relevance unclear |

**XPath locator** — `ui_tests/pages/transferpage.ts:24`

```ts
   22   // Static locators
   23   // ---------------
   24 > const dialog = `//*[@role='dialog']`;
   25   const menuContainer = `//*[contains(@class,'_menuContainer')]`;
   26   const fundingAccountText = `//div[contains(text(),'Funding Account') and not(contains(text(),'Balance'))]/following-sibling::div[1]`;
```

- XPath chains break on any DOM restructure, which is exactly the kind of failure that gets misread as a product bug.
- Fix (mechanical rewrite — still verify it):

```diff
- const dialog = `//*[@role='dialog']`;
+ // no plain-string form — build this where the page object uses it:
+ // page.getByRole("dialog")
```


**XPath locator** — `ui_tests/pages/transferpage.ts:25`

```ts
   23   // ---------------
   24   const dialog = `//*[@role='dialog']`;
   25 > const menuContainer = `//*[contains(@class,'_menuContainer')]`;
   26   const fundingAccountText = `//div[contains(text(),'Funding Account') and not(contains(text(),'Balance'))]/following-sibling::div[1]`;
   27   const transferOrMoveBtn = `//*[@alt='mint-tokens']/following-sibling::div//button[text()='Transfer' or text()='Move']`;
```

- XPath chains break on any DOM restructure, which is exactly the kind of failure that gets misread as a product bug.
- Fix (shape is clear, target needs your judgement):

```diff
- const menuContainer = `//*[contains(@class,'_menuContainer')]`;
+ const menuContainer = "menu-container";
+ // call site:  page.getByTestId(menuContainer)
```

  Derived from the class name "_menuContainer". A class is a styling hook, so this breaks on any CSS refactor.
  ⚠️ Needs FE/mobile to add `data-testid="menu-container"` — raise it today, quarantine meanwhile.

### File history (30 days)

- `54f0706c` 2026-08-13 Pham The Viet — Fix app version not displayed in allure report (#1328)
- `8d657d1e` 2026-08-11 Pham The Viet — fix: Verify every page displays the selected language correctly (#1313)
- `76d2f6c7` 2026-08-03 Pham The Viet — update: titles of test cases (#1275)
- `2c4e9c29` 2026-08-03 Pham The Viet — Add test step blocks to ui tests specs (#1269)
- `b7829888` 2026-07-31 Pham The Viet — fix: Wallet shows correct balance USDT after successful withdrawal (#1263)

### Likely cause

- `brittle-locator`

</details>

**Record the decision**

```bash
node tools/bin/script-rca.js --record --test "Verify deposit progress is rejected when user cancels wallet connection" --channel web-testnet \
  --cause <brittle-locator> --action <fix|quarantine|rewrite|request-testid|wont-fix> --detail "..." --owner me
```

> Reminder: a `SCRIPT` failure on a smoke suite breaks the QE-935 100% accuracy goal, so it is either fixed today or quarantined with a ticket.

## 5. Verify Trade-Indicators data for all instruments is rendered as expected

**Area:** E2e Tests · **Where:** the staging smoke run

**How it fails.** Only 1 run has been recorded for this test so far, which is not enough to tell a real pattern from bad luck.

**Most likely cause.** Too early to say. Let it run a few more times, or read the log from the one failure we have.

⚠️ **This was already "fixed" once and came back** — 4 Aug, "fix: Verify trading chart candle-sticks are rendered as expected (#1280)". Whatever was changed then did not address the real cause, so patching it a second time is unlikely to hold.

**Note from triage:** Same rate-limit (error 1015) as testnet: all-instrument checks across two parallel browsers exceed the API limit.

**What to change.**

1. Rewrite rather than patch — _—_
   This test was already "fixed" in 82fd6b91 and came back. The earlier root cause was not the real one.
2. Rewrite the locators in `ui_tests/pages/perpetualpage.ts` (122 XPath expressions) — _large — a page-object rewrite, not a one-line fix_
   Patching one selector here buys a few days; the whole file breaks on the next DOM change.
   ⚠️ Any element without a stable attribute needs a data-testid from FE — raise that request today (QE-935 action 3).

<details><summary>The code, the evidence, and the exact edits</summary>

### Source

`ui_tests/tests/e2e_tests.spec.ts:59` (exact match, file has 802 lines)

Run log for the latest failure:
```bash
gh run view 32098546549 --log-failed -R gravity-technologies/qa-automation | head -120
```

### Anti-patterns near the test (0 hit(s) in this file)

No static anti-pattern found. That points away from the test code itself — check the run log, the fixture/page-object it calls, and whether the product actually changed.

### Anti-patterns in the page objects / helpers this spec imports

| File | Hits | Kinds | On this test's path? |
|---|---|---|---|
| `ui_tests/pages/perpetualpage.ts` | 171 | xpath-locator, shared-mutable-state, conditional-assert, arbitrary-timeout, text-locator, empty-catch | imported, relevance unclear |
| `ui_tests/pages/transferpage.ts` | 81 | xpath-locator, hardcoded-account, conditional-assert | imported, relevance unclear |
| `ui_tests/pages/accountpage.ts` | 54 | xpath-locator, conditional-assert, empty-catch, arbitrary-timeout | imported, relevance unclear |
| `ui_tests/fixtures/fixtures.ts` | 10 | conditional-assert, arbitrary-timeout | imported, relevance unclear |
| `ui_tests/pages/homepage.ts` | 3 | xpath-locator, conditional-assert | imported, relevance unclear |
| `ui_tests/pages/flow/tradingFlow.ts` | 1 | xpath-locator | imported, relevance unclear |

**XPath locator** — `ui_tests/pages/perpetualpage.ts:55`

```ts
   53   };
   54   
   55 > const tableTab = `//*[contains(@class,'tabItem')]//*[contains(text(),'{0}') or contains(text(),'{1}')]`;
   56   const openOrderTab = String.format(tableTab, "Open Orders", "Open orders");
   57   const positionTab = `//*[contains(@class,'tabItem')]//*[contains(text(),'Positions')]`;
```

- XPath chains break on any DOM restructure, which is exactly the kind of failure that gets misread as a product bug.
- Fix (shape is clear, target needs your judgement):

```diff
- const tableTab = `//*[contains(@class,'tabItem')]//*[contains(text(),'{0}') or contains(text(),'{1}')]`;
+ const tableTab = "tab-item";
+ // call site:  page.getByTestId(tableTab)
```

  This XPath walks 2 steps — the suggestion below only resolves the first one, so it targets the ancestor, not the element the test actually clicks. Pick the real target before applying it. Derived from the class name "tabItem". A class is a styling hook, so this breaks on any CSS refactor.
  ⚠️ Needs FE/mobile to add `data-testid="tab-item"` — raise it today, quarantine meanwhile.

**XPath locator** — `ui_tests/pages/perpetualpage.ts:57`

```ts
   55   const tableTab = `//*[contains(@class,'tabItem')]//*[contains(text(),'{0}') or contains(text(),'{1}')]`;
   56   const openOrderTab = String.format(tableTab, "Open Orders", "Open orders");
   57 > const positionTab = `//*[contains(@class,'tabItem')]//*[contains(text(),'Positions')]`;
   58   const orderHistoryTab = String.format(
   59     tableTab,
```

- XPath chains break on any DOM restructure, which is exactly the kind of failure that gets misread as a product bug.
- Fix (shape is clear, target needs your judgement):

```diff
- const positionTab = `//*[contains(@class,'tabItem')]//*[contains(text(),'Positions')]`;
+ const positionTab = "tab-item";
+ // call site:  page.getByTestId(positionTab)
```

  This XPath walks 2 steps — the suggestion below only resolves the first one, so it targets the ancestor, not the element the test actually clicks. Pick the real target before applying it. Derived from the class name "tabItem". A class is a styling hook, so this breaks on any CSS refactor.
  ⚠️ Needs FE/mobile to add `data-testid="tab-item"` — raise it today, quarantine meanwhile.

### File history (30 days)

- `84fdabe6` 2026-08-12 Pham The Viet — fix: Verify a new Sub-Account can be created (#1318)
- `8d657d1e` 2026-08-11 Pham The Viet — fix: Verify every page displays the selected language correctly (#1313)
- `c6394745` 2026-08-07 Pham The Viet — Disable ETH minting tests on web (#1296)
- `82fd6b91` 2026-08-04 Pham The Viet — fix: Verify trading chart candle-sticks are rendered as expected (#1280)
- `76d2f6c7` 2026-08-03 Pham The Viet — update: titles of test cases (#1275)

### Likely cause

- `brittle-locator`

</details>

**Record the decision**

```bash
node tools/bin/script-rca.js --record --test "Verify Trade-Indicators data for all instruments is rendered as expected" --channel web-staging \
  --cause <brittle-locator> --action <fix|quarantine|rewrite|request-testid|wont-fix> --detail "..." --owner me
```

> Reminder: a `SCRIPT` failure on a smoke suite breaks the QE-935 100% accuracy goal, so it is either fixed today or quarantined with a ticket.

