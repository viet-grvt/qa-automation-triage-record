# Block 2 — Standup & communication, 19/08

## 2.1 Daily standup post (QA channel)

Paste as-is. Anyone who wants detail opens the Block 1 record.

```
🧪 QA Automation Daily — 19/08

Green runs: PROD ✅ 17/17 · TESTNET ⚠️ 4/6 · STAGING 🔴 0/4 · TESTNET ✅ 6/6 · iOS ❌ not run
Fails: 34 → ENV 1 · APP 0 · SCRIPT 33
Smoke accuracy: 🔴 breached — script failure on smoke: Verify button layout: overflow, overlap,…, Verify encoding, translations, number format…, Verify navigation layout: overflow, overlap…, Verify Trade-Indicators data for all…, Verify user can remove margin from an…, Verify all records under the Recent Trades…, Verify Order-Book data is displayed as…, Verify Order-Book is not crossed (BEST_BID…, Verify MARKET BUY/SELL order can be placed…, Verify order placement succeeds when…, Verify REDUCE_ONLY type orders can be placed…, Verify IOC type orders can be placed…, Verify FOK type orders can be placed…, Verify POST_ONLY type orders can be placed…, Verify the top-level navigation header…, Verify MARKET order can be placed using…, Verify LIMIT order can be placed using…, Verify user can add margin to an Isolated…

🔧 Scripts fixed today
• Verify button layout: overflow, overlap,… — shared-state — Not the product: 'Switch app language… — PR ? — verify ?
• Verify encoding, translations, number format… — shared-state — Not the product: 'Switch app language… — PR ? — verify ?
• Verify navigation layout: overflow, overlap… — shared-state — Not the product: 'Switch app language… — PR ? — verify ?
• Verify Trade-Indicators data for all… — brittle-locator — instrumentSelector (perpetualpage.ts:80)… — PR https://grvt.atlassian.net/browse/QE-969 — verify ?
• Verify user can remove margin from an… — brittle-locator — instrumentSelector (perpetualpage.ts:80)… — PR ? — verify ?
• Verify all records under the Recent Trades… — brittle-locator — instrumentSelector (perpetualpage.ts:80)… — PR ? — verify ?
• Verify Order-Book data is displayed as… — brittle-locator — instrumentSelector (perpetualpage.ts:80)… — PR ? — verify ?
• Verify Order-Book is not crossed (BEST_BID… — brittle-locator — instrumentSelector (perpetualpage.ts:80)… — PR ? — verify ?
• Verify MARKET BUY/SELL order can be placed… — brittle-locator — instrumentSelector (perpetualpage.ts:80)… — PR ? — verify ?
• Verify order placement succeeds when… — brittle-locator — instrumentSelector (perpetualpage.ts:80)… — PR ? — verify ?
• Verify REDUCE_ONLY type orders can be placed… — brittle-locator — instrumentSelector (perpetualpage.ts:80)… — PR ? — verify ?
• Verify IOC type orders can be placed… — brittle-locator — instrumentSelector (perpetualpage.ts:80)… — PR ? — verify ?
• Verify FOK type orders can be placed… — brittle-locator — instrumentSelector (perpetualpage.ts:80)… — PR ? — verify ?
• Verify POST_ONLY type orders can be placed… — brittle-locator — instrumentSelector (perpetualpage.ts:80)… — PR ? — verify ?
• Verify the top-level navigation header… — assertion-wrong — headerNavPage.ts:405 asserts the… — PR ? — verify ?
• Verify MARKET order can be placed using… — brittle-locator — instrumentSelector (perpetualpage.ts:80)… — PR ? — verify ?
• Verify LIMIT order can be placed using… — brittle-locator — instrumentSelector (perpetualpage.ts:80)… — PR ? — verify ?
• Verify user can add margin to an Isolated… — brittle-locator — instrumentSelector (perpetualpage.ts:80)… — PR ? — verify ?
• Verify long position: in-profit SL trigger… — brittle-locator — clickIconInTable (perpetualpage.ts:1179)… — PR ? — verify ?
• Verify all records under the Recent Trades… — other — Never ran on its own: the… — PR ? — verify ?
• Verify Order-Book data is displayed as… — other — Never ran on its own: the… — PR ? — verify ?
• Verify trading chart candle-sticks are… — other — Never ran on its own: the… — PR ? — verify ?
• Verify Order-Book is not crossed (BEST_BID… — other — Never ran on its own: the… — PR ? — verify ?
• Verify editing a TP target trigger price… — race-condition — splitTPSL.spec.ts:224 reads the TP/SL… — PR ? — verify ?
• Verify data resets when a row is deleted or… — race-condition — splitTPSLPage.ts:305 asserts the… — PR ? — verify ?
• Verify Position TP/SL size matches the… — brittle-locator — clickIconInTable (perpetualpage.ts:1179)… — PR ? — verify ?
• Verify short position: TP trigger price must… — brittle-locator — clickIconInTable (perpetualpage.ts:1179)… — PR ? — verify ?
• Verify short position: in-profit SL trigger… — brittle-locator — clickIconInTable (perpetualpage.ts:1179)… — PR ? — verify ?
• Verify Split TP for Short position: trigger… — brittle-locator — clickIconInTable (perpetualpage.ts:1179)… — PR ? — verify ?
• Verify SL trigger type can be selected at… — brittle-locator — clickIconInTable (perpetualpage.ts:1179)… — PR ? — verify ?
• Verify open limit order can be cancelled… — brittle-locator — The Order price field is targeted as… — PR ? — verify ?
• Verify theme toggle, icons, and rendering… — other — Never ran on its own: the… — PR ? — verify ?

📈 Progress: iOS flows ?/12 · bug scenarios ?/15 · PRO bugs raised ?/5  (due 15/09, 27 days left)
❗ Blocker: iOS pipeline still not running
```

> The progress line reads "?" because `data/progress.json` does not exist. Create it as `{"iosFlows":0,"bugScenarios":0,"proBugs":0}` and update it as work lands — the format asks for progress against target in every post so 15/09 does not arrive as a surprise.

## 2.2 Message to the dev channel — one bug, one message

_No product bug to report today._

## 2.3 Gap analysis — bugs manual regression found that automation missed

_Nothing recorded. This is the QE-965 item that is easiest to skip and the best source of new coverage: for every bug manual regression found, say whether a test already covered it and why it did not catch it._

To record one, create `data/gap-analysis.json`:
```json
{ "items": [
  { "bugKey": "PRO-1234", "covered": true, "test": "Verify ...",
    "reason": "assertion only checked the element exists, not its value",
    "action": "tighten the assertion", "owner": "viet", "eta": "2026-08-20" }
] }
```

## 2.4 Escalate now, do not wait for standup

Raise these with Raj + team lead yourself — this tool does not send them:

- #qa-web-automation-staging has not had a single fully-green run in 3 days (10 runs, all red).
- "Verify button layout: overflow, overlap,…" has failed 16 runs in a row with no ticket and no quarantine decision.

## My tickets

| Ticket | What it is | Why it is here |
|---|---|---|
| QE-935 | Web & Mobile Test Stability | no deadline agreed |
| QE-965 | Automation Test Monitoring and Communication… | no deadline agreed |
| QE-966 | Trading module for WEB + MOBILE bug scenarios into… | no deadline agreed |

10 other tickets are open and on track.

