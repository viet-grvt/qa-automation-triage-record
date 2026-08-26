#!/usr/bin/env node
/**
 * triage-log.js — the record QE-964 is actually measured on.
 *
 * The acceptance criteria are about *red runs*, not tests: every red run triaged within one
 * business day, verifiable from Slack thread timestamps, three consecutive weeks, zero stragglers
 * at each weekly checkpoint. That is a different question from "is this test classified", so it
 * gets its own log.
 *
 *   node tools/bin/triage-log.js                      # red runs and where they stand
 *   node tools/bin/triage-log.js --overdue            # only what has missed or is about to
 *   node tools/bin/triage-log.js --weeks 3            # the acceptance-criteria checkpoint
 *   node tools/bin/triage-log.js --record --run 32775685614 --reply-ts 1787620999.001
 *
 * `--record` is called after the classification reply has actually been posted to the thread, with
 * the ts Slack returns. The ts is the evidence: it is what makes the claim checkable by someone
 * who does not trust this tool.
 */
import { loadConfig, loadState, saveState, todayInTz } from "../lib/state.js";
import { slaStatus, runKey, weekStart, localParts, isBusinessDay } from "../lib/sla.js";
import { prettyDate } from "../lib/plain.js";

const argv = process.argv.slice(2);
const has = (n) => argv.includes(`--${n}`);
const getArg = (n, d = null) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : d;
};

const cfg = loadConfig();
const state = loadState();
const tz = cfg.timezone;
const today = todayInTz(tz);
state.triageLog = state.triageLog || {};

/** Every red run across the active channels, oldest first. */
function redRuns() {
  const out = [];
  for (const runs of Object.values(state.runs || {})) {
    for (const r of runs) if (!r.green) out.push(r);
  }
  return out.sort((a, b) => Number(a.ts) - Number(b.ts));
}

const label = (r) => `${r.channelName || r.channelKey} · ${r.testType} ${r.iso.slice(11, 16)} ${prettyDate(r.iso)}`;

// ---------------------------------------------------------------- record a posted reply
if (has("record")) {
  const runId = getArg("run");
  const ts = getArg("ts"); // message ts, when there is no runId
  if (!runId && !ts) {
    console.error("Required: --run <runId>  (or --ts <message ts> for runs without one)");
    process.exit(2);
  }
  const run = redRuns().find((r) => (runId ? r.runId === runId : r.ts === ts));
  if (!run) {
    console.error(`No red run found for ${runId ? `run ${runId}` : `ts ${ts}`}. Is it green, or not ingested yet?`);
    process.exit(1);
  }
  const key = runKey(run);
  const replyTs = getArg("reply-ts");
  state.triageLog[key] = {
    ...(state.triageLog[key] || {}),
    channelKey: run.channelKey,
    testType: run.testType,
    runIso: run.iso,
    threadTs: run.ts,
    replyTs: replyTs || null,
    // The reply's own timestamp is the truth. Fall back to now only when it was posted by hand.
    triagedIso: replyTs ? new Date(Number(replyTs) * 1000).toISOString() : new Date().toISOString(),
    categories: getArg("categories") || null,
  };
  saveState(state);
  const s = slaStatus(run, state.triageLog[key], tz, today);
  console.log(`✔ ${label(run)}`);
  console.log(`  posted ${s.posted} · due ${s.due} · triaged ${s.done} → ${s.status}${s.lateBy ? ` by ${s.lateBy} business day(s)` : ""}`);
  if (!replyTs) {
    console.log(`  ⚠️ no --reply-ts recorded. The acceptance criteria are verified from Slack thread timestamps, so record it.`);
  }
  process.exit(0);
}

// ---------------------------------------------------------------- daily coverage
// "Daily failure triage" is a habit, and a habit is measured by the days it was kept. A working
// day with no message at all in a channel is a gap even when nothing failed — from outside the
// channel, "all green" and "nobody looked" are indistinguishable.
if (has("today") || has("coverage")) {
  const day = getArg("date", today);
  if (!isBusinessDay(day)) {
    console.log(`${day} is not a working day — no triage expected.`);
    process.exit(0);
  }
  const suites = new Map();
  for (const runs of Object.values(state.runs || {})) {
    for (const r of runs) {
      const id = `${r.channelKey}:${r.testType}`;
      if (!suites.has(id)) suites.set(id, []);
      suites.get(id).push(r);
    }
  }
  console.log(`Triage coverage for ${day}
`);
  let gaps = 0;
  for (const [id, runs] of [...suites].sort()) {
    const dayRuns = runs.filter((r) => r.iso.slice(0, 10) === day);
    const red = dayRuns.filter((r) => !r.green);
    const answered = red.filter((r) => state.triageLog[runKey(r)]?.triagedIso).length;
    const daysActive = new Set(runs.map((r) => r.iso.slice(0, 10))).size;
    if (!dayRuns.length) {
      if (daysActive >= 3) {
        console.log(`  ⚠️ ${id.padEnd(34)} no run at all today — check the schedule`);
        gaps++;
      }
      continue;
    }
    if (!red.length) {
      console.log(`  ✅ ${id.padEnd(34)} ${dayRuns.length} run(s), all green`);
      continue;
    }
    const ok = answered === red.length;
    if (!ok) gaps++;
    console.log(
      `  ${ok ? "✅" : "❌"} ${id.padEnd(34)} ${red.length} red run(s), ${answered} answered`,
    );
  }
  console.log(gaps ? `
${gaps} gap(s) on ${day}.` : `
Every suite is accounted for on ${day}. ✅`);
  process.exit(0);
}

// ---------------------------------------------------------------- weekly checkpoint
if (has("weeks")) {
  const n = Number(getArg("weeks", "3"));
  const runs = redRuns();
  const weeks = new Map();
  for (const r of runs) {
    const wk = weekStart(localParts(r.iso, tz).date);
    if (!weeks.has(wk)) weeks.set(wk, []);
    weeks.get(wk).push(r);
  }
  const recent = [...weeks.entries()].sort().slice(-n);
  if (!recent.length) {
    console.log("No red runs on record yet.");
    process.exit(0);
  }
  let streak = 0;
  console.log(`QE-964 checkpoint — last ${recent.length} week(s)\n`);
  for (const [wk, group] of recent) {
    const states = group.map((r) => slaStatus(r, state.triageLog[runKey(r)], tz, today));
    const late = states.filter((s) => s.status === "triaged-late").length;
    const open = states.filter((s) => s.status === "overdue").length;
    const pending = states.filter((s) => s.status === "due").length;
    const clean = !late && !open;
    if (clean && !pending) streak++;
    else streak = 0;
    console.log(
      `  week of ${wk}: ${group.length} red run(s) — ${states.filter((s) => s.status === "triaged-on-time").length} on time` +
        `${late ? `, ${late} late` : ""}${open ? `, ${open} still untriaged and overdue` : ""}${pending ? `, ${pending} still within the window` : ""}` +
        `  ${clean && !pending ? "✅" : "❌"}`,
    );
    for (const [i, s] of states.entries()) {
      if (s.status === "triaged-on-time") continue;
      console.log(`      ${s.status === "overdue" ? "❌" : s.status === "late" ? "⏰" : "…"} ${label(group[i])} — due ${s.due}${s.done ? `, triaged ${s.done}` : ", not triaged"}`);
    }
  }
  console.log(
    `\n${streak} consecutive clean week(s). The criterion is 3.` +
      (streak >= 3 ? " ✅ met." : " Not met yet — a week only counts once every red run in it has a reply."),
  );
  process.exit(0);
}

// ---------------------------------------------------------------- the standing list
const runs = redRuns();
if (!runs.length) {
  console.log("No red runs on record. Nothing to triage.");
  process.exit(0);
}
const rows = runs
  .map((r) => ({ r, s: slaStatus(r, state.triageLog[runKey(r)], tz, today) }))
  .filter((x) => (has("overdue") ? ["overdue", "due"].includes(x.s.status) : true));

if (!rows.length) {
  console.log("Every red run has a classification reply. ✅");
  process.exit(0);
}
const icon = { "triaged-on-time": "✅", "triaged-late": "⏰", due: "…", overdue: "❌" };
// A daily wrapper wants the shape of the backlog, not sixteen paragraphs of it.
const limit = Number(getArg("limit", "0")) || rows.length;
const shown = rows.slice(0, limit);
for (const { r, s } of shown) {
  console.log(
    `${icon[s.status]} ${label(r)} — ${r.failed} failed / ${r.passed} passed` +
      `\n     due ${s.due}${s.done ? ` · triaged ${s.done}` : " · NOT TRIAGED"}${s.lateBy ? ` · ${s.lateBy} business day(s) late` : ""}` +
      `${r.runId ? `\n     node tools/bin/triage-log.js --record --run ${r.runId} --reply-ts <ts from Slack>` : ""}`,
  );
}
if (shown.length < rows.length) console.log(`     … and ${rows.length - shown.length} more (drop --limit to see all)`);
const overdue = rows.filter((x) => x.s.status === "overdue").length;
const due = rows.filter((x) => x.s.status === "due").length;
console.log(
  `\n${rows.length} red run(s) listed — ${overdue} overdue, ${due} still inside the 1-business-day window.`,
);
if (overdue) console.log(`Overdue runs break the QE-964 acceptance criteria for this week.`);
