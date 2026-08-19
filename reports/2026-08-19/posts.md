# Messages ready to post — 19/08/2026

One file below is one message for one thread. Review, then post. Nothing is sent automatically.

The triage record is cut **one file per suite** — smoke and regression are separate CI jobs posted as separate Slack messages, so each goes into its own run thread. Each file contains only that suite's failures. There is no whole-day record to post; `triage.md` is your own working copy.

No record written for #qa-web-automation-prod · smoke, #qa-web-automation-testnet · smoke, #qa-mobile-automation-testnet · long-running, #qa-mobile-automation-testnet · manual, #qa-mobile-automation-testnet · smoke — nothing failed there.

| Section | Message | Goes to | Status |
|---|---|---|---|
| 1.1–1.6 | [Triage record — #qa-web-automation-testnet · regression](posts/1-triage-web-testnet-regression.md) | #qa-web-automation-testnet — thread of the regression run at 04:18 | ready |
| 1.1–1.6 | [Triage record — #qa-web-automation-staging · smoke](posts/1-triage-web-staging-smoke.md) | #qa-web-automation-staging — thread of the smoke run at 06:25 | ready |
| 2.1 | [Daily standup post](posts/2.1-standup.md) | #qa-manual-automation  ⚠️ destination not confirmed | ready |

Section 2.4 (escalation) is deliberately not turned into a message — it stays in the report for you to raise yourself.

⚠️ The standup destination (#qa-manual-automation) is not confirmed yet. Confirm it in `config/channels.json` and set `"confirmed": true` before the first send.
