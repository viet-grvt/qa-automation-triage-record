#!/usr/bin/env node
/**
 * ingest.js — load run results from Slack dump files into data/state.json
 *
 * Usage:
 *   node tools/bin/ingest.js                       # reads data/raw/<today>/*.txt
 *   node tools/bin/ingest.js --dir data/raw/2026-08-18
 *   node tools/bin/ingest.js --channels web-prod,web-staging
 *   node tools/bin/ingest.js --json
 *
 * Each file in the directory must be named after the channel `key` in the config
 * (e.g. manual-automation.txt, web-prod.txt) and contain the verbatim `messages`
 * field returned by the Slack MCP `slack_read_channel` tool
 * (response_format: "detailed").
 *
 * This script is pure computation — it makes no network calls. Claude fetches the
 * data through the Slack MCP and writes it to disk first.
 */
import fs from "node:fs";
import path from "node:path";
import { parseChannel } from "../lib/parse-slack.js";
import {
  loadConfig,
  activeChannels,
  loadState,
  saveState,
  paths,
  normTitle,
  testKey,
  todayInTz,
} from "../lib/state.js";

const argv = process.argv.slice(2);
const getArg = (name, def = null) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : def;
};
const asJson = argv.includes("--json");

const cfg = loadConfig();
let _sel;
try {
  _sel = activeChannels(cfg, getArg("channels"));
} catch (e) {
  console.error(e.message);
  console.error("Valid keys: " + cfg.channels.map((c) => c.key).join(", "));
  process.exit(2);
}
const channels = _sel;
const today = getArg("date", todayInTz(cfg.timezone));
const dir = path.resolve(paths.root, getArg("dir", path.join("data", "raw", today)));

if (!channels.length) {
  console.error("No active channels. Enable one in config/channels.json or pass --channels.");
  process.exit(2);
}
if (!fs.existsSync(dir)) {
  console.error(
    `Dump directory not found: ${dir}\n` +
      `Read the Slack channels through MCP and write them to ${dir}/<channel-key>.txt first.`,
  );
  process.exit(2);
}

const state = loadState();
const summary = { date: today, dir, channels: [], warnings: [] };

for (const ch of channels) {
  const file = path.join(dir, `${ch.key}.txt`);
  if (!fs.existsSync(file)) {
    summary.warnings.push(`Missing dump for #${ch.name} (${path.relative(paths.root, file)})`);
    summary.channels.push({ key: ch.key, name: ch.name, missing: true });
    continue;
  }
  const raw = fs.readFileSync(file, "utf8");
  const { runs, skipped } = parseChannel(raw, ch);

  state.runs[ch.key] ||= [];
  const known = new Set(state.runs[ch.key].map((r) => r.ts));
  let added = 0;
  for (const r of runs) {
    if (r.ts && known.has(r.ts)) continue;
    state.runs[ch.key].push(r);
    known.add(r.ts);
    added++;
  }
  state.runs[ch.key].sort((a, b) => Number(a.ts || 0) - Number(b.ts || 0));
  // keep the 400 most recent runs per channel
  if (state.runs[ch.key].length > 400) {
    state.runs[ch.key] = state.runs[ch.key].slice(-400);
  }

  summary.channels.push({
    key: ch.key,
    name: ch.name,
    parsed: runs.length,
    added,
    total: state.runs[ch.key].length,
    skipped: skipped.length,
    latest: runs.at(-1)?.iso || state.runs[ch.key].at(-1)?.iso || null,
  });
  if (runs.some((r) => r.truncatedFailureList)) {
    summary.warnings.push(
      `#${ch.name}: a run had its failure list truncated by the reporter (>30 lines) — streaks may be incomplete.`,
    );
  }
}

rebuildTestStats(state);
saveState(state);

/**
 * Rebuild all per-test statistics from run history. Idempotent.
 *
 * Inference rule: Slack only lists FAILED tests. So in a trustworthy run (at least one
 * pass, not timed out, not a partial subset of the suite), every test previously seen in
 * that suite that is NOT in the failure list counts as a pass. Zero-pass, timed-out and
 * subset runs are excluded so an infrastructure blip cannot wipe out a real streak.
 */
function rebuildTestStats(state) {
  const prev = state.tests || {};
  const next = {};
  const bySuite = new Map();

  for (const [chKey, runs] of Object.entries(state.runs)) {
    for (const run of runs) {
      if (!bySuite.has(run.suiteKey)) bySuite.set(run.suiteKey, []);
      bySuite.get(run.suiteKey).push({ ...run, channelKey: run.channelKey || chKey });
    }
  }

  for (const [suiteKey, runs] of bySuite) {
    runs.sort((a, b) => Number(a.ts || 0) - Number(b.ts || 0));

    // Some runs execute only part of the suite (workflow_dispatch with --grep, 5 of 20
    // cases, ...). Those must not be used to infer passes — otherwise one green subset run
    // wipes out the streak of every test that is genuinely red.
    const sizes = runs
      .map((r) => (r.passed || 0) + (r.failed || 0))
      .filter((n) => n > 0)
      .sort((a, b) => a - b);
    const median = sizes.length ? sizes[Math.floor(sizes.length / 2)] : 0;
    for (const r of runs) {
      const size = (r.passed || 0) + (r.failed || 0);
      r.subset = median > 0 && size < median * 0.6;
    }

    const seen = new Map(); // normTitle -> record

    for (const run of runs) {
      const failedNow = new Set(run.failures.map(normTitle));

      for (const title of run.failures) {
        const n = normTitle(title);
        if (!seen.has(n)) {
          seen.set(n, {
            key: testKey(suiteKey, title),
            title,
            suiteKey,
            channelKey: run.channelKey,
            platform: run.platform,
            env: run.env,
            testType: run.testType,
            firstSeen: run.iso,
            history: [],
          });
        }
        const rec = seen.get(n);
        rec.title = title; // keep the most recent spelling
        rec.history.push({
          ts: run.ts,
          iso: run.iso,
          date: run.date,
          status: "fail",
          variant: run.variant,
          jobUrl: run.jobUrl,
          runId: run.runId || null,
          partial: !!run.partial,
        });
      }

      // never infer a pass from a broken or partial run
      if (run.partial || run.infra || run.subset) continue;
      for (const [n, rec] of seen) {
        if (failedNow.has(n)) continue;
        if (Number(run.ts) < Number(rec.history[0]?.ts || 0)) continue; // before the test existed
        rec.history.push({
          ts: run.ts,
          iso: run.iso,
          date: run.date,
          status: "pass",
          variant: run.variant,
        });
      }
    }

    for (const rec of seen.values()) {
      rec.history.sort((a, b) => Number(a.ts || 0) - Number(b.ts || 0));
      if (rec.history.length > 80) rec.history = rec.history.slice(-80);

      let streak = 0;
      for (let i = rec.history.length - 1; i >= 0; i--) {
        if (rec.history[i].status === "fail") streak++;
        else break;
      }
      let max = 0;
      let cur = 0;
      for (const h of rec.history) {
        if (h.status === "fail") max = Math.max(max, ++cur);
        else cur = 0;
      }

      const win = rec.history.slice(-10);
      rec.consecutiveFails = streak;
      rec.maxConsecutiveFails = max;
      rec.failCount = rec.history.filter((h) => h.status === "fail").length;
      rec.observed = rec.history.length;
      rec.failRate10 = win.length
        ? Math.round((win.filter((h) => h.status === "fail").length / win.length) * 1000) / 10
        : null;
      rec.lastSeen = rec.history.at(-1)?.iso || null;
      rec.lastFail = [...rec.history].reverse().find((h) => h.status === "fail")?.iso || null;
      rec.currentlyFailing = rec.history.at(-1)?.status === "fail";

      // Human judgement (label / ticket / quarantine / notes) survives every re-ingest.
      const old = prev[rec.key];
      if (old) {
        rec.label = old.label ?? null;
        rec.labelDate = old.labelDate ?? null;
        rec.note = old.note ?? null;
        rec.ticket = old.ticket ?? null;
        rec.quarantined = old.quarantined ?? false;
        rec.decisions = old.decisions ?? [];
        rec.rca = old.rca ?? null;
      } else {
        rec.label = null;
        rec.labelDate = null;
        rec.note = null;
        rec.ticket = null;
        rec.quarantined = false;
        rec.decisions = [];
        rec.rca = null;
      }
      next[rec.key] = rec;
    }
  }

  // Keep older tests that already carry a decision even if they fell out of the run window.
  for (const [k, old] of Object.entries(prev)) {
    if (!next[k] && (old.label || old.ticket || old.quarantined)) {
      next[k] = { ...old, currentlyFailing: false, stale: true };
    }
  }
  state.tests = next;
}

if (asJson) {
  console.log(JSON.stringify(summary, null, 2));
} else {
  console.log(`Ingest ${summary.date}  (${path.relative(paths.root, dir)})`);
  for (const c of summary.channels) {
    if (c.missing) {
      console.log(`  ! ${c.name.padEnd(30)} DUMP MISSING`);
      continue;
    }
    console.log(
      `  · ${c.name.padEnd(30)} parsed=${String(c.parsed).padStart(3)} new=${String(c.added).padStart(3)} total=${String(c.total).padStart(4)} latest=${c.latest || "-"}`,
    );
  }
  const failing = Object.values(state.tests).filter((t) => t.currentlyFailing).length;
  console.log(
    `  → ${Object.keys(state.tests).length} tests with failure history, ${failing} currently red.`,
  );
  for (const w of summary.warnings) console.log(`  ! ${w}`);
}
