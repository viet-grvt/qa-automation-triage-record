#!/usr/bin/env node
/**
 * daily.js — the whole morning in three commands instead of eight.
 *
 * The steps have a real order and real dependencies, and the two that were easiest to forget were
 * the two that silently broke the chain: classification has to happen before /script-rca (which
 * only looks at tests already labelled SCRIPT), and report.js has to run again afterwards or the
 * files in posts/ still show yesterday's state. Both are now inside a phase.
 *
 *   node tools/bin/daily.js              # phase 1: ingest → report → what needs a decision
 *   node tools/bin/daily.js --finish     # phase 2: script-rca → report → what is ready to post
 *   node tools/bin/daily.js --close      # phase 3: sign off the window, check coverage
 *
 * Phase 1 stops at the judgement. Phase 2 runs after the failures have been classified. Phase 3
 * runs after the replies have actually been posted — never before, because signing off a report
 * nobody read marks the night's failures as handled.
 */
import { execFileSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { loadConfig, loadState, paths, todayInTz } from "../lib/state.js";
import { isBusinessDay } from "../lib/sla.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const has = (n) => argv.includes(`--${n}`);
const passthrough = argv.filter((a, i) => {
  if (["--finish", "--close"].includes(a)) return false;
  const prev = argv[i - 1];
  return a.startsWith("--") || ["--channels", "--date", "--window"].includes(prev);
});

const cfg = loadConfig();
const date = (() => {
  const i = argv.indexOf("--date");
  return i >= 0 && argv[i + 1] ? argv[i + 1] : todayInTz(cfg.timezone);
})();

function run(script, args = [], { quiet = false } = {}) {
  try {
    const out = execFileSync(process.execPath, [path.join(here, script), ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    if (!quiet) process.stdout.write(out);
    return out;
  } catch (e) {
    // The child scripts already explain themselves. Wrapping that in a Node stack trace buries the
    // sentence that says what to do next, which is the only part worth reading.
    const said = `${e.stdout || ""}${e.stderr || ""}`.trim();
    console.error(said || `${script} failed with no output.`);
    console.error(`\nStopped at ${script}. Nothing after this step ran.`);
    process.exit(e.status || 1);
  }
}

const rule = (n) => console.log(`\n${"─".repeat(72)}\n${n}\n${"─".repeat(72)}`);

// ---------------------------------------------------------------- phase 3
if (has("close")) {
  rule("Sign off");
  run("report.js", [...passthrough, "--mark-checked"], { quiet: true })
    .split("\n")
    .filter((l) => l.startsWith("✔") || l.startsWith("Nothing to sign off"))
    .forEach((l) => console.log(l));
  rule("Coverage");
  run("triage-log.js", ["--today", "--date", date]);
  rule("Still open");
  run("triage-log.js", ["--overdue"]);
  process.exit(0);
}

// ---------------------------------------------------------------- phase 2
if (has("finish")) {
  rule("Root cause for the SCRIPT failures");
  run("script-rca.js", ["--date", date]);
  rule("Rebuilding the report and the messages");
  run("report.js", passthrough, { quiet: true });
  console.log(`Rewrote reports/${date}/ — triage.md, standup.md, posts/, records/.`);

  const idx = path.join(paths.reports, date, "posts.md");
  if (fs.existsSync(idx)) {
    rule("Ready to post");
    const rows = fs
      .readFileSync(idx, "utf8")
      .split("\n")
      .filter((l) => l.startsWith("| ") && !l.startsWith("| Section") && !l.startsWith("|---"));
    const ready = rows.filter((l) => l.trim().endsWith("| ready |"));
    const blocked = rows.filter((l) => !l.trim().endsWith("| ready |"));
    console.log(`${ready.length} message(s) ready, ${blocked.length} held back.`);
    for (const b of blocked) {
      const c = b.split("|").map((x) => x.trim());
      console.log(`  ⚠️ ${c[2].replace(/\[(.*?)\].*/, "$1")} — ${c[5]}`);
    }
    console.log(`\nFull list: reports/${date}/posts.md`);
  }
  console.log(`\nNothing has been sent. Review, post, record each reply ts, then: node tools/bin/daily.js --close`);
  process.exit(0);
}

// ---------------------------------------------------------------- phase 1
if (!isBusinessDay(date)) {
  console.log(`⚠️ ${date} is a weekend. Triage is expected Mon–Fri; continuing anyway.\n`);
}

rule("Ingest");
run("ingest.js", passthrough);

rule("Report");
run("report.js", passthrough, { quiet: true });
console.log(`Wrote reports/${date}/ — triage.md, standup.md, log-row.md, posts/, records/.`);

rule("Yesterday first");
run("triage-log.js", ["--overdue", "--limit", "5"]);

rule("Fixes still open");
run("track.js", ["--overdue"]);

rule("Needs a decision");
const state = loadState();
// What blocks a reply is a failure named in a red run that has not been answered yet — not
// "currently failing". A test that failed on Saturday and passes today still has to be categorised
// before Saturday's reply can go out, and counting only current failures hid exactly that.
const norm = (s) => String(s).toLowerCase().replace(/\s+/g, " ").trim();
const byTitle = new Map();
for (const t of Object.values(state.tests)) {
  byTitle.set(`${t.channelKey}|${t.testType}|${norm(t.title)}`, t);
}
const log = state.triageLog || {};
const pendingMap = new Map();
for (const runs of Object.values(state.runs || {})) {
  for (const r of runs) {
    if (r.green) continue;
    if (log[`run:${r.runId}`]?.triagedIso || log[`ts:${r.channelKey}:${r.ts}`]?.triagedIso) continue;
    for (const f of r.failures) {
      const t = byTitle.get(`${r.channelKey}|${r.testType}|${norm(f)}`);
      if (t && !t.label) pendingMap.set(t.key || `${r.channelKey}|${norm(f)}`, t);
    }
  }
}
const pending = [...pendingMap.values()];
if (!pending.length) {
  console.log(
    "Every failure in every unanswered red run has a category. ✅\n" +
      "That is not the same as every red run having a reply — see 'Yesterday first' above.",
  );
} else {
  console.log(
    `${pending.length} failure(s) with no category, across the red runs still waiting for a reply.\n` +
      `Nothing downstream works until these are decided — /script-rca only looks at tests already\n` +
      `labelled SCRIPT, and a reply is held back while any failure in its run is uncategorised.\n`,
  );
  const bySuite = new Map();
  for (const t of pending) {
    const k = `${t.channelKey}:${t.testType}`;
    if (!bySuite.has(k)) bySuite.set(k, []);
    bySuite.get(k).push(t);
  }
  for (const [k, list] of [...bySuite].sort()) {
    console.log(`  ${k} — ${list.length}`);
    for (const t of list.slice(0, 4)) console.log(`      ${t.title.slice(0, 88)}`);
    if (list.length > 4) console.log(`      … and ${list.length - 4} more`);
  }
  console.log(
    `\nOpen the run log before deciding — the category is in the error message, not in the pass/fail rhythm:\n` +
      `  gh run view <runId> --log-failed -R ${cfg.repoSlug} | tail -120\n` +
      `Then record each one with classify.js, and run: node tools/bin/daily.js --finish`,
  );
}
