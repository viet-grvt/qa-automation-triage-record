# Block 2 — Standup & communication, 18/08

## 2.1 Daily standup post (QA channel)

Paste as-is. Anyone who wants detail opens the Block 1 record.

```
🧪 QA Automation Daily — 18/08

Green runs: PROD ⚠️ 11/12 · TESTNET ⚠️ 2/5 · STAGING 🔴 0/2 · TESTNET ✅ 3/3 · iOS ❌ not run
Fails: 8 → ENV 0 · APP 0 · SCRIPT 3 · unclassified 5
Smoke accuracy: 🔴 breached — script failure on smoke: Verify Trade-Indicators data for all…, Verify Trade-Indicators data for all…

🔧 Scripts fixed today
• Verify Trade-Indicators data for all… — other — Same rate limit as testnet:… — PR ? — verify ?
• Verify Trade-Indicators data for all… — other — The test walks every instrument across… — PR ? — verify ?
• Verify deposit progress is rejected when… — brittle-locator — The receiveValue locator matched the… — PR ? — verify ?

📈 Progress: iOS flows ?/12 · bug scenarios ?/15 · PRO bugs raised ?/5  (due 15/09, 28 days left)
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

- #qa-web-automation-staging has not had a single fully-green run in 3 days (12 runs, all red).
- "Verify button layout: overflow, overlap,…" has failed 12 runs in a row with no ticket and no quarantine decision.

## My tickets

| Ticket | What it is | Why it is here |
|---|---|---|
| QE-812 | Capture network response logs during smoke test… | not started for 25 days |
| QE-829 | Implement automation for TP/SL trigger validation | not started for 21 days |
| QE-828 | Implement automation for split TP/SL | not started for 21 days |
| QE-827 | Implement automation for export history | not started for 21 days |
| QE-826 | Implement automation for CEV Ungated | not started for 21 days |
| QE-935 | Web & Mobile Test Stability | no deadline agreed |

Plus 2 more with the same flags.

4 other tickets are open and on track.

