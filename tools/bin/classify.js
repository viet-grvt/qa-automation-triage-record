#!/usr/bin/env node
/**
 * classify.js — record the verdict for a failing test (ENV / APP-BUG / SCRIPT).
 * Verdicts survive every subsequent ingest.
 *
 *   node tools/bin/classify.js --test "Verify each download card..." --channel web-staging \
 *        --label APP-BUG --ticket PRO-9001 --note "CDN link changed, FE not updated"
 *   node tools/bin/classify.js --test "..." --channel web-staging --label SCRIPT --quarantine
 *   node tools/bin/classify.js --list       # every red test with its current label
 *   node tools/bin/classify.js --pending    # only the ones with no label yet
 *   node tools/bin/classify.js --incomplete # labelled but missing owner/ETA or the APP-BUG fields
 *
 * Every row in the Block 1 classification table needs an owner and an ETA — the format treats a
 * row without them as triage that has not finished. APP-BUG rows additionally need the fields the
 * dev-channel message is built from.
 *
 *   --owner <name> --eta <YYYY-MM-DD>
 *   APP-BUG extras: --team <fe|mobile|backend|...> --severity <...> --impact "..."
 *                   --evidence <url> --repro "steps" | --repro-automation-only
 */
import { loadState, saveState, normTitle, todayInTz, loadConfig } from "../lib/state.js";

const argv = process.argv.slice(2);
const has = (n) => argv.includes(`--${n}`);
const getArg = (n, d = null) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : d;
};

const cfg = loadConfig();
const state = loadState();
const VALID = ["ENV", "APP-BUG", "SCRIPT"];

/** What the Block 1 format requires before a row counts as fully triaged. */
function missingFields(t) {
  const out = [];
  if (!t.owner) out.push("owner");
  if (!t.eta) out.push("eta");
  if (t.label === "APP-BUG") {
    if (!t.ticket) out.push("PRO ticket");
    if (!t.appbug?.team) out.push("team");
    if (!t.appbug?.impact) out.push("impact");
    if (!t.appbug?.evidence) out.push("evidence");
  }
  if (t.label === "SCRIPT" && !t.rca) out.push("root cause (run /script-rca)");
  return out;
}

if (has("list") || has("pending")) {
  const rows = Object.values(state.tests)
    .filter((t) => t.currentlyFailing && !t.stale)
    .filter((t) => (has("pending") ? !t.label : true))
    .sort((a, b) => b.consecutiveFails - a.consecutiveFails);
  if (!rows.length) {
    console.log(has("pending") ? "No unlabelled failures left." : "Nothing is currently red.");
    process.exit(0);
  }
  for (const t of rows) {
    console.log(
      `[${(t.label || "unlabelled").padEnd(10)}] streak=${String(t.consecutiveFails).padStart(2)} ${t.channelKey.padEnd(18)} ${t.title}${t.ticket ? `  (${t.ticket})` : ""}${t.quarantined ? "  [quarantined]" : ""}${t.label === "SCRIPT" && !t.rca ? "  [no RCA]" : ""}${missingFields(t).length ? `  [missing: ${missingFields(t).join(",")}]` : ""}`,
    );
  }
  process.exit(0);
}

if (has("incomplete")) {
  const rows = Object.values(state.tests)
    .filter((t) => t.currentlyFailing && !t.stale && t.label)
    .map((t) => ({ t, missing: missingFields(t) }))
    .filter((r) => r.missing.length);
  if (!rows.length) {
    console.log("Every classified failure has an owner, an ETA and its required fields. ✅");
    process.exit(0);
  }
  for (const { t, missing } of rows) {
    console.log(`[${t.label}] ${t.channelKey} — ${t.title}`);
    console.log(`   missing: ${missing.join(", ")}`);
  }
  console.log(`
${rows.length} row(s) would show as incomplete in the Block 1 table.`);
  process.exit(0);
}

const title = getArg("test");
const channel = getArg("channel");
const label = getArg("label");
if (!title || !label) {
  console.error(
    'Required: --test "<test title>" --label <ENV|APP-BUG|SCRIPT>  (add --channel when the title exists in more than one channel)',
  );
  process.exit(2);
}
if (!VALID.includes(label)) {
  console.error(`--label must be one of: ${VALID.join(", ")}`);
  process.exit(2);
}

const n = normTitle(title);
const matches = Object.values(state.tests).filter(
  (t) => normTitle(t.title) === n && (!channel || t.channelKey === channel),
);
if (!matches.length) {
  const near = Object.values(state.tests)
    .filter((t) => normTitle(t.title).includes(n.slice(0, 25)))
    .slice(0, 5);
  console.error(`No test matching "${title}"${channel ? ` in ${channel}` : ""}.`);
  if (near.length) {
    console.error("Did you mean:");
    for (const t of near) console.error(`  - [${t.channelKey}] ${t.title}`);
  }
  process.exit(1);
}
if (matches.length > 1 && !channel) {
  console.error(`That title exists in ${matches.length} channels — add --channel:`);
  for (const t of matches) console.error(`  - ${t.channelKey}`);
  process.exit(1);
}

const today = todayInTz(cfg.timezone);
for (const t of matches) {
  t.label = label;
  t.labelDate = today;
  if (getArg("note")) t.note = getArg("note");
  if (getArg("ticket")) t.ticket = getArg("ticket");
  if (has("quarantine")) t.quarantined = true;
  if (has("unquarantine")) t.quarantined = false;
  if (getArg("owner")) t.owner = getArg("owner");
  if (getArg("eta")) t.eta = getArg("eta");
  if (label === "APP-BUG") {
    t.appbug = {
      ...(t.appbug || {}),
      ...(getArg("team") ? { team: getArg("team") } : {}),
      ...(getArg("severity") ? { severity: getArg("severity") } : {}),
      ...(getArg("impact") ? { impact: getArg("impact") } : {}),
      ...(getArg("evidence") ? { evidence: getArg("evidence") } : {}),
      ...(getArg("symptom") ? { symptom: getArg("symptom") } : {}),
      ...(getArg("repro") ? { repro: getArg("repro") } : {}),
      ...(has("repro-automation-only") ? { repro: "automation run only — not reproduced by hand" } : {}),
      ...(has("prod-leak") ? { prodLeak: true } : {}),
    };
  }
  t.decisions = [
    ...(t.decisions || []),
    {
      date: today,
      label,
      note: getArg("note") || null,
      ticket: getArg("ticket") || null,
      quarantined: t.quarantined,
      streakAtDecision: t.consecutiveFails,
    },
  ];
  console.log(
    `✔ [${t.channelKey}] ${t.title}\n  → ${label}${t.ticket ? ` · ${t.ticket}` : ""}${t.quarantined ? " · quarantined" : ""}${t.note ? `\n  note: ${t.note}` : ""}`,
  );
  const gaps = missingFields(t);
  if (gaps.length) console.log(`  still missing for the Block 1 table: ${gaps.join(", ")}`);
}

saveState(state);

const left = Object.values(state.tests).filter((t) => t.currentlyFailing && !t.stale && !t.label).length;
const incomplete = Object.values(state.tests).filter(
  (t) => t.currentlyFailing && !t.stale && t.label && missingFields(t).length,
).length;
console.log(left ? `${left} failure(s) still unlabelled.` : "Every failure today has a verdict. ✅");
if (incomplete) console.log(`${incomplete} classified row(s) still incomplete — run --incomplete to list them.`);
