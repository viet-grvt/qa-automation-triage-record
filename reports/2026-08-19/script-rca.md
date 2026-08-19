# Why our own tests are failing — 19 Aug

These 37 tests were judged to be **our fault, not the product's**. This page says why each one breaks and what to change.

Everything below comes from reading the test code automatically. It is a strong starting point, not proof — the run log is what settles it.

## Start here

**31 of these 37 failures go through the same file — `ui_tests/fixtures/fixtures.ts`.** Fixing that one file is worth more than fixing the tests one at a time, because each individual patch only buys a few days before the next change breaks it again.

| File | Failing tests using it | Problems found |
|---|---|---|
| `ui_tests/fixtures/fixtures.ts` | 31 | 10 |
| `ui_tests/pages/flow/tradingFlow.ts` | 28 | 1 |
| `ui_tests/pages/perpetualpage.ts` | 24 | 172 |
| `ui_tests/helpers/utilities.ts` | 21 | 15 |
| `ui_tests/pages/homepage.ts` | 18 | 3 |

Across all 37, the recurring problems are: the test finds elements by their position or styling instead of a stable name (37 tests); the test acts before the page has finished updating (4 tests); the test checks the wrong thing, or skips its check entirely (4 tests); tests in the same file leak state into each other; it only breaks on one browser, device or environment.

Anything that has no stable label for the tests to grab becomes **one** request to the frontend team rather than several — that is the action QE-935 asks for, and it is what moves the flakiness number instead of resetting a streak for a day.

## 1. Verify the navigation header renders correctly across all supported locales

**Area:** Header Nav · **Where:** the prod smoke run

**How it fails.** It fails occasionally — 0% of the last 10 runs. It only ever fails on firefox.

**Most likely cause.** The test acts before the page has finished updating. Sometimes the page is ready in time and sometimes it is not, which is why it passes and fails at random.

**Already decided:** Fix the test now — the cause is small and local. (setLocale fires while the Liquidity League page is still navigating so the language panel never opens; on retry the Strategies page exceeds  …)

**Note from triage:** Language switch fired while the Liquidity League page was still navigating so the language panel never opened; on retry the Strategies page exceeded the test's 15s header wait.

**What to change.**

1. Replace the 25 XPath/text locator(s) on the failing path with test ids — _small_
   The selector no longer matches the DOM; the product itself may be fine.
   ⚠️ Any element without a stable attribute needs a data-testid from FE — raise that request today (QE-935 action 3).

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

- `brittle-locator`

</details>

**Record the decision**

```bash
node tools/bin/script-rca.js --record --test "Verify the navigation header renders correctly across all supported locales" --channel web-prod \
  --cause <brittle-locator> --action <fix|quarantine|rewrite|request-testid|wont-fix> --detail "..." --owner me
```

> Reminder: a `SCRIPT` failure on a smoke suite breaks the QE-935 100% accuracy goal, so it is either fixed today or quarantined with a ticket.

## 2. Verify the navigation header stays identical across repeated reloads

**Area:** Header Nav · **Where:** the prod smoke run

**How it fails.** It fails occasionally — 0% of the last 10 runs. It only ever fails on firefox.

**Most likely cause.** The test acts before the page has finished updating. Sometimes the page is ready in time and sometimes it is not, which is why it passes and fails at random.

**Already decided:** Fix the test now — the cause is small and local. (The Strategies header renders 3 items before APY data lands and 4 after, so the baseline is fingerprinted loaded while post-reload snapshots …)

**Note from triage:** Strategies header renders 3 items before APY data lands and 4 after, so the baseline fingerprint is captured loaded while post-reload snapshots are captured unloaded.

**What to change.**

1. Replace the 25 XPath/text locator(s) on the failing path with test ids — _small_
   The selector no longer matches the DOM; the product itself may be fine.
   ⚠️ Any element without a stable attribute needs a data-testid from FE — raise that request today (QE-935 action 3).

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

- `brittle-locator`

</details>

**Record the decision**

```bash
node tools/bin/script-rca.js --record --test "Verify the navigation header stays identical across repeated reloads" --channel web-prod \
  --cause <brittle-locator> --action <fix|quarantine|rewrite|request-testid|wont-fix> --detail "..." --owner me
```

> Reminder: a `SCRIPT` failure on a smoke suite breaks the QE-935 100% accuracy goal, so it is either fixed today or quarantined with a ticket.

## 3. Verify Trade-Indicators data for all instruments is rendered as expected

**Area:** E2e Tests · **Where:** the testnet smoke run

**How it fails.** It fails occasionally — 25% of the last 4 runs. It only ever fails on chrome.

**Most likely cause.** Cause outside the usual list. Needs a written explanation from whoever investigated.

**Already decided:** Fix the test now — the cause is small and local. (The test walks every instrument across two parallel browsers, which exceeds the testnet API rate limit; KORU-USDT returns error 1015 and the …)

⚠️ **This was already "fixed" once and came back** — 4 Aug, "fix: Verify trading chart candle-sticks are rendered as expected (#1280)". Whatever was changed then did not address the real cause, so patching it a second time is unlikely to hold.

**Note from triage:** The all-instrument sweep ran 345s and was still going when the regression job hit its time budget; it is the test that blew the run, not a victim of it.

**What to change.**

1. Rewrite rather than patch — _—_
   This test was already "fixed" in 82fd6b91 and came back. The earlier root cause was not the real one.
2. Rewrite the locators in `ui_tests/pages/perpetualpage.ts` (123 XPath expressions) — _large — a page-object rewrite, not a one-line fix_
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
| `ui_tests/pages/perpetualpage.ts` | 172 | xpath-locator, shared-mutable-state, conditional-assert, arbitrary-timeout, text-locator, empty-catch | imported, relevance unclear |
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

- `f8475044` 2026-08-18 Pham The Viet — QR-969  Fix trade-indicators hang on numeric tickers and reduce browser runs (#1351)
- `84fdabe6` 2026-08-12 Pham The Viet — fix: Verify a new Sub-Account can be created (#1318)
- `8d657d1e` 2026-08-11 Pham The Viet — fix: Verify every page displays the selected language correctly (#1313)
- `c6394745` 2026-08-07 Pham The Viet — Disable ETH minting tests on web (#1296)
- `82fd6b91` 2026-08-04 Pham The Viet — fix: Verify trading chart candle-sticks are rendered as expected (#1280)

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

**How it fails.** It passes some runs and fails others with nothing changing in between (33.3% of the last 3 runs failed). It only ever fails on chrome.

**Most likely cause.** The test finds elements by their position or styling instead of a stable name. Any change to the page layout or CSS moves the target, so the test stops finding the button it needs.

**Already decided:** Fix the test now — the cause is small and local. (The receiveValue locator matched the wrong element, so the test read an incorrect Receive amount and the rejection assertion failed.)

**Note from triage:** The receiveValue locator matched the wrong element so the test read an incorrect Receive amount; locator corrected.

**What to change.**

1. Rewrite the locators in `ui_tests/pages/transferpage.ts` (61 XPath expressions) — _large — a page-object rewrite, not a one-line fix_
   Patching one selector here buys a few days; the whole file breaks on the next DOM change.
   ⚠️ Any element without a stable attribute needs a data-testid from FE — raise that request today (QE-935 action 3).
2. Find the unsynchronised step and wait on its completion signal (response, spinner gone, value settled) — _small to medium_
   The failure is intermittent, which is the signature of a timing gap rather than a broken assertion.

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

- `race-condition`
- `brittle-locator`

</details>

**Record the decision**

```bash
node tools/bin/script-rca.js --record --test "Verify deposit progress is rejected when user cancels wallet connection" --channel web-testnet \
  --cause <race-condition> --action <fix|quarantine|rewrite|request-testid|wont-fix> --detail "..." --owner me
```

> Reminder: a `SCRIPT` failure on a smoke suite breaks the QE-935 100% accuracy goal, so it is either fixed today or quarantined with a ticket.

## 5. Verify long position: in-profit SL trigger price must be between entry and mark prices

**Area:** Place Orders · **Where:** the testnet regression run

**How it fails.** It passes some runs and fails others with nothing changing in between (66.7% of the last 3 runs failed). It only ever fails on chrome.

**Most likely cause.** The test acts before the page has finished updating. Sometimes the page is ready in time and sometimes it is not, which is why it passes and fails at random.

**Note from triage:** Dies in TradingFlow.cleanupPosition -> clickIconInTable, whose XPath addresses the Positions table by hard-coded column index (div[12], div[10]), so the Close/icon button is never  …

**What to change.**

1. Replace the 4 XPath/text locator(s) on the failing path with test ids — _small_
   The selector no longer matches the DOM; the product itself may be fine.
   ⚠️ Any element without a stable attribute needs a data-testid from FE — raise that request today (QE-935 action 3).
2. Find the unsynchronised step and wait on its completion signal (response, spinner gone, value settled) — _small to medium_
   The failure is intermittent, which is the signature of a timing gap rather than a broken assertion.

<details><summary>The code, the evidence, and the exact edits</summary>

### Source

`ui_tests/tests/placeOrders/tpslTriggerPriceRangeValidation.spec.ts:49` (exact match, file has 138 lines)

Run log for the latest failure:
```bash
gh run view 32163926749 --log-failed -R gravity-technologies/qa-automation | head -120
```

### Anti-patterns near the test (0 hit(s) in this file)

No static anti-pattern found. That points away from the test code itself — check the run log, the fixture/page-object it calls, and whether the product actually changed.

### Anti-patterns in the page objects / helpers this spec imports

| File | Hits | Kinds | On this test's path? |
|---|---|---|---|
| `ui_tests/helpers/utilities.ts` | 15 | shared-mutable-state, conditional-assert, xpath-locator | imported, relevance unclear |
| `ui_tests/fixtures/fixtures.ts` | 10 | conditional-assert, arbitrary-timeout | imported, relevance unclear |
| `ui_tests/pages/flow/tradingFlow.ts` | 1 | xpath-locator | imported, relevance unclear |
| `ui_tests/pages/flow/authenFlow.ts` | 1 | empty-catch | imported, relevance unclear |

**Assertion behind a condition** — `ui_tests/helpers/utilities.ts:98`

```ts
   96   
   97   export function deleteDirectory(directory: string) {
   98 >   if (!fs.existsSync(directory)) {
   99       fs.rm(
  100         directory,
```

- A test that skips its own assertion when the element is absent passes green while verifying nothing.
- Fix (shape is clear, target needs your judgement):

```diff
- if (!fs.existsSync(directory)) {
+ // assert the expected state instead of branching on it:
+ await expect(<locator>).toBeVisible();
+ // if both branches are genuinely valid, split this into two tests
```

  When the element is missing this branch is skipped and the test goes green while verifying nothing.

**Assertion behind a condition** — `ui_tests/helpers/utilities.ts:139`

```ts
  137   
  138   export function createDirectory(directoryPath: string) {
  139 >   if (!fs.existsSync(directoryPath)) {
  140       // Check if the directory exists
  141       if (!fs.existsSync(directoryPath)) {
```

- A test that skips its own assertion when the element is absent passes green while verifying nothing.
- Fix (shape is clear, target needs your judgement):

```diff
- if (!fs.existsSync(directoryPath)) {
+ // assert the expected state instead of branching on it:
+ await expect(<locator>).toBeVisible();
+ // if both branches are genuinely valid, split this into two tests
```

  When the element is missing this branch is skipped and the test goes green while verifying nothing.

### File history (30 days)

- `8d657d1e` 2026-08-11 Pham The Viet — fix: Verify every page displays the selected language correctly (#1313)
- `76d2f6c7` 2026-08-03 Pham The Viet — update: titles of test cases (#1275)
- `2c4e9c29` 2026-08-03 Pham The Viet — Add test step blocks to ui tests specs (#1269)
- `b7829888` 2026-07-31 Pham The Viet — fix: Wallet shows correct balance USDT after successful withdrawal (#1263)

### Likely cause

- `race-condition`
- `brittle-locator`

</details>

**Record the decision**

```bash
node tools/bin/script-rca.js --record --test "Verify long position: in-profit SL trigger price must be between entry and mark prices" --channel web-testnet \
  --cause <race-condition> --action <fix|quarantine|rewrite|request-testid|wont-fix> --detail "..." --owner me
```

> Reminder: a `SCRIPT` failure on a smoke suite breaks the QE-935 100% accuracy goal, so it is either fixed today or quarantined with a ticket.

## 6. Verify Trade-Indicators data for all instruments is rendered as expected

**Area:** E2e Tests · **Where:** the testnet regression run

**How it fails.** Only 1 run has been recorded for this test so far, which is not enough to tell a real pattern from bad luck.

**Most likely cause.** Too early to say. Let it run a few more times, or read the log from the one failure we have.

⚠️ **This was already "fixed" once and came back** — 4 Aug, "fix: Verify trading chart candle-sticks are rendered as expected (#1280)". Whatever was changed then did not address the real cause, so patching it a second time is unlikely to hold.

**Note from triage:** The all-instrument sweep ran 345s and was still going when the regression job hit its time budget; it is the test that blew the run, not a victim of it.

**What to change.**

1. Rewrite rather than patch — _—_
   This test was already "fixed" in 82fd6b91 and came back. The earlier root cause was not the real one.
2. Rewrite the locators in `ui_tests/pages/perpetualpage.ts` (123 XPath expressions) — _large — a page-object rewrite, not a one-line fix_
   Patching one selector here buys a few days; the whole file breaks on the next DOM change.
   ⚠️ Any element without a stable attribute needs a data-testid from FE — raise that request today (QE-935 action 3).

<details><summary>The code, the evidence, and the exact edits</summary>

### Source

`ui_tests/tests/e2e_tests.spec.ts:59` (exact match, file has 802 lines)

Run log for the latest failure:
```bash
gh run view 32163926749 --log-failed -R gravity-technologies/qa-automation | head -120
```

### Anti-patterns near the test (0 hit(s) in this file)

No static anti-pattern found. That points away from the test code itself — check the run log, the fixture/page-object it calls, and whether the product actually changed.

### Anti-patterns in the page objects / helpers this spec imports

| File | Hits | Kinds | On this test's path? |
|---|---|---|---|
| `ui_tests/pages/perpetualpage.ts` | 172 | xpath-locator, shared-mutable-state, conditional-assert, arbitrary-timeout, text-locator, empty-catch | imported, relevance unclear |
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

- `f8475044` 2026-08-18 Pham The Viet — QR-969  Fix trade-indicators hang on numeric tickers and reduce browser runs (#1351)
- `84fdabe6` 2026-08-12 Pham The Viet — fix: Verify a new Sub-Account can be created (#1318)
- `8d657d1e` 2026-08-11 Pham The Viet — fix: Verify every page displays the selected language correctly (#1313)
- `c6394745` 2026-08-07 Pham The Viet — Disable ETH minting tests on web (#1296)
- `82fd6b91` 2026-08-04 Pham The Viet — fix: Verify trading chart candle-sticks are rendered as expected (#1280)

### Likely cause

- `brittle-locator`

</details>

**Record the decision**

```bash
node tools/bin/script-rca.js --record --test "Verify Trade-Indicators data for all instruments is rendered as expected" --channel web-testnet \
  --cause <brittle-locator> --action <fix|quarantine|rewrite|request-testid|wont-fix> --detail "..." --owner me
```

> Reminder: a `SCRIPT` failure on a smoke suite breaks the QE-935 100% accuracy goal, so it is either fixed today or quarantined with a ticket.

## 7. Verify all records under the Recent Trades tab are populated as expected

**Area:** E2e Tests · **Where:** the testnet regression run

**How it fails.** Only 1 run has been recorded for this test so far, which is not enough to tell a real pattern from bad luck.

**Most likely cause.** Too early to say. Let it run a few more times, or read the log from the one failure we have.

**Note from triage:** Collateral of the job timeout: the Trade-Indicators instrument sweep ran 345s and the regression job was cut off, so these tests were reported red without ever completing on their  …

**What to change.**

1. Rewrite the locators in `ui_tests/pages/perpetualpage.ts` (123 XPath expressions) — _large — a page-object rewrite, not a one-line fix_
   Patching one selector here buys a few days; the whole file breaks on the next DOM change.
   ⚠️ Any element without a stable attribute needs a data-testid from FE — raise that request today (QE-935 action 3).

<details><summary>The code, the evidence, and the exact edits</summary>

### Source

`ui_tests/tests/e2e_tests.spec.ts:139` (exact match, file has 802 lines)

Run log for the latest failure:
```bash
gh run view 32163926749 --log-failed -R gravity-technologies/qa-automation | head -120
```

### Anti-patterns near the test (0 hit(s) in this file)

No static anti-pattern found. That points away from the test code itself — check the run log, the fixture/page-object it calls, and whether the product actually changed.

### Anti-patterns in the page objects / helpers this spec imports

| File | Hits | Kinds | On this test's path? |
|---|---|---|---|
| `ui_tests/pages/perpetualpage.ts` | 172 | xpath-locator, shared-mutable-state, conditional-assert, arbitrary-timeout, text-locator, empty-catch | imported, relevance unclear |
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

- `f8475044` 2026-08-18 Pham The Viet — QR-969  Fix trade-indicators hang on numeric tickers and reduce browser runs (#1351)
- `84fdabe6` 2026-08-12 Pham The Viet — fix: Verify a new Sub-Account can be created (#1318)
- `8d657d1e` 2026-08-11 Pham The Viet — fix: Verify every page displays the selected language correctly (#1313)
- `c6394745` 2026-08-07 Pham The Viet — Disable ETH minting tests on web (#1296)
- `82fd6b91` 2026-08-04 Pham The Viet — fix: Verify trading chart candle-sticks are rendered as expected (#1280)

### Likely cause

- `brittle-locator`

</details>

**Record the decision**

```bash
node tools/bin/script-rca.js --record --test "Verify all records under the Recent Trades tab are populated as expected" --channel web-testnet \
  --cause <brittle-locator> --action <fix|quarantine|rewrite|request-testid|wont-fix> --detail "..." --owner me
```

> Reminder: a `SCRIPT` failure on a smoke suite breaks the QE-935 100% accuracy goal, so it is either fixed today or quarantined with a ticket.

## 8. Verify Order-Book data is displayed as expected

**Area:** E2e Tests · **Where:** the testnet regression run

**How it fails.** Only 1 run has been recorded for this test so far, which is not enough to tell a real pattern from bad luck.

**Most likely cause.** Too early to say. Let it run a few more times, or read the log from the one failure we have.

⚠️ **This was already "fixed" once and came back** — 4 Aug, "fix: Verify trading chart candle-sticks are rendered as expected (#1280)". Whatever was changed then did not address the real cause, so patching it a second time is unlikely to hold.

**Note from triage:** Collateral of the job timeout: the Trade-Indicators instrument sweep ran 345s and the regression job was cut off, so these tests were reported red without ever completing on their  …

**What to change.**

1. Rewrite rather than patch — _—_
   This test was already "fixed" in 82fd6b91 and came back. The earlier root cause was not the real one.
2. Rewrite the locators in `ui_tests/pages/perpetualpage.ts` (123 XPath expressions) — _large — a page-object rewrite, not a one-line fix_
   Patching one selector here buys a few days; the whole file breaks on the next DOM change.
   ⚠️ Any element without a stable attribute needs a data-testid from FE — raise that request today (QE-935 action 3).

<details><summary>The code, the evidence, and the exact edits</summary>

### Source

`ui_tests/tests/e2e_tests.spec.ts:163` (exact match, file has 802 lines)

Run log for the latest failure:
```bash
gh run view 32163926749 --log-failed -R gravity-technologies/qa-automation | head -120
```

### Anti-patterns near the test (0 hit(s) in this file)

No static anti-pattern found. That points away from the test code itself — check the run log, the fixture/page-object it calls, and whether the product actually changed.

### Anti-patterns in the page objects / helpers this spec imports

| File | Hits | Kinds | On this test's path? |
|---|---|---|---|
| `ui_tests/pages/perpetualpage.ts` | 172 | xpath-locator, shared-mutable-state, conditional-assert, arbitrary-timeout, text-locator, empty-catch | imported, relevance unclear |
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

- `f8475044` 2026-08-18 Pham The Viet — QR-969  Fix trade-indicators hang on numeric tickers and reduce browser runs (#1351)
- `84fdabe6` 2026-08-12 Pham The Viet — fix: Verify a new Sub-Account can be created (#1318)
- `8d657d1e` 2026-08-11 Pham The Viet — fix: Verify every page displays the selected language correctly (#1313)
- `c6394745` 2026-08-07 Pham The Viet — Disable ETH minting tests on web (#1296)
- `82fd6b91` 2026-08-04 Pham The Viet — fix: Verify trading chart candle-sticks are rendered as expected (#1280)

### Likely cause

- `brittle-locator`

</details>

**Record the decision**

```bash
node tools/bin/script-rca.js --record --test "Verify Order-Book data is displayed as expected" --channel web-testnet \
  --cause <brittle-locator> --action <fix|quarantine|rewrite|request-testid|wont-fix> --detail "..." --owner me
```

> Reminder: a `SCRIPT` failure on a smoke suite breaks the QE-935 100% accuracy goal, so it is either fixed today or quarantined with a ticket.

## 9. Verify trading chart candle-sticks are rendered as expected

**Area:** E2e Tests · **Where:** the testnet regression run

**How it fails.** Only 1 run has been recorded for this test so far, which is not enough to tell a real pattern from bad luck.

**Most likely cause.** Too early to say. Let it run a few more times, or read the log from the one failure we have.

⚠️ **This was already "fixed" once and came back** — 4 Aug, "fix: Verify trading chart candle-sticks are rendered as expected (#1280)". Whatever was changed then did not address the real cause, so patching it a second time is unlikely to hold.

**Note from triage:** Collateral of the job timeout: the Trade-Indicators instrument sweep ran 345s and the regression job was cut off, so these tests were reported red without ever completing on their  …

**What to change.**

1. Rewrite rather than patch — _—_
   This test was already "fixed" in 82fd6b91 and came back. The earlier root cause was not the real one.
2. Replace the 221 XPath/text locator(s) on the failing path with test ids — _small_
   The selector no longer matches the DOM; the product itself may be fine.
   ⚠️ Any element without a stable attribute needs a data-testid from FE — raise that request today (QE-935 action 3).

<details><summary>The code, the evidence, and the exact edits</summary>

### Source

`ui_tests/tests/e2e_tests.spec.ts:189` (exact match, file has 802 lines)

Run log for the latest failure:
```bash
gh run view 32163926749 --log-failed -R gravity-technologies/qa-automation | head -120
```

### Anti-patterns near the test (0 hit(s) in this file)

No static anti-pattern found. That points away from the test code itself — check the run log, the fixture/page-object it calls, and whether the product actually changed.

### Anti-patterns in the page objects / helpers this spec imports

| File | Hits | Kinds | On this test's path? |
|---|---|---|---|
| `ui_tests/pages/flow/tradingFlow.ts` | 1 | xpath-locator | likely — the filename matches the test |
| `ui_tests/pages/perpetualpage.ts` | 172 | xpath-locator, shared-mutable-state, conditional-assert, arbitrary-timeout, text-locator, empty-catch | imported, relevance unclear |
| `ui_tests/pages/transferpage.ts` | 81 | xpath-locator, hardcoded-account, conditional-assert | imported, relevance unclear |
| `ui_tests/pages/accountpage.ts` | 54 | xpath-locator, conditional-assert, empty-catch, arbitrary-timeout | imported, relevance unclear |
| `ui_tests/fixtures/fixtures.ts` | 10 | conditional-assert, arbitrary-timeout | imported, relevance unclear |
| `ui_tests/pages/homepage.ts` | 3 | xpath-locator, conditional-assert | imported, relevance unclear |

**XPath locator** — `ui_tests/pages/flow/tradingFlow.ts:49`

```ts
   47     precision: number;
   48   }
   49 > const textContains = (text: string) => `//*[contains(text(),'${text}')]`;
   50   
   51   export default class TradingFlow {
```

- XPath chains break on any DOM restructure, which is exactly the kind of failure that gets misread as a product bug.
- Fix (shape is clear, target needs your judgement):

```diff
- const textContains = (text: string) => `//*[contains(text(),'${text}')]`;
+ const textContains = "<stable-id>";
+ // call site:  page.getByTestId(textContains)
```

  The XPath encodes DOM structure, so any restructure breaks it. Ask FE for a stable attribute.
  ⚠️ Needs FE/mobile to add `a data-testid on this element` — raise it today, quarantine meanwhile.

### File history (30 days)

- `f8475044` 2026-08-18 Pham The Viet — QR-969  Fix trade-indicators hang on numeric tickers and reduce browser runs (#1351)
- `84fdabe6` 2026-08-12 Pham The Viet — fix: Verify a new Sub-Account can be created (#1318)
- `8d657d1e` 2026-08-11 Pham The Viet — fix: Verify every page displays the selected language correctly (#1313)
- `c6394745` 2026-08-07 Pham The Viet — Disable ETH minting tests on web (#1296)
- `82fd6b91` 2026-08-04 Pham The Viet — fix: Verify trading chart candle-sticks are rendered as expected (#1280)

### Likely cause

- `brittle-locator`

</details>

**Record the decision**

```bash
node tools/bin/script-rca.js --record --test "Verify trading chart candle-sticks are rendered as expected" --channel web-testnet \
  --cause <brittle-locator> --action <fix|quarantine|rewrite|request-testid|wont-fix> --detail "..." --owner me
```

> Reminder: a `SCRIPT` failure on a smoke suite breaks the QE-935 100% accuracy goal, so it is either fixed today or quarantined with a ticket.

## 10. Verify Order-Book is not crossed (BEST_BID lower than BEST_ASK)

**Area:** E2e Tests · **Where:** the testnet regression run

**How it fails.** Only 1 run has been recorded for this test so far, which is not enough to tell a real pattern from bad luck.

**Most likely cause.** Too early to say. Let it run a few more times, or read the log from the one failure we have.

**Note from triage:** Collateral of the job timeout: the Trade-Indicators instrument sweep ran 345s and the regression job was cut off, so these tests were reported red without ever completing on their  …

**What to change.**

1. Rewrite the locators in `ui_tests/pages/perpetualpage.ts` (123 XPath expressions) — _large — a page-object rewrite, not a one-line fix_
   Patching one selector here buys a few days; the whole file breaks on the next DOM change.
   ⚠️ Any element without a stable attribute needs a data-testid from FE — raise that request today (QE-935 action 3).

<details><summary>The code, the evidence, and the exact edits</summary>

### Source

`ui_tests/tests/e2e_tests.spec.ts:205` (exact match, file has 802 lines)

Run log for the latest failure:
```bash
gh run view 32163926749 --log-failed -R gravity-technologies/qa-automation | head -120
```

### Anti-patterns near the test (0 hit(s) in this file)

No static anti-pattern found. That points away from the test code itself — check the run log, the fixture/page-object it calls, and whether the product actually changed.

### Anti-patterns in the page objects / helpers this spec imports

| File | Hits | Kinds | On this test's path? |
|---|---|---|---|
| `ui_tests/pages/perpetualpage.ts` | 172 | xpath-locator, shared-mutable-state, conditional-assert, arbitrary-timeout, text-locator, empty-catch | imported, relevance unclear |
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

- `f8475044` 2026-08-18 Pham The Viet — QR-969  Fix trade-indicators hang on numeric tickers and reduce browser runs (#1351)
- `84fdabe6` 2026-08-12 Pham The Viet — fix: Verify a new Sub-Account can be created (#1318)
- `8d657d1e` 2026-08-11 Pham The Viet — fix: Verify every page displays the selected language correctly (#1313)
- `c6394745` 2026-08-07 Pham The Viet — Disable ETH minting tests on web (#1296)
- `82fd6b91` 2026-08-04 Pham The Viet — fix: Verify trading chart candle-sticks are rendered as expected (#1280)

### Likely cause

- `brittle-locator`

</details>

**Record the decision**

```bash
node tools/bin/script-rca.js --record --test "Verify Order-Book is not crossed (BEST_BID lower than BEST_ASK)" --channel web-testnet \
  --cause <brittle-locator> --action <fix|quarantine|rewrite|request-testid|wont-fix> --detail "..." --owner me
```

> Reminder: a `SCRIPT` failure on a smoke suite breaks the QE-935 100% accuracy goal, so it is either fixed today or quarantined with a ticket.

## 11. Verify editing a TP target trigger price persists after Confirm

**Area:** Place Orders · **Where:** the testnet regression run

**How it fails.** Only 1 run has been recorded for this test so far, which is not enough to tell a real pattern from bad luck.

**Most likely cause.** Too early to say. Let it run a few more times, or read the log from the one failure we have.

**Note from triage:** splitTPSLPage.ts:305 asserts the edited trigger price persisted and gets false — the value read back after Confirm does not match what was entered.

**What to change.**

1. Rewrite the locators in `ui_tests/pages/perpetualpage.ts` (123 XPath expressions) — _large — a page-object rewrite, not a one-line fix_
   Patching one selector here buys a few days; the whole file breaks on the next DOM change.
   ⚠️ Any element without a stable attribute needs a data-testid from FE — raise that request today (QE-935 action 3).

<details><summary>The code, the evidence, and the exact edits</summary>

### Source

`ui_tests/tests/placeOrders/splitTPSL.spec.ts:194` (exact match, file has 414 lines)

Run log for the latest failure:
```bash
gh run view 32163926749 --log-failed -R gravity-technologies/qa-automation | head -120
```

### Anti-patterns near the test (0 hit(s) in this file)

No static anti-pattern found. That points away from the test code itself — check the run log, the fixture/page-object it calls, and whether the product actually changed.

### Anti-patterns in the page objects / helpers this spec imports

| File | Hits | Kinds | On this test's path? |
|---|---|---|---|
| `ui_tests/pages/perpetualpage.ts` | 172 | xpath-locator, shared-mutable-state, conditional-assert, arbitrary-timeout, text-locator, empty-catch | imported, relevance unclear |
| `ui_tests/pages/splitTPSLPage.ts` | 29 | xpath-locator, conditional-assert, arbitrary-timeout | imported, relevance unclear |
| `ui_tests/helpers/utilities.ts` | 15 | shared-mutable-state, conditional-assert, xpath-locator | imported, relevance unclear |
| `ui_tests/fixtures/fixtures.ts` | 10 | conditional-assert, arbitrary-timeout | imported, relevance unclear |
| `ui_tests/pages/flow/authenFlow.ts` | 1 | empty-catch | imported, relevance unclear |
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

- `8d657d1e` 2026-08-11 Pham The Viet — fix: Verify every page displays the selected language correctly (#1313)
- `76d2f6c7` 2026-08-03 Pham The Viet — update: titles of test cases (#1275)
- `2c4e9c29` 2026-08-03 Pham The Viet — Add test step blocks to ui tests specs (#1269)
- `b7829888` 2026-07-31 Pham The Viet — fix: Wallet shows correct balance USDT after successful withdrawal (#1263)

### Likely cause

- `brittle-locator`

</details>

**Record the decision**

```bash
node tools/bin/script-rca.js --record --test "Verify editing a TP target trigger price persists after Confirm" --channel web-testnet \
  --cause <brittle-locator> --action <fix|quarantine|rewrite|request-testid|wont-fix> --detail "..." --owner me
```

> Reminder: a `SCRIPT` failure on a smoke suite breaks the QE-935 100% accuracy goal, so it is either fixed today or quarantined with a ticket.

## 12. Verify data resets when a row is deleted or the tab is switched

**Area:** Place Orders · **Where:** the testnet regression run

**How it fails.** Only 1 run has been recorded for this test so far, which is not enough to tell a real pattern from bad luck.

**Most likely cause.** Too early to say. Let it run a few more times, or read the log from the one failure we have.

**Note from triage:** splitTPSLPage.ts:305 asserts the edited trigger price persisted and gets false — the value read back after Confirm does not match what was entered.

**What to change.**

1. Rewrite the locators in `ui_tests/pages/perpetualpage.ts` (123 XPath expressions) — _large — a page-object rewrite, not a one-line fix_
   Patching one selector here buys a few days; the whole file breaks on the next DOM change.
   ⚠️ Any element without a stable attribute needs a data-testid from FE — raise that request today (QE-935 action 3).

<details><summary>The code, the evidence, and the exact edits</summary>

### Source

`ui_tests/tests/placeOrders/splitTPSL.spec.ts:386` (exact match, file has 414 lines)

Run log for the latest failure:
```bash
gh run view 32163926749 --log-failed -R gravity-technologies/qa-automation | head -120
```

### Anti-patterns near the test (0 hit(s) in this file)

No static anti-pattern found. That points away from the test code itself — check the run log, the fixture/page-object it calls, and whether the product actually changed.

### Anti-patterns in the page objects / helpers this spec imports

| File | Hits | Kinds | On this test's path? |
|---|---|---|---|
| `ui_tests/pages/perpetualpage.ts` | 172 | xpath-locator, shared-mutable-state, conditional-assert, arbitrary-timeout, text-locator, empty-catch | imported, relevance unclear |
| `ui_tests/pages/splitTPSLPage.ts` | 29 | xpath-locator, conditional-assert, arbitrary-timeout | imported, relevance unclear |
| `ui_tests/helpers/utilities.ts` | 15 | shared-mutable-state, conditional-assert, xpath-locator | imported, relevance unclear |
| `ui_tests/fixtures/fixtures.ts` | 10 | conditional-assert, arbitrary-timeout | imported, relevance unclear |
| `ui_tests/pages/flow/authenFlow.ts` | 1 | empty-catch | imported, relevance unclear |
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

- `8d657d1e` 2026-08-11 Pham The Viet — fix: Verify every page displays the selected language correctly (#1313)
- `76d2f6c7` 2026-08-03 Pham The Viet — update: titles of test cases (#1275)
- `2c4e9c29` 2026-08-03 Pham The Viet — Add test step blocks to ui tests specs (#1269)
- `b7829888` 2026-07-31 Pham The Viet — fix: Wallet shows correct balance USDT after successful withdrawal (#1263)

### Likely cause

- `brittle-locator`

</details>

**Record the decision**

```bash
node tools/bin/script-rca.js --record --test "Verify data resets when a row is deleted or the tab is switched" --channel web-testnet \
  --cause <brittle-locator> --action <fix|quarantine|rewrite|request-testid|wont-fix> --detail "..." --owner me
```

> Reminder: a `SCRIPT` failure on a smoke suite breaks the QE-935 100% accuracy goal, so it is either fixed today or quarantined with a ticket.

## 13. Verify Position TP/SL size matches the position when a trading login is active

**Area:** Place Orders · **Where:** the testnet regression run

**How it fails.** Only 1 run has been recorded for this test so far, which is not enough to tell a real pattern from bad luck.

**Most likely cause.** Too early to say. Let it run a few more times, or read the log from the one failure we have.

**Note from triage:** Dies in TradingFlow.cleanupPosition -> clickIconInTable, whose XPath addresses the Positions table by hard-coded column index (div[12], div[10]), so the Close/icon button is never  …

**What to change.**

1. Replace the 127 XPath/text locator(s) on the failing path with test ids — _small_
   The selector no longer matches the DOM; the product itself may be fine.
   ⚠️ Any element without a stable attribute needs a data-testid from FE — raise that request today (QE-935 action 3).

<details><summary>The code, the evidence, and the exact edits</summary>

### Source

`ui_tests/tests/placeOrders/tpslSendReasonableSize.spec.ts:37` (exact match, file has 126 lines)

Run log for the latest failure:
```bash
gh run view 32163926749 --log-failed -R gravity-technologies/qa-automation | head -120
```

### Anti-patterns near the test (0 hit(s) in this file)

No static anti-pattern found. That points away from the test code itself — check the run log, the fixture/page-object it calls, and whether the product actually changed.

### Anti-patterns in the page objects / helpers this spec imports

| File | Hits | Kinds | On this test's path? |
|---|---|---|---|
| `ui_tests/pages/flow/tradingFlow.ts` | 1 | xpath-locator | likely — the filename matches the test |
| `ui_tests/pages/perpetualpage.ts` | 172 | xpath-locator, shared-mutable-state, conditional-assert, arbitrary-timeout, text-locator, empty-catch | imported, relevance unclear |
| `ui_tests/helpers/utilities.ts` | 15 | shared-mutable-state, conditional-assert, xpath-locator | imported, relevance unclear |
| `ui_tests/fixtures/fixtures.ts` | 10 | conditional-assert, arbitrary-timeout | imported, relevance unclear |
| `ui_tests/pages/flow/authenFlow.ts` | 1 | empty-catch | imported, relevance unclear |

**XPath locator** — `ui_tests/pages/flow/tradingFlow.ts:49`

```ts
   47     precision: number;
   48   }
   49 > const textContains = (text: string) => `//*[contains(text(),'${text}')]`;
   50   
   51   export default class TradingFlow {
```

- XPath chains break on any DOM restructure, which is exactly the kind of failure that gets misread as a product bug.
- Fix (shape is clear, target needs your judgement):

```diff
- const textContains = (text: string) => `//*[contains(text(),'${text}')]`;
+ const textContains = "<stable-id>";
+ // call site:  page.getByTestId(textContains)
```

  The XPath encodes DOM structure, so any restructure breaks it. Ask FE for a stable attribute.
  ⚠️ Needs FE/mobile to add `a data-testid on this element` — raise it today, quarantine meanwhile.

### File history (30 days)

- `8d657d1e` 2026-08-11 Pham The Viet — fix: Verify every page displays the selected language correctly (#1313)
- `76d2f6c7` 2026-08-03 Pham The Viet — update: titles of test cases (#1275)
- `2c4e9c29` 2026-08-03 Pham The Viet — Add test step blocks to ui tests specs (#1269)
- `b7829888` 2026-07-31 Pham The Viet — fix: Wallet shows correct balance USDT after successful withdrawal (#1263)

### Likely cause

- `brittle-locator`

</details>

**Record the decision**

```bash
node tools/bin/script-rca.js --record --test "Verify Position TP/SL size matches the position when a trading login is active" --channel web-testnet \
  --cause <brittle-locator> --action <fix|quarantine|rewrite|request-testid|wont-fix> --detail "..." --owner me
```

> Reminder: a `SCRIPT` failure on a smoke suite breaks the QE-935 100% accuracy goal, so it is either fixed today or quarantined with a ticket.

## 14. Verify short position: TP trigger price must be less than mark price

**Area:** Place Orders · **Where:** the testnet regression run

**How it fails.** Only 1 run has been recorded for this test so far, which is not enough to tell a real pattern from bad luck.

**Most likely cause.** Too early to say. Let it run a few more times, or read the log from the one failure we have.

**Note from triage:** Dies in TradingFlow.cleanupPosition -> clickIconInTable, whose XPath addresses the Positions table by hard-coded column index (div[12], div[10]), so the Close/icon button is never  …

**What to change.**

1. Replace the 4 XPath/text locator(s) on the failing path with test ids — _small_
   The selector no longer matches the DOM; the product itself may be fine.
   ⚠️ Any element without a stable attribute needs a data-testid from FE — raise that request today (QE-935 action 3).

<details><summary>The code, the evidence, and the exact edits</summary>

### Source

`ui_tests/tests/placeOrders/tpslTriggerPriceRangeValidation.spec.ts:62` (exact match, file has 138 lines)

Run log for the latest failure:
```bash
gh run view 32163926749 --log-failed -R gravity-technologies/qa-automation | head -120
```

### Anti-patterns near the test (0 hit(s) in this file)

No static anti-pattern found. That points away from the test code itself — check the run log, the fixture/page-object it calls, and whether the product actually changed.

### Anti-patterns in the page objects / helpers this spec imports

| File | Hits | Kinds | On this test's path? |
|---|---|---|---|
| `ui_tests/helpers/utilities.ts` | 15 | shared-mutable-state, conditional-assert, xpath-locator | imported, relevance unclear |
| `ui_tests/fixtures/fixtures.ts` | 10 | conditional-assert, arbitrary-timeout | imported, relevance unclear |
| `ui_tests/pages/flow/tradingFlow.ts` | 1 | xpath-locator | imported, relevance unclear |
| `ui_tests/pages/flow/authenFlow.ts` | 1 | empty-catch | imported, relevance unclear |

**Assertion behind a condition** — `ui_tests/helpers/utilities.ts:98`

```ts
   96   
   97   export function deleteDirectory(directory: string) {
   98 >   if (!fs.existsSync(directory)) {
   99       fs.rm(
  100         directory,
```

- A test that skips its own assertion when the element is absent passes green while verifying nothing.
- Fix (shape is clear, target needs your judgement):

```diff
- if (!fs.existsSync(directory)) {
+ // assert the expected state instead of branching on it:
+ await expect(<locator>).toBeVisible();
+ // if both branches are genuinely valid, split this into two tests
```

  When the element is missing this branch is skipped and the test goes green while verifying nothing.

**Assertion behind a condition** — `ui_tests/helpers/utilities.ts:139`

```ts
  137   
  138   export function createDirectory(directoryPath: string) {
  139 >   if (!fs.existsSync(directoryPath)) {
  140       // Check if the directory exists
  141       if (!fs.existsSync(directoryPath)) {
```

- A test that skips its own assertion when the element is absent passes green while verifying nothing.
- Fix (shape is clear, target needs your judgement):

```diff
- if (!fs.existsSync(directoryPath)) {
+ // assert the expected state instead of branching on it:
+ await expect(<locator>).toBeVisible();
+ // if both branches are genuinely valid, split this into two tests
```

  When the element is missing this branch is skipped and the test goes green while verifying nothing.

### File history (30 days)

- `8d657d1e` 2026-08-11 Pham The Viet — fix: Verify every page displays the selected language correctly (#1313)
- `76d2f6c7` 2026-08-03 Pham The Viet — update: titles of test cases (#1275)
- `2c4e9c29` 2026-08-03 Pham The Viet — Add test step blocks to ui tests specs (#1269)
- `b7829888` 2026-07-31 Pham The Viet — fix: Wallet shows correct balance USDT after successful withdrawal (#1263)

### Likely cause

- `brittle-locator`

</details>

**Record the decision**

```bash
node tools/bin/script-rca.js --record --test "Verify short position: TP trigger price must be less than mark price" --channel web-testnet \
  --cause <brittle-locator> --action <fix|quarantine|rewrite|request-testid|wont-fix> --detail "..." --owner me
```

> Reminder: a `SCRIPT` failure on a smoke suite breaks the QE-935 100% accuracy goal, so it is either fixed today or quarantined with a ticket.

## 15. Verify short position: in-profit SL trigger price must be between mark and entry prices

**Area:** Place Orders · **Where:** the testnet regression run

**How it fails.** Only 1 run has been recorded for this test so far, which is not enough to tell a real pattern from bad luck.

**Most likely cause.** Too early to say. Let it run a few more times, or read the log from the one failure we have.

**Note from triage:** Dies in TradingFlow.cleanupPosition -> clickIconInTable, whose XPath addresses the Positions table by hard-coded column index (div[12], div[10]), so the Close/icon button is never  …

**What to change.**

1. Replace the 4 XPath/text locator(s) on the failing path with test ids — _small_
   The selector no longer matches the DOM; the product itself may be fine.
   ⚠️ Any element without a stable attribute needs a data-testid from FE — raise that request today (QE-935 action 3).

<details><summary>The code, the evidence, and the exact edits</summary>

### Source

`ui_tests/tests/placeOrders/tpslTriggerPriceRangeValidation.spec.ts:76` (exact match, file has 138 lines)

Run log for the latest failure:
```bash
gh run view 32163926749 --log-failed -R gravity-technologies/qa-automation | head -120
```

### Anti-patterns near the test (0 hit(s) in this file)

No static anti-pattern found. That points away from the test code itself — check the run log, the fixture/page-object it calls, and whether the product actually changed.

### Anti-patterns in the page objects / helpers this spec imports

| File | Hits | Kinds | On this test's path? |
|---|---|---|---|
| `ui_tests/helpers/utilities.ts` | 15 | shared-mutable-state, conditional-assert, xpath-locator | imported, relevance unclear |
| `ui_tests/fixtures/fixtures.ts` | 10 | conditional-assert, arbitrary-timeout | imported, relevance unclear |
| `ui_tests/pages/flow/tradingFlow.ts` | 1 | xpath-locator | imported, relevance unclear |
| `ui_tests/pages/flow/authenFlow.ts` | 1 | empty-catch | imported, relevance unclear |

**Assertion behind a condition** — `ui_tests/helpers/utilities.ts:98`

```ts
   96   
   97   export function deleteDirectory(directory: string) {
   98 >   if (!fs.existsSync(directory)) {
   99       fs.rm(
  100         directory,
```

- A test that skips its own assertion when the element is absent passes green while verifying nothing.
- Fix (shape is clear, target needs your judgement):

```diff
- if (!fs.existsSync(directory)) {
+ // assert the expected state instead of branching on it:
+ await expect(<locator>).toBeVisible();
+ // if both branches are genuinely valid, split this into two tests
```

  When the element is missing this branch is skipped and the test goes green while verifying nothing.

**Assertion behind a condition** — `ui_tests/helpers/utilities.ts:139`

```ts
  137   
  138   export function createDirectory(directoryPath: string) {
  139 >   if (!fs.existsSync(directoryPath)) {
  140       // Check if the directory exists
  141       if (!fs.existsSync(directoryPath)) {
```

- A test that skips its own assertion when the element is absent passes green while verifying nothing.
- Fix (shape is clear, target needs your judgement):

```diff
- if (!fs.existsSync(directoryPath)) {
+ // assert the expected state instead of branching on it:
+ await expect(<locator>).toBeVisible();
+ // if both branches are genuinely valid, split this into two tests
```

  When the element is missing this branch is skipped and the test goes green while verifying nothing.

### File history (30 days)

- `8d657d1e` 2026-08-11 Pham The Viet — fix: Verify every page displays the selected language correctly (#1313)
- `76d2f6c7` 2026-08-03 Pham The Viet — update: titles of test cases (#1275)
- `2c4e9c29` 2026-08-03 Pham The Viet — Add test step blocks to ui tests specs (#1269)
- `b7829888` 2026-07-31 Pham The Viet — fix: Wallet shows correct balance USDT after successful withdrawal (#1263)

### Likely cause

- `brittle-locator`

</details>

**Record the decision**

```bash
node tools/bin/script-rca.js --record --test "Verify short position: in-profit SL trigger price must be between mark and entry prices" --channel web-testnet \
  --cause <brittle-locator> --action <fix|quarantine|rewrite|request-testid|wont-fix> --detail "..." --owner me
```

> Reminder: a `SCRIPT` failure on a smoke suite breaks the QE-935 100% accuracy goal, so it is either fixed today or quarantined with a ticket.

## 16. Verify Split TP for Short position: trigger price must be less than mark price

**Area:** Place Orders · **Where:** the testnet regression run

**How it fails.** Only 1 run has been recorded for this test so far, which is not enough to tell a real pattern from bad luck.

**Most likely cause.** Too early to say. Let it run a few more times, or read the log from the one failure we have.

**Note from triage:** Dies in TradingFlow.cleanupPosition -> clickIconInTable, whose XPath addresses the Positions table by hard-coded column index (div[12], div[10]), so the Close/icon button is never  …

**What to change.**

1. Replace the 4 XPath/text locator(s) on the failing path with test ids — _small_
   The selector no longer matches the DOM; the product itself may be fine.
   ⚠️ Any element without a stable attribute needs a data-testid from FE — raise that request today (QE-935 action 3).

<details><summary>The code, the evidence, and the exact edits</summary>

### Source

`ui_tests/tests/placeOrders/tpslTriggerPriceRangeValidation.spec.ts:116` (exact match, file has 138 lines)

Run log for the latest failure:
```bash
gh run view 32163926749 --log-failed -R gravity-technologies/qa-automation | head -120
```

### Anti-patterns near the test (0 hit(s) in this file)

No static anti-pattern found. That points away from the test code itself — check the run log, the fixture/page-object it calls, and whether the product actually changed.

### Anti-patterns in the page objects / helpers this spec imports

| File | Hits | Kinds | On this test's path? |
|---|---|---|---|
| `ui_tests/helpers/utilities.ts` | 15 | shared-mutable-state, conditional-assert, xpath-locator | imported, relevance unclear |
| `ui_tests/fixtures/fixtures.ts` | 10 | conditional-assert, arbitrary-timeout | imported, relevance unclear |
| `ui_tests/pages/flow/tradingFlow.ts` | 1 | xpath-locator | imported, relevance unclear |
| `ui_tests/pages/flow/authenFlow.ts` | 1 | empty-catch | imported, relevance unclear |

**Assertion behind a condition** — `ui_tests/helpers/utilities.ts:98`

```ts
   96   
   97   export function deleteDirectory(directory: string) {
   98 >   if (!fs.existsSync(directory)) {
   99       fs.rm(
  100         directory,
```

- A test that skips its own assertion when the element is absent passes green while verifying nothing.
- Fix (shape is clear, target needs your judgement):

```diff
- if (!fs.existsSync(directory)) {
+ // assert the expected state instead of branching on it:
+ await expect(<locator>).toBeVisible();
+ // if both branches are genuinely valid, split this into two tests
```

  When the element is missing this branch is skipped and the test goes green while verifying nothing.

**Assertion behind a condition** — `ui_tests/helpers/utilities.ts:139`

```ts
  137   
  138   export function createDirectory(directoryPath: string) {
  139 >   if (!fs.existsSync(directoryPath)) {
  140       // Check if the directory exists
  141       if (!fs.existsSync(directoryPath)) {
```

- A test that skips its own assertion when the element is absent passes green while verifying nothing.
- Fix (shape is clear, target needs your judgement):

```diff
- if (!fs.existsSync(directoryPath)) {
+ // assert the expected state instead of branching on it:
+ await expect(<locator>).toBeVisible();
+ // if both branches are genuinely valid, split this into two tests
```

  When the element is missing this branch is skipped and the test goes green while verifying nothing.

### File history (30 days)

- `8d657d1e` 2026-08-11 Pham The Viet — fix: Verify every page displays the selected language correctly (#1313)
- `76d2f6c7` 2026-08-03 Pham The Viet — update: titles of test cases (#1275)
- `2c4e9c29` 2026-08-03 Pham The Viet — Add test step blocks to ui tests specs (#1269)
- `b7829888` 2026-07-31 Pham The Viet — fix: Wallet shows correct balance USDT after successful withdrawal (#1263)

### Likely cause

- `brittle-locator`

</details>

**Record the decision**

```bash
node tools/bin/script-rca.js --record --test "Verify Split TP for Short position: trigger price must be less than mark price" --channel web-testnet \
  --cause <brittle-locator> --action <fix|quarantine|rewrite|request-testid|wont-fix> --detail "..." --owner me
```

> Reminder: a `SCRIPT` failure on a smoke suite breaks the QE-935 100% accuracy goal, so it is either fixed today or quarantined with a ticket.

## 17. Verify SL trigger type can be selected at MAX slider on a Short position

**Area:** Place Orders · **Where:** the testnet regression run

**How it fails.** Only 1 run has been recorded for this test so far, which is not enough to tell a real pattern from bad luck.

**Most likely cause.** Too early to say. Let it run a few more times, or read the log from the one failure we have.

**Note from triage:** Dies in TradingFlow.cleanupPosition -> clickIconInTable, whose XPath addresses the Positions table by hard-coded column index (div[12], div[10]), so the Close/icon button is never  …

**What to change.**

1. Replace the 4 XPath/text locator(s) on the failing path with test ids — _small_
   The selector no longer matches the DOM; the product itself may be fine.
   ⚠️ Any element without a stable attribute needs a data-testid from FE — raise that request today (QE-935 action 3).

<details><summary>The code, the evidence, and the exact edits</summary>

### Source

`ui_tests/tests/placeOrders/tpslTriggerTypeAtMaxSlider.spec.ts:51` (exact match, file has 90 lines)

Run log for the latest failure:
```bash
gh run view 32163926749 --log-failed -R gravity-technologies/qa-automation | head -120
```

### Anti-patterns near the test (0 hit(s) in this file)

No static anti-pattern found. That points away from the test code itself — check the run log, the fixture/page-object it calls, and whether the product actually changed.

### Anti-patterns in the page objects / helpers this spec imports

| File | Hits | Kinds | On this test's path? |
|---|---|---|---|
| `ui_tests/helpers/utilities.ts` | 15 | shared-mutable-state, conditional-assert, xpath-locator | imported, relevance unclear |
| `ui_tests/fixtures/fixtures.ts` | 10 | conditional-assert, arbitrary-timeout | imported, relevance unclear |
| `ui_tests/pages/flow/tradingFlow.ts` | 1 | xpath-locator | imported, relevance unclear |
| `ui_tests/pages/flow/authenFlow.ts` | 1 | empty-catch | imported, relevance unclear |

**Assertion behind a condition** — `ui_tests/helpers/utilities.ts:98`

```ts
   96   
   97   export function deleteDirectory(directory: string) {
   98 >   if (!fs.existsSync(directory)) {
   99       fs.rm(
  100         directory,
```

- A test that skips its own assertion when the element is absent passes green while verifying nothing.
- Fix (shape is clear, target needs your judgement):

```diff
- if (!fs.existsSync(directory)) {
+ // assert the expected state instead of branching on it:
+ await expect(<locator>).toBeVisible();
+ // if both branches are genuinely valid, split this into two tests
```

  When the element is missing this branch is skipped and the test goes green while verifying nothing.

**Assertion behind a condition** — `ui_tests/helpers/utilities.ts:139`

```ts
  137   
  138   export function createDirectory(directoryPath: string) {
  139 >   if (!fs.existsSync(directoryPath)) {
  140       // Check if the directory exists
  141       if (!fs.existsSync(directoryPath)) {
```

- A test that skips its own assertion when the element is absent passes green while verifying nothing.
- Fix (shape is clear, target needs your judgement):

```diff
- if (!fs.existsSync(directoryPath)) {
+ // assert the expected state instead of branching on it:
+ await expect(<locator>).toBeVisible();
+ // if both branches are genuinely valid, split this into two tests
```

  When the element is missing this branch is skipped and the test goes green while verifying nothing.

### File history (30 days)

- `8d657d1e` 2026-08-11 Pham The Viet — fix: Verify every page displays the selected language correctly (#1313)
- `2c4e9c29` 2026-08-03 Pham The Viet — Add test step blocks to ui tests specs (#1269)
- `b7829888` 2026-07-31 Pham The Viet — fix: Wallet shows correct balance USDT after successful withdrawal (#1263)
- `d17c1c3c` 2026-07-22 Pham The Viet — QE-769: Implement for TP/SL trigger type selection after setting MAX slider  (#1207)

### Likely cause

- `brittle-locator`

</details>

**Record the decision**

```bash
node tools/bin/script-rca.js --record --test "Verify SL trigger type can be selected at MAX slider on a Short position" --channel web-testnet \
  --cause <brittle-locator> --action <fix|quarantine|rewrite|request-testid|wont-fix> --detail "..." --owner me
```

> Reminder: a `SCRIPT` failure on a smoke suite breaks the QE-935 100% accuracy goal, so it is either fixed today or quarantined with a ticket.

## 18. Verify open limit order can be cancelled successfully

**Area:** Spot · **Where:** the testnet regression run

**How it fails.** Only 1 run has been recorded for this test so far, which is not enough to tell a real pattern from bad luck.

**Most likely cause.** Too early to say. Let it run a few more times, or read the log from the one failure we have.

⚠️ **This was already "fixed" once and came back** — 12 Aug, "QE-900: Fix verify market sell order can be placed successfully  (#1315)". Whatever was changed then did not address the real cause, so patching it a second time is unlikely to hold.

**Note from triage:** The Order price input (//label[div='Order price']/input) never became visible within 30s, so the limit buy was never placed and there was nothing to cancel.

**What to change.**

1. Rewrite rather than patch — _—_
   This test was already "fixed" in b2363f61 and came back. The earlier root cause was not the real one.
2. Rewrite the locators in `ui_tests/pages/spotpage.ts` (11 XPath expressions) — _large — a page-object rewrite, not a one-line fix_
   Patching one selector here buys a few days; the whole file breaks on the next DOM change.
   ⚠️ Any element without a stable attribute needs a data-testid from FE — raise that request today (QE-935 action 3).
3. Move the module-level state into a fixture or beforeEach — _small_
   Right now the result depends on execution order and on whether an earlier test failed.

<details><summary>The code, the evidence, and the exact edits</summary>

### Source

`ui_tests/tests/spot/spotTrading.spec.ts:284` (exact match, file has 323 lines)

Run log for the latest failure:
```bash
gh run view 32163926749 --log-failed -R gravity-technologies/qa-automation | head -120
```

### Anti-patterns near the test (7 hit(s) in this file)

**Large inline timeout** — `ui_tests/tests/spot/spotTrading.spec.ts:211` (medium, 73 lines from the test)

```ts
  208           await spotPage.clickOpenOrdersTab();
  209           await expect
  210             .poll(async () => await spotPage.getRowCount(), {
  211 >             timeout: 10000,
  212               intervals: [500, 1000, 2000],
  213             })
  214             .toBeGreaterThan(0);
```

- Why it breaks: A big inline timeout usually papers over an unreliable wait rather than fixing it, and it slows every run down.
- Fix (mechanical rewrite — still verify it):

```diff
- timeout: 10000,
+ // remove the inline timeout and set the budget once:
+ // playwright.config.js →  expect: { timeout: 15_000 }
+ ,
```

  An inline timeout usually hides an unreliable wait. Fix the wait, and keep timeouts in one place.

**Large inline timeout** — `ui_tests/tests/spot/spotTrading.spec.ts:168` (medium, 116 lines from the test)

```ts
  165           logger.info(`quantitySell: ${quantitySell}`);
  166           await expect
  167             .poll(readEthAvailableToSell, {
  168 >             timeout: 10000,
  169               intervals: [500, 1000, 2000],
  170             })
  171             .toBeLessThan(ethBeforeSell);
```

- Why it breaks: A big inline timeout usually papers over an unreliable wait rather than fixing it, and it slows every run down.
- Fix (mechanical rewrite — still verify it):

```diff
- timeout: 10000,
+ // remove the inline timeout and set the budget once:
+ // playwright.config.js →  expect: { timeout: 15_000 }
+ ,
```

  An inline timeout usually hides an unreliable wait. Fix the wait, and keep timeouts in one place.

**Large inline timeout** — `ui_tests/tests/spot/spotTrading.spec.ts:157` (medium, 127 lines from the test)

```ts
  154           await spotPage.clickTradeHistoryTab();
  155           await expect
  156             .poll(async () => await spotPage.getRowCount(), {
  157 >             timeout: 10000,
  158               intervals: [500, 1000, 2000],
  159             })
  160             .toBeGreaterThan(0);
```

- Why it breaks: A big inline timeout usually papers over an unreliable wait rather than fixing it, and it slows every run down.
- Fix (mechanical rewrite — still verify it):

```diff
- timeout: 10000,
+ // remove the inline timeout and set the budget once:
+ // playwright.config.js →  expect: { timeout: 15_000 }
+ ,
```

  An inline timeout usually hides an unreliable wait. Fix the wait, and keep timeouts in one place.

**Large inline timeout** — `ui_tests/tests/spot/spotTrading.spec.ts:138` (medium, 146 lines from the test)

```ts
  135             await spotPage.selectSide("Sell");
  136             await expect
  137               .poll(readEthAvailableToSell, {
  138 >               timeout: 10000,
  139                 intervals: [500, 1000, 2000],
  140               })
  141               .toBeGreaterThanOrEqual(0.01);
```

- Why it breaks: A big inline timeout usually papers over an unreliable wait rather than fixing it, and it slows every run down.
- Fix (mechanical rewrite — still verify it):

```diff
- timeout: 10000,
+ // remove the inline timeout and set the budget once:
+ // playwright.config.js →  expect: { timeout: 15_000 }
+ ,
```

  An inline timeout usually hides an unreliable wait. Fix the wait, and keep timeouts in one place.

**Large inline timeout** — `ui_tests/tests/spot/spotTrading.spec.ts:102` (medium, 182 lines from the test)

```ts
   99           // refreshes; wait for the balance to drop before asserting on it.
  100           await expect
  101             .poll(readUsdtAvailableToBuy, {
  102 >             timeout: 10000,
  103               intervals: [500, 1000, 2000],
  104             })
  105             .toBeLessThan(usdtBeforeBuy);
```

- Why it breaks: A big inline timeout usually papers over an unreliable wait rather than fixing it, and it slows every run down.
- Fix (mechanical rewrite — still verify it):

```diff
- timeout: 10000,
+ // remove the inline timeout and set the budget once:
+ // playwright.config.js →  expect: { timeout: 15_000 }
+ ,
```

  An inline timeout usually hides an unreliable wait. Fix the wait, and keep timeouts in one place.

**Large inline timeout** — `ui_tests/tests/spot/spotTrading.spec.ts:89` (medium, 195 lines from the test)

```ts
   86         await test.step("Wait for the fill to reach trade history", async () => {
   87           await expect
   88             .poll(async () => await spotPage.getRowCount(), {
   89 >             timeout: 10000,
   90               intervals: [500, 1000, 2000],
   91             })
   92             .toBeGreaterThan(rowsBeforeBuy);
```

- Why it breaks: A big inline timeout usually papers over an unreliable wait rather than fixing it, and it slows every run down.
- Fix (mechanical rewrite — still verify it):

```diff
- timeout: 10000,
+ // remove the inline timeout and set the budget once:
+ // playwright.config.js →  expect: { timeout: 15_000 }
+ ,
```

  An inline timeout usually hides an unreliable wait. Fix the wait, and keep timeouts in one place.

_1 further hit(s) in this file, further from the test._

### Anti-patterns in the page objects / helpers this spec imports

| File | Hits | Kinds | On this test's path? |
|---|---|---|---|
| `ui_tests/pages/spotpage.ts` | 17 | xpath-locator, conditional-assert, arbitrary-timeout, text-locator | imported, relevance unclear |
| `ui_tests/helpers/utilities.ts` | 15 | shared-mutable-state, conditional-assert, xpath-locator | imported, relevance unclear |
| `ui_tests/fixtures/fixtures.ts` | 10 | conditional-assert, arbitrary-timeout | imported, relevance unclear |
| `ui_tests/pages/homepage.ts` | 3 | xpath-locator, conditional-assert | imported, relevance unclear |
| `ui_tests/pages/flow/authenFlow.ts` | 1 | empty-catch | imported, relevance unclear |

**XPath locator** — `ui_tests/pages/spotpage.ts:7`

```ts
    5   import ENV from "../helpers/env";
    6   let perpetualPage: PerpetualPage;
    7 > const dialog = `//*[@role='dialog']`;
    8   const orderTypeTab = (type: string) =>
    9     `//div[contains(@class,'tabItem')][.//span[normalize-space(text())='${type}']]`;
```

- XPath chains break on any DOM restructure, which is exactly the kind of failure that gets misread as a product bug.
- Fix (mechanical rewrite — still verify it):

```diff
- const dialog = `//*[@role='dialog']`;
+ // no plain-string form — build this where the page object uses it:
+ // page.getByRole("dialog")
```


**XPath locator** — `ui_tests/pages/spotpage.ts:16`

```ts
   14   const submitOrderButton = `//button[contains(normalize-space(.),'Buy') or contains(normalize-space(.),'Sell')][@type='button' or contains(@class,'fx-column')]`;
   15   const confirmOrderButton = `//button[normalize-space(.)='Yes, confirm' or normalize-space(.)='Confirm']`;
   16 > const accountSelect = `//*[text()='Please select']`;
   17   const tradingAccountOption = `//*[starts-with(text(),'TradingAccount')]`;
   18   const lowerText = `translate(normalize-space(text()),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz')`;
```

- XPath chains break on any DOM restructure, which is exactly the kind of failure that gets misread as a product bug.
- Fix (shape is clear, target needs your judgement):

```diff
- const accountSelect = `//*[text()='Please select']`;
+ // no plain-string form — build this where the page object uses it:
+ // page.getByRole("<role>", { name: "Please select" })
```

  Matching on visible text breaks in other locales — prefer a test id and keep the text as the assertion.

### File history (30 days)

- `84fdabe6` 2026-08-12 Pham The Viet — fix: Verify a new Sub-Account can be created (#1318)
- `b2363f61` 2026-08-12 Pham The Viet — QE-900: Fix verify market sell order can be placed successfully  (#1315)
- `8d657d1e` 2026-08-11 Pham The Viet — fix: Verify every page displays the selected language correctly (#1313)
- `76d2f6c7` 2026-08-03 Pham The Viet — update: titles of test cases (#1275)
- `2c4e9c29` 2026-08-03 Pham The Viet — Add test step blocks to ui tests specs (#1269)

### Likely cause

- `shared-state`
- `brittle-locator`

</details>

**Record the decision**

```bash
node tools/bin/script-rca.js --record --test "Verify open limit order can be cancelled successfully" --channel web-testnet \
  --cause <shared-state> --action <fix|quarantine|rewrite|request-testid|wont-fix> --detail "..." --owner me
```

> Reminder: a `SCRIPT` failure on a smoke suite breaks the QE-935 100% accuracy goal, so it is either fixed today or quarantined with a ticket.

## 19. Verify theme toggle, icons, and rendering work on all public pages in both themes

**Area:** Theme Ui Layout · **Where:** the testnet regression run

**How it fails.** Only 1 run has been recorded for this test so far, which is not enough to tell a real pattern from bad luck.

**Most likely cause.** Too early to say. Let it run a few more times, or read the log from the one failure we have.

**Note from triage:** Collateral of the job timeout: the Trade-Indicators instrument sweep ran 345s and the regression job was cut off, so these tests were reported red without ever completing on their  …

**What to change.**

1. Rewrite the locators in `ui_tests/pages/themeUiPage.ts` (19 XPath expressions) — _large — a page-object rewrite, not a one-line fix_
   Patching one selector here buys a few days; the whole file breaks on the next DOM change.
   ⚠️ Any element without a stable attribute needs a data-testid from FE — raise that request today (QE-935 action 3).

<details><summary>The code, the evidence, and the exact edits</summary>

### Source

`ui_tests/tests/themeUiLayout.spec.ts:165` (exact match, file has 202 lines)

Run log for the latest failure:
```bash
gh run view 32163926749 --log-failed -R gravity-technologies/qa-automation | head -120
```

### Anti-patterns near the test (0 hit(s) in this file)

No static anti-pattern found. That points away from the test code itself — check the run log, the fixture/page-object it calls, and whether the product actually changed.

### Anti-patterns in the page objects / helpers this spec imports

| File | Hits | Kinds | On this test's path? |
|---|---|---|---|
| `ui_tests/pages/themeUiPage.ts` | 26 | xpath-locator, arbitrary-timeout, conditional-assert | likely — the filename matches the test |
| `ui_tests/pages/perpetualpage.ts` | 172 | xpath-locator, shared-mutable-state, conditional-assert, arbitrary-timeout, text-locator, empty-catch | imported, relevance unclear |
| `ui_tests/helpers/utilities.ts` | 15 | shared-mutable-state, conditional-assert, xpath-locator | imported, relevance unclear |
| `ui_tests/fixtures/fixtures.ts` | 10 | conditional-assert, arbitrary-timeout | imported, relevance unclear |
| `ui_tests/pages/downloadAppPage.ts` | 9 | xpath-locator, arbitrary-timeout | imported, relevance unclear |
| `ui_tests/pages/flow/authenFlow.ts` | 1 | empty-catch | imported, relevance unclear |

**XPath locator** — `ui_tests/pages/themeUiPage.ts:7`

```ts
    5   import ENV from "../helpers/env";
    6   
    7 > const settingIcon = `//*[contains(@class,'menuPanel')][.//*[@aria-label='Settings']]`;
    8   const settingTrigger = `${settingIcon}//*[@aria-label='Settings']`;
    9   const headerWrapper = `//*[contains(@class,'headerWrapper')]`;
```

- XPath chains break on any DOM restructure, which is exactly the kind of failure that gets misread as a product bug.
- Fix (mechanical rewrite — still verify it):

```diff
- const settingIcon = `//*[contains(@class,'menuPanel')][.//*[@aria-label='Settings']]`;
+ // no plain-string form — build this where the page object uses it:
+ // page.getByLabel("Settings")
```


**XPath locator** — `ui_tests/pages/themeUiPage.ts:8`

```ts
    6   
    7   const settingIcon = `//*[contains(@class,'menuPanel')][.//*[@aria-label='Settings']]`;
    8 > const settingTrigger = `${settingIcon}//*[@aria-label='Settings']`;
    9   const headerWrapper = `//*[contains(@class,'headerWrapper')]`;
   10   const dialog = `//*[@role='dialog']`;
```

- XPath chains break on any DOM restructure, which is exactly the kind of failure that gets misread as a product bug.
- Fix (shape is clear, target needs your judgement):

```diff
- const settingTrigger = `${settingIcon}//*[@aria-label='Settings']`;
+ // no plain-string form — build this where the page object uses it:
+ // page.getByLabel("Settings")
```

  This XPath walks 2 steps — the suggestion below only resolves the first one, so it targets the ancestor, not the element the test actually clicks. Pick the real target before applying it.

### File history (30 days)

- `8d657d1e` 2026-08-11 Pham The Viet — fix: Verify every page displays the selected language correctly (#1313)
- `76d2f6c7` 2026-08-03 Pham The Viet — update: titles of test cases (#1275)
- `2c4e9c29` 2026-08-03 Pham The Viet — Add test step blocks to ui tests specs (#1269)

### Likely cause

- `brittle-locator`

</details>

**Record the decision**

```bash
node tools/bin/script-rca.js --record --test "Verify theme toggle, icons, and rendering work on all public pages in both themes" --channel web-testnet \
  --cause <brittle-locator> --action <fix|quarantine|rewrite|request-testid|wont-fix> --detail "..." --owner me
```

> Reminder: a `SCRIPT` failure on a smoke suite breaks the QE-935 100% accuracy goal, so it is either fixed today or quarantined with a ticket.

## 20. Verify button layout: overflow, overlap, truncation and height stability across all locales

**Area:** Language Ui Layout · **Where:** the staging smoke run

**How it fails.** It fails every single time it runs — 16 in a row.

**Most likely cause.** The test finds elements by their position or styling instead of a stable name. Any change to the page layout or CSS moves the target, so the test stops finding the button it needs.

⚠️ **This was already "fixed" once and came back** — 27 Jul, "fix: Button layout: overflow, overlap, truncation and height stability across all locales (#1233)". Whatever was changed then did not address the real cause, so patching it a second time is unlikely to hold.

**Note from triage:** changeLanguage failed all 3 attempts — the language panel never opened (waitFor timeouts at 30s then 5s, 5s), so the locale sweep could not run.

**What to change.**

1. Rewrite rather than patch — _—_
   This test was already "fixed" in e3f77be8 and came back. The earlier root cause was not the real one.
2. Rewrite the locators in `ui_tests/pages/languageUiPage.ts` (45 XPath expressions) — _large — a page-object rewrite, not a one-line fix_
   Patching one selector here buys a few days; the whole file breaks on the next DOM change.
   ⚠️ Any element without a stable attribute needs a data-testid from FE — raise that request today (QE-935 action 3).

<details><summary>The code, the evidence, and the exact edits</summary>

### Source

`ui_tests/tests/languageUiLayout.spec.ts:289` (exact match, file has 530 lines)

Run log for the latest failure:
```bash
gh run view 32191181406 --log-failed -R gravity-technologies/qa-automation | head -120
```

### Anti-patterns near the test (0 hit(s) in this file)

No static anti-pattern found. That points away from the test code itself — check the run log, the fixture/page-object it calls, and whether the product actually changed.

### Anti-patterns in the page objects / helpers this spec imports

| File | Hits | Kinds | On this test's path? |
|---|---|---|---|
| `ui_tests/pages/languageUiPage.ts` | 87 | xpath-locator, arbitrary-timeout, conditional-assert, nth-index | imported, relevance unclear |
| `ui_tests/pages/commonPage.ts` | 21 | xpath-locator, conditional-assert | imported, relevance unclear |
| `ui_tests/helpers/utilities.ts` | 15 | shared-mutable-state, conditional-assert, xpath-locator | imported, relevance unclear |
| `ui_tests/pages/flow/authenFlow.ts` | 1 | empty-catch | imported, relevance unclear |

**XPath locator** — `ui_tests/pages/languageUiPage.ts:7`

```ts
    5   import ENV from "../helpers/env";
    6   
    7 > const headerNav = `//*[contains(@class,'headerWrapper')]`;
    8   const dialogLoc = `//*[@role="dialog"]`;
    9   const sectors = `//*[@class='overflow-auto fx-column fx-jc-center gap-2 px-3 sm-px-4']`;
```

- XPath chains break on any DOM restructure, which is exactly the kind of failure that gets misread as a product bug.
- Fix (shape is clear, target needs your judgement):

```diff
- const headerNav = `//*[contains(@class,'headerWrapper')]`;
+ const headerNav = "header-wrapper";
+ // call site:  page.getByTestId(headerNav)
```

  Derived from the class name "headerWrapper". A class is a styling hook, so this breaks on any CSS refactor.
  ⚠️ Needs FE/mobile to add `data-testid="header-wrapper"` — raise it today, quarantine meanwhile.

**XPath locator** — `ui_tests/pages/languageUiPage.ts:8`

```ts
    6   
    7   const headerNav = `//*[contains(@class,'headerWrapper')]`;
    8 > const dialogLoc = `//*[@role="dialog"]`;
    9   const sectors = `//*[@class='overflow-auto fx-column fx-jc-center gap-2 px-3 sm-px-4']`;
   10   const tabsLoc = `//*[@style='width: 100%; height: 684px;']//div[contains(@class,'_tabs')]/div`;
```

- XPath chains break on any DOM restructure, which is exactly the kind of failure that gets misread as a product bug.
- Fix (mechanical rewrite — still verify it):

```diff
- const dialogLoc = `//*[@role="dialog"]`;
+ // no plain-string form — build this where the page object uses it:
+ // page.getByRole("dialog")
```


### File history (30 days)

- `8d657d1e` 2026-08-11 Pham The Viet — fix: Verify every page displays the selected language correctly (#1313)
- `76d2f6c7` 2026-08-03 Pham The Viet — update: titles of test cases (#1275)
- `2c4e9c29` 2026-08-03 Pham The Viet — Add test step blocks to ui tests specs (#1269)
- `e3f77be8` 2026-07-27 Pham The Viet — fix: Button layout: overflow, overlap, truncation and height stability across all locales (#1233)
- `59ca404a` 2026-07-23 Pham The Viet — fix: Favorites Core (#1215)

### Likely cause

- `brittle-locator`

</details>

**Record the decision**

```bash
node tools/bin/script-rca.js --record --test "Verify button layout: overflow, overlap, truncation and height stability across all locales" --channel web-staging \
  --cause <brittle-locator> --action <fix|quarantine|rewrite|request-testid|wont-fix> --detail "..." --owner me
```

> Reminder: a `SCRIPT` failure on a smoke suite breaks the QE-935 100% accuracy goal, so it is either fixed today or quarantined with a ticket.

## 21. Verify navigation layout: overflow, overlap and height stability across all locales

**Area:** Language Ui Layout · **Where:** the staging smoke run

**How it fails.** It fails occasionally — 10% of the last 10 runs.

**Most likely cause.** The test finds elements by their position or styling instead of a stable name. Any change to the page layout or CSS moves the target, so the test stops finding the button it needs.

⚠️ **This was already "fixed" once and came back** — 27 Jul, "fix: Button layout: overflow, overlap, truncation and height stability across all locales (#1233)". Whatever was changed then did not address the real cause, so patching it a second time is unlikely to hold.

**Note from triage:** changeLanguage failed all 3 attempts — the language panel never opened (waitFor timeouts at 30s then 5s, 5s), so the locale sweep could not run.

**What to change.**

1. Rewrite rather than patch — _—_
   This test was already "fixed" in e3f77be8 and came back. The earlier root cause was not the real one.
2. Rewrite the locators in `ui_tests/pages/languageUiPage.ts` (45 XPath expressions) — _large — a page-object rewrite, not a one-line fix_
   Patching one selector here buys a few days; the whole file breaks on the next DOM change.
   ⚠️ Any element without a stable attribute needs a data-testid from FE — raise that request today (QE-935 action 3).

<details><summary>The code, the evidence, and the exact edits</summary>

### Source

`ui_tests/tests/languageUiLayout.spec.ts:326` (exact match, file has 530 lines)

Run log for the latest failure:
```bash
gh run view 32191181406 --log-failed -R gravity-technologies/qa-automation | head -120
```

### Anti-patterns near the test (0 hit(s) in this file)

No static anti-pattern found. That points away from the test code itself — check the run log, the fixture/page-object it calls, and whether the product actually changed.

### Anti-patterns in the page objects / helpers this spec imports

| File | Hits | Kinds | On this test's path? |
|---|---|---|---|
| `ui_tests/pages/languageUiPage.ts` | 87 | xpath-locator, arbitrary-timeout, conditional-assert, nth-index | imported, relevance unclear |
| `ui_tests/pages/commonPage.ts` | 21 | xpath-locator, conditional-assert | imported, relevance unclear |
| `ui_tests/helpers/utilities.ts` | 15 | shared-mutable-state, conditional-assert, xpath-locator | imported, relevance unclear |
| `ui_tests/pages/flow/authenFlow.ts` | 1 | empty-catch | imported, relevance unclear |

**XPath locator** — `ui_tests/pages/languageUiPage.ts:7`

```ts
    5   import ENV from "../helpers/env";
    6   
    7 > const headerNav = `//*[contains(@class,'headerWrapper')]`;
    8   const dialogLoc = `//*[@role="dialog"]`;
    9   const sectors = `//*[@class='overflow-auto fx-column fx-jc-center gap-2 px-3 sm-px-4']`;
```

- XPath chains break on any DOM restructure, which is exactly the kind of failure that gets misread as a product bug.
- Fix (shape is clear, target needs your judgement):

```diff
- const headerNav = `//*[contains(@class,'headerWrapper')]`;
+ const headerNav = "header-wrapper";
+ // call site:  page.getByTestId(headerNav)
```

  Derived from the class name "headerWrapper". A class is a styling hook, so this breaks on any CSS refactor.
  ⚠️ Needs FE/mobile to add `data-testid="header-wrapper"` — raise it today, quarantine meanwhile.

**XPath locator** — `ui_tests/pages/languageUiPage.ts:8`

```ts
    6   
    7   const headerNav = `//*[contains(@class,'headerWrapper')]`;
    8 > const dialogLoc = `//*[@role="dialog"]`;
    9   const sectors = `//*[@class='overflow-auto fx-column fx-jc-center gap-2 px-3 sm-px-4']`;
   10   const tabsLoc = `//*[@style='width: 100%; height: 684px;']//div[contains(@class,'_tabs')]/div`;
```

- XPath chains break on any DOM restructure, which is exactly the kind of failure that gets misread as a product bug.
- Fix (mechanical rewrite — still verify it):

```diff
- const dialogLoc = `//*[@role="dialog"]`;
+ // no plain-string form — build this where the page object uses it:
+ // page.getByRole("dialog")
```


### File history (30 days)

- `8d657d1e` 2026-08-11 Pham The Viet — fix: Verify every page displays the selected language correctly (#1313)
- `76d2f6c7` 2026-08-03 Pham The Viet — update: titles of test cases (#1275)
- `2c4e9c29` 2026-08-03 Pham The Viet — Add test step blocks to ui tests specs (#1269)
- `e3f77be8` 2026-07-27 Pham The Viet — fix: Button layout: overflow, overlap, truncation and height stability across all locales (#1233)
- `59ca404a` 2026-07-23 Pham The Viet — fix: Favorites Core (#1215)

### Likely cause

- `brittle-locator`

</details>

**Record the decision**

```bash
node tools/bin/script-rca.js --record --test "Verify navigation layout: overflow, overlap and height stability across all locales" --channel web-staging \
  --cause <brittle-locator> --action <fix|quarantine|rewrite|request-testid|wont-fix> --detail "..." --owner me
```

> Reminder: a `SCRIPT` failure on a smoke suite breaks the QE-935 100% accuracy goal, so it is either fixed today or quarantined with a ticket.

## 22. Verify Trade-Indicators data for all instruments is rendered as expected

**Area:** E2e Tests · **Where:** the staging smoke run

**How it fails.** It passes some runs and fails others with nothing changing in between (50% of the last 4 runs failed). It only ever fails on chrome.

**Most likely cause.** The test depends on a specific account being in a specific state. Balances, open positions and settings drift, so the test breaks without anyone touching the code.

**Already decided:** Fix the test now — the cause is small and local. (switchToInstrument extracted the ticker base with /^([A-Z]+)/i, which stops at the first digit: KODEX200 became KODEX, no row matched, and t …)

⚠️ **This was already "fixed" once and came back** — 4 Aug, "fix: Verify trading chart candle-sticks are rendered as expected (#1280)". Whatever was changed then did not address the real cause, so patching it a second time is unlikely to hold.

**Note from triage:** Today it fails in getActiveInstrument, not the ticker regex QE-969 fixed: instrumentSelector's positional XPath does not match staging markup and textContent times out at 30s.

**What to change.**

1. Rewrite rather than patch — _—_
   This test was already "fixed" in 82fd6b91 and came back. The earlier root cause was not the real one.
2. Rewrite the locators in `ui_tests/pages/perpetualpage.ts` (123 XPath expressions) — _large — a page-object rewrite, not a one-line fix_
   Patching one selector here buys a few days; the whole file breaks on the next DOM change.
   ⚠️ Any element without a stable attribute needs a data-testid from FE — raise that request today (QE-935 action 3).
3. Find the unsynchronised step and wait on its completion signal (response, spinner gone, value settled) — _small to medium_
   The failure is intermittent, which is the signature of a timing gap rather than a broken assertion.

<details><summary>The code, the evidence, and the exact edits</summary>

### Source

`ui_tests/tests/e2e_tests.spec.ts:59` (exact match, file has 802 lines)

Run log for the latest failure:
```bash
gh run view 32191181406 --log-failed -R gravity-technologies/qa-automation | head -120
```

### Anti-patterns near the test (0 hit(s) in this file)

No static anti-pattern found. That points away from the test code itself — check the run log, the fixture/page-object it calls, and whether the product actually changed.

### Anti-patterns in the page objects / helpers this spec imports

| File | Hits | Kinds | On this test's path? |
|---|---|---|---|
| `ui_tests/pages/perpetualpage.ts` | 172 | xpath-locator, shared-mutable-state, conditional-assert, arbitrary-timeout, text-locator, empty-catch | imported, relevance unclear |
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

- `f8475044` 2026-08-18 Pham The Viet — QR-969  Fix trade-indicators hang on numeric tickers and reduce browser runs (#1351)
- `84fdabe6` 2026-08-12 Pham The Viet — fix: Verify a new Sub-Account can be created (#1318)
- `8d657d1e` 2026-08-11 Pham The Viet — fix: Verify every page displays the selected language correctly (#1313)
- `c6394745` 2026-08-07 Pham The Viet — Disable ETH minting tests on web (#1296)
- `82fd6b91` 2026-08-04 Pham The Viet — fix: Verify trading chart candle-sticks are rendered as expected (#1280)

### Likely cause

- `race-condition`
- `brittle-locator`

</details>

**Record the decision**

```bash
node tools/bin/script-rca.js --record --test "Verify Trade-Indicators data for all instruments is rendered as expected" --channel web-staging \
  --cause <race-condition> --action <fix|quarantine|rewrite|request-testid|wont-fix> --detail "..." --owner me
```

> Reminder: a `SCRIPT` failure on a smoke suite breaks the QE-935 100% accuracy goal, so it is either fixed today or quarantined with a ticket.

## 23. Verify user can remove margin from an Isolated position

**Area:** Place Orders · **Where:** the staging smoke run

**How it fails.** It passes some runs and fails others with nothing changing in between (66.7% of the last 3 runs failed). It only ever fails on chrome.

**Most likely cause.** The test finds elements by their position or styling instead of a stable name. Any change to the page layout or CSS moves the target, so the test stops finding the button it needs.

**Note from triage:** Every instrument switch dies in getActiveInstrument: instrumentSelector is a positional XPath keyed on the literal text 'Perpetual', which does not match staging's trade-header mar …

**What to change.**

1. Rewrite the locators in `ui_tests/pages/perpetualpage.ts` (123 XPath expressions) — _large — a page-object rewrite, not a one-line fix_
   Patching one selector here buys a few days; the whole file breaks on the next DOM change.
   ⚠️ Any element without a stable attribute needs a data-testid from FE — raise that request today (QE-935 action 3).
2. Find the unsynchronised step and wait on its completion signal (response, spinner gone, value settled) — _small to medium_
   The failure is intermittent, which is the signature of a timing gap rather than a broken assertion.
3. Make the assertion unconditional, or split the conditional branches into separate tests — _small_
   A skipped assertion reports green while verifying nothing — worse than a failure.
4. Reproduce on `chrome` specifically and decide: engine-specific product bug, or a locator/wait that only that engine exposes — _investigation first_
   It passes on firefox, so the test logic is not wholesale wrong.
   ⚠️ If the product genuinely behaves differently there, this is an APP-BUG, not a SCRIPT defect — re-classify it.

<details><summary>The code, the evidence, and the exact edits</summary>

### Source

`ui_tests/tests/placeOrders/isolatedMarginMode.spec.ts:260` (exact match, file has 506 lines)

Run log for the latest failure:
```bash
gh run view 32191181406 --log-failed -R gravity-technologies/qa-automation | head -120
```

### Anti-patterns near the test (2 hit(s) in this file)

**Assertion behind a condition** — `ui_tests/tests/placeOrders/isolatedMarginMode.spec.ts:67` (high, 193 lines from the test)

```ts
   64     const marginModeShort = marginMode.replace(" Margin", "");
   65     await perPage.switchToInstrument(inst);
   66     const leverageExceedsDialog = "//*[text()='Leverage Exceeds Maximum']";
   67 >   if (await perPage.isDisplayed(leverageExceedsDialog, 3000)) {
   68       await perPage.tapText(BTN.confirm);
   69       await perPage.adjustLeverage("10");
   70     }
```

- Why it breaks: A test that skips its own assertion when the element is absent passes green while verifying nothing.
- Fix (shape is clear, target needs your judgement):

```diff
- if (await perPage.isDisplayed(leverageExceedsDialog, 3000)) {
+ // assert the expected state instead of branching on it:
+ await expect(<locator>).toBeVisible();
+ // if both branches are genuinely valid, split this into two tests
```

  When the element is missing this branch is skipped and the test goes green while verifying nothing.

**XPath locator** — `ui_tests/tests/placeOrders/isolatedMarginMode.spec.ts:66` (high, 194 lines from the test)

```ts
   63     const marginMode = MarginMode.isolatedMargin;
   64     const marginModeShort = marginMode.replace(" Margin", "");
   65     await perPage.switchToInstrument(inst);
   66 >   const leverageExceedsDialog = "//*[text()='Leverage Exceeds Maximum']";
   67     if (await perPage.isDisplayed(leverageExceedsDialog, 3000)) {
   68       await perPage.tapText(BTN.confirm);
   69       await perPage.adjustLeverage("10");
```

- Why it breaks: XPath chains break on any DOM restructure, which is exactly the kind of failure that gets misread as a product bug.
- Fix (shape is clear, target needs your judgement):

```diff
- const leverageExceedsDialog = "//*[text()='Leverage Exceeds Maximum']";
+ // no plain-string form — build this where the page object uses it:
+ // page.getByRole("<role>", { name: "Leverage Exceeds Maximum" })
```

  Matching on visible text breaks in other locales — prefer a test id and keep the text as the assertion.


### Anti-patterns in the page objects / helpers this spec imports

| File | Hits | Kinds | On this test's path? |
|---|---|---|---|
| `ui_tests/pages/perpetualpage.ts` | 172 | xpath-locator, shared-mutable-state, conditional-assert, arbitrary-timeout, text-locator, empty-catch | imported, relevance unclear |
| `ui_tests/pages/commonPage.ts` | 21 | xpath-locator, conditional-assert | imported, relevance unclear |
| `ui_tests/helpers/utilities.ts` | 15 | shared-mutable-state, conditional-assert, xpath-locator | imported, relevance unclear |
| `ui_tests/fixtures/fixtures.ts` | 10 | conditional-assert, arbitrary-timeout | imported, relevance unclear |
| `ui_tests/helpers/commonData.json` | 2 | hardcoded-account | imported, relevance unclear |
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

- `8d657d1e` 2026-08-11 Pham The Viet — fix: Verify every page displays the selected language correctly (#1313)
- `76d2f6c7` 2026-08-03 Pham The Viet — update: titles of test cases (#1275)
- `2c4e9c29` 2026-08-03 Pham The Viet — Add test step blocks to ui tests specs (#1269)
- `b7829888` 2026-07-31 Pham The Viet — fix: Wallet shows correct balance USDT after successful withdrawal (#1263)

### Likely cause

- `brittle-locator`
- `assertion-wrong`
- `race-condition`
- `env-dependency`

</details>

**Record the decision**

```bash
node tools/bin/script-rca.js --record --test "Verify user can remove margin from an Isolated position" --channel web-staging \
  --cause <brittle-locator> --action <fix|quarantine|rewrite|request-testid|wont-fix> --detail "..." --owner me
```

> Reminder: a `SCRIPT` failure on a smoke suite breaks the QE-935 100% accuracy goal, so it is either fixed today or quarantined with a ticket.

## 24. Verify encoding, translations, number format and horizontal scroll across all locales

**Area:** Language Ui Layout · **Where:** the staging smoke run

**How it fails.** Only 2 runs have been recorded for this test so far, which is not enough to tell a real pattern from bad luck.

**Most likely cause.** Too early to say. Let it run a few more times, or read the log from the one failure we have.

**Note from triage:** changeLanguage failed all 3 attempts — the language panel never opened (waitFor timeouts at 30s then 5s, 5s), so the locale sweep could not run.

**What to change.**

1. Rewrite the locators in `ui_tests/pages/languageUiPage.ts` (45 XPath expressions) — _large — a page-object rewrite, not a one-line fix_
   Patching one selector here buys a few days; the whole file breaks on the next DOM change.
   ⚠️ Any element without a stable attribute needs a data-testid from FE — raise that request today (QE-935 action 3).

<details><summary>The code, the evidence, and the exact edits</summary>

### Source

`ui_tests/tests/languageUiLayout.spec.ts:442` (exact match, file has 530 lines)

Run log for the latest failure:
```bash
gh run view 32191181406 --log-failed -R gravity-technologies/qa-automation | head -120
```

### Anti-patterns near the test (0 hit(s) in this file)

No static anti-pattern found. That points away from the test code itself — check the run log, the fixture/page-object it calls, and whether the product actually changed.

### Anti-patterns in the page objects / helpers this spec imports

| File | Hits | Kinds | On this test's path? |
|---|---|---|---|
| `ui_tests/pages/languageUiPage.ts` | 87 | xpath-locator, arbitrary-timeout, conditional-assert, nth-index | imported, relevance unclear |
| `ui_tests/pages/commonPage.ts` | 21 | xpath-locator, conditional-assert | imported, relevance unclear |
| `ui_tests/helpers/utilities.ts` | 15 | shared-mutable-state, conditional-assert, xpath-locator | imported, relevance unclear |
| `ui_tests/pages/flow/authenFlow.ts` | 1 | empty-catch | imported, relevance unclear |

**XPath locator** — `ui_tests/pages/languageUiPage.ts:7`

```ts
    5   import ENV from "../helpers/env";
    6   
    7 > const headerNav = `//*[contains(@class,'headerWrapper')]`;
    8   const dialogLoc = `//*[@role="dialog"]`;
    9   const sectors = `//*[@class='overflow-auto fx-column fx-jc-center gap-2 px-3 sm-px-4']`;
```

- XPath chains break on any DOM restructure, which is exactly the kind of failure that gets misread as a product bug.
- Fix (shape is clear, target needs your judgement):

```diff
- const headerNav = `//*[contains(@class,'headerWrapper')]`;
+ const headerNav = "header-wrapper";
+ // call site:  page.getByTestId(headerNav)
```

  Derived from the class name "headerWrapper". A class is a styling hook, so this breaks on any CSS refactor.
  ⚠️ Needs FE/mobile to add `data-testid="header-wrapper"` — raise it today, quarantine meanwhile.

**XPath locator** — `ui_tests/pages/languageUiPage.ts:8`

```ts
    6   
    7   const headerNav = `//*[contains(@class,'headerWrapper')]`;
    8 > const dialogLoc = `//*[@role="dialog"]`;
    9   const sectors = `//*[@class='overflow-auto fx-column fx-jc-center gap-2 px-3 sm-px-4']`;
   10   const tabsLoc = `//*[@style='width: 100%; height: 684px;']//div[contains(@class,'_tabs')]/div`;
```

- XPath chains break on any DOM restructure, which is exactly the kind of failure that gets misread as a product bug.
- Fix (mechanical rewrite — still verify it):

```diff
- const dialogLoc = `//*[@role="dialog"]`;
+ // no plain-string form — build this where the page object uses it:
+ // page.getByRole("dialog")
```


### File history (30 days)

- `8d657d1e` 2026-08-11 Pham The Viet — fix: Verify every page displays the selected language correctly (#1313)
- `76d2f6c7` 2026-08-03 Pham The Viet — update: titles of test cases (#1275)
- `2c4e9c29` 2026-08-03 Pham The Viet — Add test step blocks to ui tests specs (#1269)
- `e3f77be8` 2026-07-27 Pham The Viet — fix: Button layout: overflow, overlap, truncation and height stability across all locales (#1233)
- `59ca404a` 2026-07-23 Pham The Viet — fix: Favorites Core (#1215)

### Likely cause

- `brittle-locator`

</details>

**Record the decision**

```bash
node tools/bin/script-rca.js --record --test "Verify encoding, translations, number format and horizontal scroll across all locales" --channel web-staging \
  --cause <brittle-locator> --action <fix|quarantine|rewrite|request-testid|wont-fix> --detail "..." --owner me
```

> Reminder: a `SCRIPT` failure on a smoke suite breaks the QE-935 100% accuracy goal, so it is either fixed today or quarantined with a ticket.

## 25. Verify all records under the Recent Trades tab are populated as expected

**Area:** E2e Tests · **Where:** the staging smoke run

**How it fails.** Only 1 run has been recorded for this test so far, which is not enough to tell a real pattern from bad luck.

**Most likely cause.** Too early to say. Let it run a few more times, or read the log from the one failure we have.

**Note from triage:** Every instrument switch dies in getActiveInstrument: instrumentSelector is a positional XPath keyed on the literal text 'Perpetual', which does not match staging's trade-header mar …

**What to change.**

1. Rewrite the locators in `ui_tests/pages/perpetualpage.ts` (123 XPath expressions) — _large — a page-object rewrite, not a one-line fix_
   Patching one selector here buys a few days; the whole file breaks on the next DOM change.
   ⚠️ Any element without a stable attribute needs a data-testid from FE — raise that request today (QE-935 action 3).

<details><summary>The code, the evidence, and the exact edits</summary>

### Source

`ui_tests/tests/e2e_tests.spec.ts:139` (exact match, file has 802 lines)

Run log for the latest failure:
```bash
gh run view 32191181406 --log-failed -R gravity-technologies/qa-automation | head -120
```

### Anti-patterns near the test (0 hit(s) in this file)

No static anti-pattern found. That points away from the test code itself — check the run log, the fixture/page-object it calls, and whether the product actually changed.

### Anti-patterns in the page objects / helpers this spec imports

| File | Hits | Kinds | On this test's path? |
|---|---|---|---|
| `ui_tests/pages/perpetualpage.ts` | 172 | xpath-locator, shared-mutable-state, conditional-assert, arbitrary-timeout, text-locator, empty-catch | imported, relevance unclear |
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

- `f8475044` 2026-08-18 Pham The Viet — QR-969  Fix trade-indicators hang on numeric tickers and reduce browser runs (#1351)
- `84fdabe6` 2026-08-12 Pham The Viet — fix: Verify a new Sub-Account can be created (#1318)
- `8d657d1e` 2026-08-11 Pham The Viet — fix: Verify every page displays the selected language correctly (#1313)
- `c6394745` 2026-08-07 Pham The Viet — Disable ETH minting tests on web (#1296)
- `82fd6b91` 2026-08-04 Pham The Viet — fix: Verify trading chart candle-sticks are rendered as expected (#1280)

### Likely cause

- `brittle-locator`

</details>

**Record the decision**

```bash
node tools/bin/script-rca.js --record --test "Verify all records under the Recent Trades tab are populated as expected" --channel web-staging \
  --cause <brittle-locator> --action <fix|quarantine|rewrite|request-testid|wont-fix> --detail "..." --owner me
```

> Reminder: a `SCRIPT` failure on a smoke suite breaks the QE-935 100% accuracy goal, so it is either fixed today or quarantined with a ticket.

## 26. Verify Order-Book data is displayed as expected

**Area:** E2e Tests · **Where:** the staging smoke run

**How it fails.** Only 1 run has been recorded for this test so far, which is not enough to tell a real pattern from bad luck.

**Most likely cause.** Too early to say. Let it run a few more times, or read the log from the one failure we have.

⚠️ **This was already "fixed" once and came back** — 4 Aug, "fix: Verify trading chart candle-sticks are rendered as expected (#1280)". Whatever was changed then did not address the real cause, so patching it a second time is unlikely to hold.

**Note from triage:** Every instrument switch dies in getActiveInstrument: instrumentSelector is a positional XPath keyed on the literal text 'Perpetual', which does not match staging's trade-header mar …

**What to change.**

1. Rewrite rather than patch — _—_
   This test was already "fixed" in 82fd6b91 and came back. The earlier root cause was not the real one.
2. Rewrite the locators in `ui_tests/pages/perpetualpage.ts` (123 XPath expressions) — _large — a page-object rewrite, not a one-line fix_
   Patching one selector here buys a few days; the whole file breaks on the next DOM change.
   ⚠️ Any element without a stable attribute needs a data-testid from FE — raise that request today (QE-935 action 3).

<details><summary>The code, the evidence, and the exact edits</summary>

### Source

`ui_tests/tests/e2e_tests.spec.ts:163` (exact match, file has 802 lines)

Run log for the latest failure:
```bash
gh run view 32191181406 --log-failed -R gravity-technologies/qa-automation | head -120
```

### Anti-patterns near the test (0 hit(s) in this file)

No static anti-pattern found. That points away from the test code itself — check the run log, the fixture/page-object it calls, and whether the product actually changed.

### Anti-patterns in the page objects / helpers this spec imports

| File | Hits | Kinds | On this test's path? |
|---|---|---|---|
| `ui_tests/pages/perpetualpage.ts` | 172 | xpath-locator, shared-mutable-state, conditional-assert, arbitrary-timeout, text-locator, empty-catch | imported, relevance unclear |
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

- `f8475044` 2026-08-18 Pham The Viet — QR-969  Fix trade-indicators hang on numeric tickers and reduce browser runs (#1351)
- `84fdabe6` 2026-08-12 Pham The Viet — fix: Verify a new Sub-Account can be created (#1318)
- `8d657d1e` 2026-08-11 Pham The Viet — fix: Verify every page displays the selected language correctly (#1313)
- `c6394745` 2026-08-07 Pham The Viet — Disable ETH minting tests on web (#1296)
- `82fd6b91` 2026-08-04 Pham The Viet — fix: Verify trading chart candle-sticks are rendered as expected (#1280)

### Likely cause

- `brittle-locator`

</details>

**Record the decision**

```bash
node tools/bin/script-rca.js --record --test "Verify Order-Book data is displayed as expected" --channel web-staging \
  --cause <brittle-locator> --action <fix|quarantine|rewrite|request-testid|wont-fix> --detail "..." --owner me
```

> Reminder: a `SCRIPT` failure on a smoke suite breaks the QE-935 100% accuracy goal, so it is either fixed today or quarantined with a ticket.

## 27. Verify Order-Book is not crossed (BEST_BID lower than BEST_ASK)

**Area:** E2e Tests · **Where:** the staging smoke run

**How it fails.** Only 1 run has been recorded for this test so far, which is not enough to tell a real pattern from bad luck.

**Most likely cause.** Too early to say. Let it run a few more times, or read the log from the one failure we have.

**Note from triage:** Every instrument switch dies in getActiveInstrument: instrumentSelector is a positional XPath keyed on the literal text 'Perpetual', which does not match staging's trade-header mar …

**What to change.**

1. Rewrite the locators in `ui_tests/pages/perpetualpage.ts` (123 XPath expressions) — _large — a page-object rewrite, not a one-line fix_
   Patching one selector here buys a few days; the whole file breaks on the next DOM change.
   ⚠️ Any element without a stable attribute needs a data-testid from FE — raise that request today (QE-935 action 3).

<details><summary>The code, the evidence, and the exact edits</summary>

### Source

`ui_tests/tests/e2e_tests.spec.ts:205` (exact match, file has 802 lines)

Run log for the latest failure:
```bash
gh run view 32191181406 --log-failed -R gravity-technologies/qa-automation | head -120
```

### Anti-patterns near the test (0 hit(s) in this file)

No static anti-pattern found. That points away from the test code itself — check the run log, the fixture/page-object it calls, and whether the product actually changed.

### Anti-patterns in the page objects / helpers this spec imports

| File | Hits | Kinds | On this test's path? |
|---|---|---|---|
| `ui_tests/pages/perpetualpage.ts` | 172 | xpath-locator, shared-mutable-state, conditional-assert, arbitrary-timeout, text-locator, empty-catch | imported, relevance unclear |
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

- `f8475044` 2026-08-18 Pham The Viet — QR-969  Fix trade-indicators hang on numeric tickers and reduce browser runs (#1351)
- `84fdabe6` 2026-08-12 Pham The Viet — fix: Verify a new Sub-Account can be created (#1318)
- `8d657d1e` 2026-08-11 Pham The Viet — fix: Verify every page displays the selected language correctly (#1313)
- `c6394745` 2026-08-07 Pham The Viet — Disable ETH minting tests on web (#1296)
- `82fd6b91` 2026-08-04 Pham The Viet — fix: Verify trading chart candle-sticks are rendered as expected (#1280)

### Likely cause

- `brittle-locator`

</details>

**Record the decision**

```bash
node tools/bin/script-rca.js --record --test "Verify Order-Book is not crossed (BEST_BID lower than BEST_ASK)" --channel web-staging \
  --cause <brittle-locator> --action <fix|quarantine|rewrite|request-testid|wont-fix> --detail "..." --owner me
```

> Reminder: a `SCRIPT` failure on a smoke suite breaks the QE-935 100% accuracy goal, so it is either fixed today or quarantined with a ticket.

## 28. Verify MARKET BUY/SELL order can be placed successfully

**Area:** E2e Tests · **Where:** the staging smoke run

**How it fails.** Only 1 run has been recorded for this test so far, which is not enough to tell a real pattern from bad luck.

**Most likely cause.** Too early to say. Let it run a few more times, or read the log from the one failure we have.

**Note from triage:** Every instrument switch dies in getActiveInstrument: instrumentSelector is a positional XPath keyed on the literal text 'Perpetual', which does not match staging's trade-header mar …

**What to change.**

1. Rewrite the locators in `ui_tests/pages/perpetualpage.ts` (123 XPath expressions) — _large — a page-object rewrite, not a one-line fix_
   Patching one selector here buys a few days; the whole file breaks on the next DOM change.
   ⚠️ Any element without a stable attribute needs a data-testid from FE — raise that request today (QE-935 action 3).

<details><summary>The code, the evidence, and the exact edits</summary>

### Source

`ui_tests/tests/e2e_tests.spec.ts:352` (exact match, file has 802 lines)

Run log for the latest failure:
```bash
gh run view 32191181406 --log-failed -R gravity-technologies/qa-automation | head -120
```

### Anti-patterns near the test (0 hit(s) in this file)

No static anti-pattern found. That points away from the test code itself — check the run log, the fixture/page-object it calls, and whether the product actually changed.

### Anti-patterns in the page objects / helpers this spec imports

| File | Hits | Kinds | On this test's path? |
|---|---|---|---|
| `ui_tests/pages/perpetualpage.ts` | 172 | xpath-locator, shared-mutable-state, conditional-assert, arbitrary-timeout, text-locator, empty-catch | imported, relevance unclear |
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

- `f8475044` 2026-08-18 Pham The Viet — QR-969  Fix trade-indicators hang on numeric tickers and reduce browser runs (#1351)
- `84fdabe6` 2026-08-12 Pham The Viet — fix: Verify a new Sub-Account can be created (#1318)
- `8d657d1e` 2026-08-11 Pham The Viet — fix: Verify every page displays the selected language correctly (#1313)
- `c6394745` 2026-08-07 Pham The Viet — Disable ETH minting tests on web (#1296)
- `82fd6b91` 2026-08-04 Pham The Viet — fix: Verify trading chart candle-sticks are rendered as expected (#1280)

### Likely cause

- `brittle-locator`

</details>

**Record the decision**

```bash
node tools/bin/script-rca.js --record --test "Verify MARKET BUY/SELL order can be placed successfully" --channel web-staging \
  --cause <brittle-locator> --action <fix|quarantine|rewrite|request-testid|wont-fix> --detail "..." --owner me
```

> Reminder: a `SCRIPT` failure on a smoke suite breaks the QE-935 100% accuracy goal, so it is either fixed today or quarantined with a ticket.

## 29. Verify order placement succeeds when quantity is expressed in USDT Notional

**Area:** E2e Tests · **Where:** the staging smoke run

**How it fails.** Only 1 run has been recorded for this test so far, which is not enough to tell a real pattern from bad luck.

**Most likely cause.** Too early to say. Let it run a few more times, or read the log from the one failure we have.

**Note from triage:** Every instrument switch dies in getActiveInstrument: instrumentSelector is a positional XPath keyed on the literal text 'Perpetual', which does not match staging's trade-header mar …

**What to change.**

1. Rewrite the locators in `ui_tests/pages/perpetualpage.ts` (123 XPath expressions) — _large — a page-object rewrite, not a one-line fix_
   Patching one selector here buys a few days; the whole file breaks on the next DOM change.
   ⚠️ Any element without a stable attribute needs a data-testid from FE — raise that request today (QE-935 action 3).

<details><summary>The code, the evidence, and the exact edits</summary>

### Source

`ui_tests/tests/e2e_tests.spec.ts:378` (exact match, file has 802 lines)

Run log for the latest failure:
```bash
gh run view 32191181406 --log-failed -R gravity-technologies/qa-automation | head -120
```

### Anti-patterns near the test (0 hit(s) in this file)

No static anti-pattern found. That points away from the test code itself — check the run log, the fixture/page-object it calls, and whether the product actually changed.

### Anti-patterns in the page objects / helpers this spec imports

| File | Hits | Kinds | On this test's path? |
|---|---|---|---|
| `ui_tests/pages/perpetualpage.ts` | 172 | xpath-locator, shared-mutable-state, conditional-assert, arbitrary-timeout, text-locator, empty-catch | imported, relevance unclear |
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

- `f8475044` 2026-08-18 Pham The Viet — QR-969  Fix trade-indicators hang on numeric tickers and reduce browser runs (#1351)
- `84fdabe6` 2026-08-12 Pham The Viet — fix: Verify a new Sub-Account can be created (#1318)
- `8d657d1e` 2026-08-11 Pham The Viet — fix: Verify every page displays the selected language correctly (#1313)
- `c6394745` 2026-08-07 Pham The Viet — Disable ETH minting tests on web (#1296)
- `82fd6b91` 2026-08-04 Pham The Viet — fix: Verify trading chart candle-sticks are rendered as expected (#1280)

### Likely cause

- `brittle-locator`

</details>

**Record the decision**

```bash
node tools/bin/script-rca.js --record --test "Verify order placement succeeds when quantity is expressed in USDT Notional" --channel web-staging \
  --cause <brittle-locator> --action <fix|quarantine|rewrite|request-testid|wont-fix> --detail "..." --owner me
```

> Reminder: a `SCRIPT` failure on a smoke suite breaks the QE-935 100% accuracy goal, so it is either fixed today or quarantined with a ticket.

## 30. Verify REDUCE_ONLY type orders can be placed successfully

**Area:** E2e Tests · **Where:** the staging smoke run

**How it fails.** Only 1 run has been recorded for this test so far, which is not enough to tell a real pattern from bad luck.

**Most likely cause.** Too early to say. Let it run a few more times, or read the log from the one failure we have.

**Note from triage:** Every instrument switch dies in getActiveInstrument: instrumentSelector is a positional XPath keyed on the literal text 'Perpetual', which does not match staging's trade-header mar …

**What to change.**

1. Rewrite the locators in `ui_tests/pages/perpetualpage.ts` (123 XPath expressions) — _large — a page-object rewrite, not a one-line fix_
   Patching one selector here buys a few days; the whole file breaks on the next DOM change.
   ⚠️ Any element without a stable attribute needs a data-testid from FE — raise that request today (QE-935 action 3).

<details><summary>The code, the evidence, and the exact edits</summary>

### Source

`ui_tests/tests/e2e_tests.spec.ts:405` (exact match, file has 802 lines)

Run log for the latest failure:
```bash
gh run view 32191181406 --log-failed -R gravity-technologies/qa-automation | head -120
```

### Anti-patterns near the test (0 hit(s) in this file)

No static anti-pattern found. That points away from the test code itself — check the run log, the fixture/page-object it calls, and whether the product actually changed.

### Anti-patterns in the page objects / helpers this spec imports

| File | Hits | Kinds | On this test's path? |
|---|---|---|---|
| `ui_tests/pages/perpetualpage.ts` | 172 | xpath-locator, shared-mutable-state, conditional-assert, arbitrary-timeout, text-locator, empty-catch | imported, relevance unclear |
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

- `f8475044` 2026-08-18 Pham The Viet — QR-969  Fix trade-indicators hang on numeric tickers and reduce browser runs (#1351)
- `84fdabe6` 2026-08-12 Pham The Viet — fix: Verify a new Sub-Account can be created (#1318)
- `8d657d1e` 2026-08-11 Pham The Viet — fix: Verify every page displays the selected language correctly (#1313)
- `c6394745` 2026-08-07 Pham The Viet — Disable ETH minting tests on web (#1296)
- `82fd6b91` 2026-08-04 Pham The Viet — fix: Verify trading chart candle-sticks are rendered as expected (#1280)

### Likely cause

- `brittle-locator`

</details>

**Record the decision**

```bash
node tools/bin/script-rca.js --record --test "Verify REDUCE_ONLY type orders can be placed successfully" --channel web-staging \
  --cause <brittle-locator> --action <fix|quarantine|rewrite|request-testid|wont-fix> --detail "..." --owner me
```

> Reminder: a `SCRIPT` failure on a smoke suite breaks the QE-935 100% accuracy goal, so it is either fixed today or quarantined with a ticket.

## 31. Verify IOC type orders can be placed successfully

**Area:** E2e Tests · **Where:** the staging smoke run

**How it fails.** Only 1 run has been recorded for this test so far, which is not enough to tell a real pattern from bad luck.

**Most likely cause.** Too early to say. Let it run a few more times, or read the log from the one failure we have.

**Note from triage:** Every instrument switch dies in getActiveInstrument: instrumentSelector is a positional XPath keyed on the literal text 'Perpetual', which does not match staging's trade-header mar …

**What to change.**

1. Rewrite the locators in `ui_tests/pages/perpetualpage.ts` (123 XPath expressions) — _large — a page-object rewrite, not a one-line fix_
   Patching one selector here buys a few days; the whole file breaks on the next DOM change.
   ⚠️ Any element without a stable attribute needs a data-testid from FE — raise that request today (QE-935 action 3).

<details><summary>The code, the evidence, and the exact edits</summary>

### Source

`ui_tests/tests/e2e_tests.spec.ts:443` (exact match, file has 802 lines)

Run log for the latest failure:
```bash
gh run view 32191181406 --log-failed -R gravity-technologies/qa-automation | head -120
```

### Anti-patterns near the test (0 hit(s) in this file)

No static anti-pattern found. That points away from the test code itself — check the run log, the fixture/page-object it calls, and whether the product actually changed.

### Anti-patterns in the page objects / helpers this spec imports

| File | Hits | Kinds | On this test's path? |
|---|---|---|---|
| `ui_tests/pages/perpetualpage.ts` | 172 | xpath-locator, shared-mutable-state, conditional-assert, arbitrary-timeout, text-locator, empty-catch | imported, relevance unclear |
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

- `f8475044` 2026-08-18 Pham The Viet — QR-969  Fix trade-indicators hang on numeric tickers and reduce browser runs (#1351)
- `84fdabe6` 2026-08-12 Pham The Viet — fix: Verify a new Sub-Account can be created (#1318)
- `8d657d1e` 2026-08-11 Pham The Viet — fix: Verify every page displays the selected language correctly (#1313)
- `c6394745` 2026-08-07 Pham The Viet — Disable ETH minting tests on web (#1296)
- `82fd6b91` 2026-08-04 Pham The Viet — fix: Verify trading chart candle-sticks are rendered as expected (#1280)

### Likely cause

- `brittle-locator`

</details>

**Record the decision**

```bash
node tools/bin/script-rca.js --record --test "Verify IOC type orders can be placed successfully" --channel web-staging \
  --cause <brittle-locator> --action <fix|quarantine|rewrite|request-testid|wont-fix> --detail "..." --owner me
```

> Reminder: a `SCRIPT` failure on a smoke suite breaks the QE-935 100% accuracy goal, so it is either fixed today or quarantined with a ticket.

## 32. Verify FOK type orders can be placed successfully

**Area:** E2e Tests · **Where:** the staging smoke run

**How it fails.** Only 1 run has been recorded for this test so far, which is not enough to tell a real pattern from bad luck.

**Most likely cause.** Too early to say. Let it run a few more times, or read the log from the one failure we have.

**Note from triage:** Every instrument switch dies in getActiveInstrument: instrumentSelector is a positional XPath keyed on the literal text 'Perpetual', which does not match staging's trade-header mar …

**What to change.**

1. Rewrite the locators in `ui_tests/pages/perpetualpage.ts` (123 XPath expressions) — _large — a page-object rewrite, not a one-line fix_
   Patching one selector here buys a few days; the whole file breaks on the next DOM change.
   ⚠️ Any element without a stable attribute needs a data-testid from FE — raise that request today (QE-935 action 3).

<details><summary>The code, the evidence, and the exact edits</summary>

### Source

`ui_tests/tests/e2e_tests.spec.ts:478` (exact match, file has 802 lines)

Run log for the latest failure:
```bash
gh run view 32191181406 --log-failed -R gravity-technologies/qa-automation | head -120
```

### Anti-patterns near the test (0 hit(s) in this file)

No static anti-pattern found. That points away from the test code itself — check the run log, the fixture/page-object it calls, and whether the product actually changed.

### Anti-patterns in the page objects / helpers this spec imports

| File | Hits | Kinds | On this test's path? |
|---|---|---|---|
| `ui_tests/pages/perpetualpage.ts` | 172 | xpath-locator, shared-mutable-state, conditional-assert, arbitrary-timeout, text-locator, empty-catch | imported, relevance unclear |
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

- `f8475044` 2026-08-18 Pham The Viet — QR-969  Fix trade-indicators hang on numeric tickers and reduce browser runs (#1351)
- `84fdabe6` 2026-08-12 Pham The Viet — fix: Verify a new Sub-Account can be created (#1318)
- `8d657d1e` 2026-08-11 Pham The Viet — fix: Verify every page displays the selected language correctly (#1313)
- `c6394745` 2026-08-07 Pham The Viet — Disable ETH minting tests on web (#1296)
- `82fd6b91` 2026-08-04 Pham The Viet — fix: Verify trading chart candle-sticks are rendered as expected (#1280)

### Likely cause

- `brittle-locator`

</details>

**Record the decision**

```bash
node tools/bin/script-rca.js --record --test "Verify FOK type orders can be placed successfully" --channel web-staging \
  --cause <brittle-locator> --action <fix|quarantine|rewrite|request-testid|wont-fix> --detail "..." --owner me
```

> Reminder: a `SCRIPT` failure on a smoke suite breaks the QE-935 100% accuracy goal, so it is either fixed today or quarantined with a ticket.

## 33. Verify POST_ONLY type orders can be placed successfully

**Area:** E2e Tests · **Where:** the staging smoke run

**How it fails.** Only 1 run has been recorded for this test so far, which is not enough to tell a real pattern from bad luck.

**Most likely cause.** Too early to say. Let it run a few more times, or read the log from the one failure we have.

**Note from triage:** Every instrument switch dies in getActiveInstrument: instrumentSelector is a positional XPath keyed on the literal text 'Perpetual', which does not match staging's trade-header mar …

**What to change.**

1. Rewrite the locators in `ui_tests/pages/perpetualpage.ts` (123 XPath expressions) — _large — a page-object rewrite, not a one-line fix_
   Patching one selector here buys a few days; the whole file breaks on the next DOM change.
   ⚠️ Any element without a stable attribute needs a data-testid from FE — raise that request today (QE-935 action 3).

<details><summary>The code, the evidence, and the exact edits</summary>

### Source

`ui_tests/tests/e2e_tests.spec.ts:513` (exact match, file has 802 lines)

Run log for the latest failure:
```bash
gh run view 32191181406 --log-failed -R gravity-technologies/qa-automation | head -120
```

### Anti-patterns near the test (0 hit(s) in this file)

No static anti-pattern found. That points away from the test code itself — check the run log, the fixture/page-object it calls, and whether the product actually changed.

### Anti-patterns in the page objects / helpers this spec imports

| File | Hits | Kinds | On this test's path? |
|---|---|---|---|
| `ui_tests/pages/perpetualpage.ts` | 172 | xpath-locator, shared-mutable-state, conditional-assert, arbitrary-timeout, text-locator, empty-catch | imported, relevance unclear |
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

- `f8475044` 2026-08-18 Pham The Viet — QR-969  Fix trade-indicators hang on numeric tickers and reduce browser runs (#1351)
- `84fdabe6` 2026-08-12 Pham The Viet — fix: Verify a new Sub-Account can be created (#1318)
- `8d657d1e` 2026-08-11 Pham The Viet — fix: Verify every page displays the selected language correctly (#1313)
- `c6394745` 2026-08-07 Pham The Viet — Disable ETH minting tests on web (#1296)
- `82fd6b91` 2026-08-04 Pham The Viet — fix: Verify trading chart candle-sticks are rendered as expected (#1280)

### Likely cause

- `brittle-locator`

</details>

**Record the decision**

```bash
node tools/bin/script-rca.js --record --test "Verify POST_ONLY type orders can be placed successfully" --channel web-staging \
  --cause <brittle-locator> --action <fix|quarantine|rewrite|request-testid|wont-fix> --detail "..." --owner me
```

> Reminder: a `SCRIPT` failure on a smoke suite breaks the QE-935 100% accuracy goal, so it is either fixed today or quarantined with a ticket.

## 34. Verify the top-level navigation header renders on every page

**Area:** Header Nav · **Where:** the staging smoke run

**How it fails.** Only 1 run has been recorded for this test so far, which is not enough to tell a real pattern from bad luck.

**Most likely cause.** Too early to say. Let it run a few more times, or read the log from the one failure we have.

**Note from triage:** Staging renders only [Earn APY | Trade | Invest] on all 3 pages; the test asserts the prod-shaped header, so the expected item list is wrong for this environment.

**What to change.**

1. Replace the 25 XPath/text locator(s) on the failing path with test ids — _small_
   The selector no longer matches the DOM; the product itself may be fine.
   ⚠️ Any element without a stable attribute needs a data-testid from FE — raise that request today (QE-935 action 3).

<details><summary>The code, the evidence, and the exact edits</summary>

### Source

`ui_tests/tests/headerNav.spec.ts:67` (exact match, file has 226 lines)

Run log for the latest failure:
```bash
gh run view 32191181406 --log-failed -R gravity-technologies/qa-automation | head -120
```

### Anti-patterns near the test (0 hit(s) in this file)

No static anti-pattern found. That points away from the test code itself — check the run log, the fixture/page-object it calls, and whether the product actually changed.

### Anti-patterns in the page objects / helpers this spec imports

| File | Hits | Kinds | On this test's path? |
|---|---|---|---|
| `ui_tests/pages/headerNavPage.ts` | 6 | arbitrary-timeout, xpath-locator | likely — the filename matches the test |
| `ui_tests/pages/commonPage.ts` | 21 | xpath-locator, conditional-assert | likely — the filename matches the test |
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

- `brittle-locator`

</details>

**Record the decision**

```bash
node tools/bin/script-rca.js --record --test "Verify the top-level navigation header renders on every page" --channel web-staging \
  --cause <brittle-locator> --action <fix|quarantine|rewrite|request-testid|wont-fix> --detail "..." --owner me
```

> Reminder: a `SCRIPT` failure on a smoke suite breaks the QE-935 100% accuracy goal, so it is either fixed today or quarantined with a ticket.

## 35. Verify MARKET order can be placed using Isolated margin mode

**Area:** Place Orders · **Where:** the staging smoke run

**How it fails.** Only 1 run has been recorded for this test so far, which is not enough to tell a real pattern from bad luck.

**Most likely cause.** Too early to say. Let it run a few more times, or read the log from the one failure we have.

**Note from triage:** Every instrument switch dies in getActiveInstrument: instrumentSelector is a positional XPath keyed on the literal text 'Perpetual', which does not match staging's trade-header mar …

**What to change.**

1. Rewrite the locators in `ui_tests/pages/perpetualpage.ts` (123 XPath expressions) — _large — a page-object rewrite, not a one-line fix_
   Patching one selector here buys a few days; the whole file breaks on the next DOM change.
   ⚠️ Any element without a stable attribute needs a data-testid from FE — raise that request today (QE-935 action 3).
2. Make the assertion unconditional, or split the conditional branches into separate tests — _small_
   A skipped assertion reports green while verifying nothing — worse than a failure.

<details><summary>The code, the evidence, and the exact edits</summary>

### Source

`ui_tests/tests/placeOrders/isolatedMarginMode.spec.ts:116` (exact match, file has 506 lines)

Run log for the latest failure:
```bash
gh run view 32191181406 --log-failed -R gravity-technologies/qa-automation | head -120
```

### Anti-patterns near the test (2 hit(s) in this file)

**Assertion behind a condition** — `ui_tests/tests/placeOrders/isolatedMarginMode.spec.ts:67` (high, 49 lines from the test)

```ts
   64     const marginModeShort = marginMode.replace(" Margin", "");
   65     await perPage.switchToInstrument(inst);
   66     const leverageExceedsDialog = "//*[text()='Leverage Exceeds Maximum']";
   67 >   if (await perPage.isDisplayed(leverageExceedsDialog, 3000)) {
   68       await perPage.tapText(BTN.confirm);
   69       await perPage.adjustLeverage("10");
   70     }
```

- Why it breaks: A test that skips its own assertion when the element is absent passes green while verifying nothing.
- Fix (shape is clear, target needs your judgement):

```diff
- if (await perPage.isDisplayed(leverageExceedsDialog, 3000)) {
+ // assert the expected state instead of branching on it:
+ await expect(<locator>).toBeVisible();
+ // if both branches are genuinely valid, split this into two tests
```

  When the element is missing this branch is skipped and the test goes green while verifying nothing.

**XPath locator** — `ui_tests/tests/placeOrders/isolatedMarginMode.spec.ts:66` (high, 50 lines from the test)

```ts
   63     const marginMode = MarginMode.isolatedMargin;
   64     const marginModeShort = marginMode.replace(" Margin", "");
   65     await perPage.switchToInstrument(inst);
   66 >   const leverageExceedsDialog = "//*[text()='Leverage Exceeds Maximum']";
   67     if (await perPage.isDisplayed(leverageExceedsDialog, 3000)) {
   68       await perPage.tapText(BTN.confirm);
   69       await perPage.adjustLeverage("10");
```

- Why it breaks: XPath chains break on any DOM restructure, which is exactly the kind of failure that gets misread as a product bug.
- Fix (shape is clear, target needs your judgement):

```diff
- const leverageExceedsDialog = "//*[text()='Leverage Exceeds Maximum']";
+ // no plain-string form — build this where the page object uses it:
+ // page.getByRole("<role>", { name: "Leverage Exceeds Maximum" })
```

  Matching on visible text breaks in other locales — prefer a test id and keep the text as the assertion.


### Anti-patterns in the page objects / helpers this spec imports

| File | Hits | Kinds | On this test's path? |
|---|---|---|---|
| `ui_tests/pages/perpetualpage.ts` | 172 | xpath-locator, shared-mutable-state, conditional-assert, arbitrary-timeout, text-locator, empty-catch | imported, relevance unclear |
| `ui_tests/pages/commonPage.ts` | 21 | xpath-locator, conditional-assert | imported, relevance unclear |
| `ui_tests/helpers/utilities.ts` | 15 | shared-mutable-state, conditional-assert, xpath-locator | imported, relevance unclear |
| `ui_tests/fixtures/fixtures.ts` | 10 | conditional-assert, arbitrary-timeout | imported, relevance unclear |
| `ui_tests/helpers/commonData.json` | 2 | hardcoded-account | imported, relevance unclear |
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

- `8d657d1e` 2026-08-11 Pham The Viet — fix: Verify every page displays the selected language correctly (#1313)
- `76d2f6c7` 2026-08-03 Pham The Viet — update: titles of test cases (#1275)
- `2c4e9c29` 2026-08-03 Pham The Viet — Add test step blocks to ui tests specs (#1269)
- `b7829888` 2026-07-31 Pham The Viet — fix: Wallet shows correct balance USDT after successful withdrawal (#1263)

### Likely cause

- `brittle-locator`
- `assertion-wrong`

</details>

**Record the decision**

```bash
node tools/bin/script-rca.js --record --test "Verify MARKET order can be placed using Isolated margin mode" --channel web-staging \
  --cause <brittle-locator> --action <fix|quarantine|rewrite|request-testid|wont-fix> --detail "..." --owner me
```

> Reminder: a `SCRIPT` failure on a smoke suite breaks the QE-935 100% accuracy goal, so it is either fixed today or quarantined with a ticket.

## 36. Verify LIMIT order can be placed using Isolated margin mode

**Area:** Place Orders · **Where:** the staging smoke run

**How it fails.** Only 1 run has been recorded for this test so far, which is not enough to tell a real pattern from bad luck.

**Most likely cause.** Too early to say. Let it run a few more times, or read the log from the one failure we have.

**Note from triage:** Every instrument switch dies in getActiveInstrument: instrumentSelector is a positional XPath keyed on the literal text 'Perpetual', which does not match staging's trade-header mar …

**What to change.**

1. Rewrite the locators in `ui_tests/pages/perpetualpage.ts` (123 XPath expressions) — _large — a page-object rewrite, not a one-line fix_
   Patching one selector here buys a few days; the whole file breaks on the next DOM change.
   ⚠️ Any element without a stable attribute needs a data-testid from FE — raise that request today (QE-935 action 3).
2. Make the assertion unconditional, or split the conditional branches into separate tests — _small_
   A skipped assertion reports green while verifying nothing — worse than a failure.

<details><summary>The code, the evidence, and the exact edits</summary>

### Source

`ui_tests/tests/placeOrders/isolatedMarginMode.spec.ts:153` (exact match, file has 506 lines)

Run log for the latest failure:
```bash
gh run view 32191181406 --log-failed -R gravity-technologies/qa-automation | head -120
```

### Anti-patterns near the test (2 hit(s) in this file)

**Assertion behind a condition** — `ui_tests/tests/placeOrders/isolatedMarginMode.spec.ts:67` (high, 86 lines from the test)

```ts
   64     const marginModeShort = marginMode.replace(" Margin", "");
   65     await perPage.switchToInstrument(inst);
   66     const leverageExceedsDialog = "//*[text()='Leverage Exceeds Maximum']";
   67 >   if (await perPage.isDisplayed(leverageExceedsDialog, 3000)) {
   68       await perPage.tapText(BTN.confirm);
   69       await perPage.adjustLeverage("10");
   70     }
```

- Why it breaks: A test that skips its own assertion when the element is absent passes green while verifying nothing.
- Fix (shape is clear, target needs your judgement):

```diff
- if (await perPage.isDisplayed(leverageExceedsDialog, 3000)) {
+ // assert the expected state instead of branching on it:
+ await expect(<locator>).toBeVisible();
+ // if both branches are genuinely valid, split this into two tests
```

  When the element is missing this branch is skipped and the test goes green while verifying nothing.

**XPath locator** — `ui_tests/tests/placeOrders/isolatedMarginMode.spec.ts:66` (high, 87 lines from the test)

```ts
   63     const marginMode = MarginMode.isolatedMargin;
   64     const marginModeShort = marginMode.replace(" Margin", "");
   65     await perPage.switchToInstrument(inst);
   66 >   const leverageExceedsDialog = "//*[text()='Leverage Exceeds Maximum']";
   67     if (await perPage.isDisplayed(leverageExceedsDialog, 3000)) {
   68       await perPage.tapText(BTN.confirm);
   69       await perPage.adjustLeverage("10");
```

- Why it breaks: XPath chains break on any DOM restructure, which is exactly the kind of failure that gets misread as a product bug.
- Fix (shape is clear, target needs your judgement):

```diff
- const leverageExceedsDialog = "//*[text()='Leverage Exceeds Maximum']";
+ // no plain-string form — build this where the page object uses it:
+ // page.getByRole("<role>", { name: "Leverage Exceeds Maximum" })
```

  Matching on visible text breaks in other locales — prefer a test id and keep the text as the assertion.


### Anti-patterns in the page objects / helpers this spec imports

| File | Hits | Kinds | On this test's path? |
|---|---|---|---|
| `ui_tests/pages/perpetualpage.ts` | 172 | xpath-locator, shared-mutable-state, conditional-assert, arbitrary-timeout, text-locator, empty-catch | imported, relevance unclear |
| `ui_tests/pages/commonPage.ts` | 21 | xpath-locator, conditional-assert | imported, relevance unclear |
| `ui_tests/helpers/utilities.ts` | 15 | shared-mutable-state, conditional-assert, xpath-locator | imported, relevance unclear |
| `ui_tests/fixtures/fixtures.ts` | 10 | conditional-assert, arbitrary-timeout | imported, relevance unclear |
| `ui_tests/helpers/commonData.json` | 2 | hardcoded-account | imported, relevance unclear |
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

- `8d657d1e` 2026-08-11 Pham The Viet — fix: Verify every page displays the selected language correctly (#1313)
- `76d2f6c7` 2026-08-03 Pham The Viet — update: titles of test cases (#1275)
- `2c4e9c29` 2026-08-03 Pham The Viet — Add test step blocks to ui tests specs (#1269)
- `b7829888` 2026-07-31 Pham The Viet — fix: Wallet shows correct balance USDT after successful withdrawal (#1263)

### Likely cause

- `brittle-locator`
- `assertion-wrong`

</details>

**Record the decision**

```bash
node tools/bin/script-rca.js --record --test "Verify LIMIT order can be placed using Isolated margin mode" --channel web-staging \
  --cause <brittle-locator> --action <fix|quarantine|rewrite|request-testid|wont-fix> --detail "..." --owner me
```

> Reminder: a `SCRIPT` failure on a smoke suite breaks the QE-935 100% accuracy goal, so it is either fixed today or quarantined with a ticket.

## 37. Verify user can add margin to an Isolated position

**Area:** Place Orders · **Where:** the staging smoke run

**How it fails.** Only 1 run has been recorded for this test so far, which is not enough to tell a real pattern from bad luck.

**Most likely cause.** Too early to say. Let it run a few more times, or read the log from the one failure we have.

**Note from triage:** Every instrument switch dies in getActiveInstrument: instrumentSelector is a positional XPath keyed on the literal text 'Perpetual', which does not match staging's trade-header mar …

**What to change.**

1. Rewrite the locators in `ui_tests/pages/perpetualpage.ts` (123 XPath expressions) — _large — a page-object rewrite, not a one-line fix_
   Patching one selector here buys a few days; the whole file breaks on the next DOM change.
   ⚠️ Any element without a stable attribute needs a data-testid from FE — raise that request today (QE-935 action 3).
2. Make the assertion unconditional, or split the conditional branches into separate tests — _small_
   A skipped assertion reports green while verifying nothing — worse than a failure.

<details><summary>The code, the evidence, and the exact edits</summary>

### Source

`ui_tests/tests/placeOrders/isolatedMarginMode.spec.ts:195` (exact match, file has 506 lines)

Run log for the latest failure:
```bash
gh run view 32191181406 --log-failed -R gravity-technologies/qa-automation | head -120
```

### Anti-patterns near the test (2 hit(s) in this file)

**Assertion behind a condition** — `ui_tests/tests/placeOrders/isolatedMarginMode.spec.ts:67` (high, 128 lines from the test)

```ts
   64     const marginModeShort = marginMode.replace(" Margin", "");
   65     await perPage.switchToInstrument(inst);
   66     const leverageExceedsDialog = "//*[text()='Leverage Exceeds Maximum']";
   67 >   if (await perPage.isDisplayed(leverageExceedsDialog, 3000)) {
   68       await perPage.tapText(BTN.confirm);
   69       await perPage.adjustLeverage("10");
   70     }
```

- Why it breaks: A test that skips its own assertion when the element is absent passes green while verifying nothing.
- Fix (shape is clear, target needs your judgement):

```diff
- if (await perPage.isDisplayed(leverageExceedsDialog, 3000)) {
+ // assert the expected state instead of branching on it:
+ await expect(<locator>).toBeVisible();
+ // if both branches are genuinely valid, split this into two tests
```

  When the element is missing this branch is skipped and the test goes green while verifying nothing.

**XPath locator** — `ui_tests/tests/placeOrders/isolatedMarginMode.spec.ts:66` (high, 129 lines from the test)

```ts
   63     const marginMode = MarginMode.isolatedMargin;
   64     const marginModeShort = marginMode.replace(" Margin", "");
   65     await perPage.switchToInstrument(inst);
   66 >   const leverageExceedsDialog = "//*[text()='Leverage Exceeds Maximum']";
   67     if (await perPage.isDisplayed(leverageExceedsDialog, 3000)) {
   68       await perPage.tapText(BTN.confirm);
   69       await perPage.adjustLeverage("10");
```

- Why it breaks: XPath chains break on any DOM restructure, which is exactly the kind of failure that gets misread as a product bug.
- Fix (shape is clear, target needs your judgement):

```diff
- const leverageExceedsDialog = "//*[text()='Leverage Exceeds Maximum']";
+ // no plain-string form — build this where the page object uses it:
+ // page.getByRole("<role>", { name: "Leverage Exceeds Maximum" })
```

  Matching on visible text breaks in other locales — prefer a test id and keep the text as the assertion.


### Anti-patterns in the page objects / helpers this spec imports

| File | Hits | Kinds | On this test's path? |
|---|---|---|---|
| `ui_tests/pages/perpetualpage.ts` | 172 | xpath-locator, shared-mutable-state, conditional-assert, arbitrary-timeout, text-locator, empty-catch | imported, relevance unclear |
| `ui_tests/pages/commonPage.ts` | 21 | xpath-locator, conditional-assert | imported, relevance unclear |
| `ui_tests/helpers/utilities.ts` | 15 | shared-mutable-state, conditional-assert, xpath-locator | imported, relevance unclear |
| `ui_tests/fixtures/fixtures.ts` | 10 | conditional-assert, arbitrary-timeout | imported, relevance unclear |
| `ui_tests/helpers/commonData.json` | 2 | hardcoded-account | imported, relevance unclear |
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

- `8d657d1e` 2026-08-11 Pham The Viet — fix: Verify every page displays the selected language correctly (#1313)
- `76d2f6c7` 2026-08-03 Pham The Viet — update: titles of test cases (#1275)
- `2c4e9c29` 2026-08-03 Pham The Viet — Add test step blocks to ui tests specs (#1269)
- `b7829888` 2026-07-31 Pham The Viet — fix: Wallet shows correct balance USDT after successful withdrawal (#1263)

### Likely cause

- `brittle-locator`
- `assertion-wrong`

</details>

**Record the decision**

```bash
node tools/bin/script-rca.js --record --test "Verify user can add margin to an Isolated position" --channel web-staging \
  --cause <brittle-locator> --action <fix|quarantine|rewrite|request-testid|wont-fix> --detail "..." --owner me
```

> Reminder: a `SCRIPT` failure on a smoke suite breaks the QE-935 100% accuracy goal, so it is either fixed today or quarantined with a ticket.

