#!/usr/bin/env node
/**
 * track.js — follow a fix from "we decided what to do" to "it is actually fixed".
 *
 * Classifying a failure is not the end of it. The checklist asks for the fix to be *tracked*, and
 * the common failure mode is a test that was labelled on Monday, assigned to someone, and still
 * red on Friday with nobody noticing. This is the list that makes that visible.
 *
 *   node tools/bin/track.js                       # everything currently being tracked
 *   node tools/bin/track.js --overdue             # only what is past its ETA or gone quiet
 *   node tools/bin/track.js --test "..." --channel web-staging --status in-review --pr <url>
 *   node tools/bin/track.js --test "..." --channel web-staging --verify --run 32098546549
 *
 * Statuses: open → in-review → merged → verified.  (wont-fix closes it without a fix.)
 *
 * `--verify` refuses to close anything that is still failing. A fix is verified by a green run,
 * not by a merged PR — that distinction is the whole point of tracking it.
 */
import { loadState, saveState, loadConfig, normTitle, todayInTz } from "../lib/state.js";

const argv = process.argv.slice(2);
const has = (n) => argv.includes(`--${n}`);
const getArg = (n, d = null) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : d;
};

const cfg = loadConfig();
const state = loadState();
const today = todayInTz(cfg.timezone);
const STATUSES = ["open", "in-review", "merged", "verified", "wont-fix"];

const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);

/** Everything with a verdict on it is tracked until it is verified or written off. */
function tracked() {
  return Object.values(state.tests)
    .filter((t) => t.label || t.ticket || t.quarantined)
    .filter((t) => !["verified", "wont-fix"].includes(t.fix?.status))
    .sort((a, b) => (b.consecutiveFails || 0) - (a.consecutiveFails || 0));
}

function ageOf(t) {
  const started = t.fix?.opened || t.labelDate || t.rca?.date || null;
  return started ? daysBetween(started, today) : null;
}

/** What is wrong with this item right now, in the order it matters. */
function problems(t) {
  const out = [];
  const age = ageOf(t);
  if (t.eta && Date.parse(t.eta) < Date.parse(today) && t.currentlyFailing) {
    out.push(`ETA ${t.eta} has passed and it is still failing`);
  }
  if (!t.owner) out.push("nobody owns it");
  if (!t.eta) out.push("no ETA");
  if (t.label === "APP-BUG" && !t.ticket) out.push("no ticket raised — the dev team has nothing to pick up");
  if (t.label === "SCRIPT" && !t.rca) out.push("no root cause recorded — run /script-rca");
  if (t.fix?.status === "merged" && t.currentlyFailing) out.push("PR is merged but the test is still red — the fix did not work");
  if (age != null && age >= 5 && (t.fix?.status || "open") === "open") out.push(`open for ${age} days with no PR`);
  if (t.quarantined && !t.rca?.reviewDate) out.push("quarantined with no review date — that is a deleted test");
  return out;
}

if (!getArg("test")) {
  const list = tracked();
  const rows = has("overdue") ? list.filter((t) => problems(t).length) : list;
  if (!rows.length) {
    console.log(has("overdue") ? "Nothing is overdue. ✅" : "Nothing is being tracked — no failure has a verdict yet.");
    process.exit(0);
  }
  const byStatus = new Map();
  for (const t of rows) {
    const st = t.fix?.status || "open";
    if (!byStatus.has(st)) byStatus.set(st, []);
    byStatus.get(st).push(t);
  }
  for (const st of STATUSES) {
    const group = byStatus.get(st);
    if (!group?.length) continue;
    console.log(`\n${st.toUpperCase()} — ${group.length}`);
    for (const t of group) {
      const age = ageOf(t);
      console.log(
        `  [${t.label || "?"}] ${t.channelKey} — ${t.title}` +
          `\n      ${t.currentlyFailing ? `red ${t.consecutiveFails} run(s)` : "green again"}` +
          ` · owner ${t.owner || "⚠️ none"} · ETA ${t.eta || "⚠️ none"}` +
          `${t.ticket ? ` · ${t.ticket}` : ""}${t.fix?.pr ? ` · ${t.fix.pr}` : ""}${age != null ? ` · ${age}d old` : ""}`,
      );
      for (const p of problems(t)) console.log(`      ⚠️ ${p}`);
    }
  }
  const stuck = rows.filter((t) => problems(t).length);
  console.log(
    `\n${rows.length} item(s) tracked, ${stuck.length} need attention today.` +
      (stuck.length ? " Run with --overdue to see only those." : ""),
  );
  process.exit(0);
}

// ---------------------------------------------------------------- update one item
const title = getArg("test");
const channel = getArg("channel");
const n = normTitle(title);
const matches = Object.values(state.tests).filter(
  (t) => normTitle(t.title) === n && (!channel || t.channelKey === channel),
);
if (!matches.length) {
  console.error(`No test matching "${title}"${channel ? ` in ${channel}` : ""}.`);
  process.exit(1);
}
if (matches.length > 1 && !channel) {
  console.error(`That title exists in ${matches.length} channels — add --channel:`);
  for (const t of matches) console.error(`  - ${t.channelKey}`);
  process.exit(1);
}

const status = getArg("status");
if (status && !STATUSES.includes(status)) {
  console.error(`--status must be one of: ${STATUSES.join(", ")}`);
  process.exit(2);
}

for (const t of matches) {
  t.fix = { status: "open", opened: t.labelDate || today, ...(t.fix || {}) };
  if (getArg("pr")) {
    t.fix.pr = getArg("pr");
    if (!status && t.fix.status === "open") t.fix.status = "in-review";
  }
  if (getArg("note")) t.fix.note = getArg("note");
  if (status) t.fix.status = status;
  if (status === "merged") t.fix.merged = today;

  if (has("verify")) {
    // A merged PR is not a fix. Only a green run is.
    if (t.currentlyFailing) {
      console.error(
        `✖ ${t.title}\n  Still failing (${t.consecutiveFails} run(s) in a row). A fix is verified by a green run, not by a merged PR — re-run the suite and try again once it passes.`,
      );
      process.exit(1);
    }
    t.fix.status = "verified";
    t.fix.verifiedDate = today;
    if (getArg("run")) t.fix.verifiedRun = getArg("run");
    if (t.quarantined && !has("keep-quarantined")) {
      t.quarantined = false;
      console.log(`  quarantine lifted — the test is green again`);
    }
  }

  console.log(`✔ [${t.channelKey}] ${t.title}\n  → ${t.fix.status}${t.fix.pr ? ` · ${t.fix.pr}` : ""}${t.fix.verifiedDate ? ` · verified ${t.fix.verifiedDate}` : ""}`);
  for (const p of problems(t)) console.log(`  ⚠️ ${p}`);
}

saveState(state);
