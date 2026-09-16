#!/usr/bin/env node
/**
 * ingest.js — load run results from Slack dump files into data/state.json
 *
 * Usage:
 *   node tools/bin/ingest.js                       # reads data/raw/<today>/*.txt
 *   node tools/bin/ingest.js --dir data/raw/2026-08-18
 *   node tools/bin/ingest.js --channels web-prod,web-staging
 *   node tools/bin/ingest.js --all                 # re-read every data/raw/<date>/ ever stored
 *   node tools/bin/ingest.js --json
 *
 * `--all` re-parses the whole archive and rebuilds history from scratch. Use it after the parser
 * changes — stored runs were parsed by the *old* parser, so a header format the old one misread
 * stays misread until the archive is read again. Human judgement (labels, tickets, owners, root
 * causes) is keyed by test and survives it.
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
import { mergeParts } from "../lib/merge-runs.js";
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
const rebuildAll = argv.includes("--all");
const rawRoot = path.resolve(paths.root, "data", "raw");
const dirs = rebuildAll
  ? fs
      .readdirSync(rawRoot, { withFileTypes: true })
      .filter((d) => d.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(d.name))
      .map((d) => path.join(rawRoot, d.name))
      .sort()
  : [path.resolve(paths.root, getArg("dir", path.join("data", "raw", today)))];
const dir = dirs.at(-1);

if (!channels.length) {
  console.error("No active channels. Enable one in config/channels.json or pass --channels.");
  process.exit(2);
}
for (const d of dirs) {
  if (fs.existsSync(d)) continue;
  console.error(
    `Dump directory not found: ${d}\n` +
      `Read the Slack channels through MCP and write them to ${d}/<channel-key>.txt first.`,
  );
  process.exit(2);
}

const state = loadState();
migrateToMessages(state);
const summary = { date: today, dir, dirs: dirs.length, channels: [], warnings: [] };

// `--all` re-parses the archive, so the messages it is about to replace must go first: keeping them
// would leave every run the old parser misread sitting alongside its corrected twin.
if (rebuildAll) for (const ch of channels) state.messages[ch.key] = [];

for (const ch of channels) {
  state.messages[ch.key] ||= [];
  const known = new Set(state.messages[ch.key].map((r) => r.ts));
  let parsed = 0;
  let added = 0;
  let skippedCount = 0;
  let missing = 0;

  for (const d of dirs) {
    const file = path.join(d, `${ch.key}.txt`);
    if (!fs.existsSync(file)) {
      missing++;
      if (!rebuildAll) {
        summary.warnings.push(`Missing dump for #${ch.name} (${path.relative(paths.root, file)})`);
      }
      continue;
    }
    const { runs: msgs, skipped } = parseChannel(fs.readFileSync(file, "utf8"), ch);
    parsed += msgs.length;
    skippedCount += skipped.length;
    for (const m of msgs) {
      if (m.ts && known.has(m.ts)) continue;
      state.messages[ch.key].push(m);
      known.add(m.ts);
      added++;
    }
    if (msgs.some((m) => m.truncatedFailureList)) {
      summary.warnings.push(
        `#${ch.name}: a run had its failure list truncated by the reporter (>30 lines) — streaks may be incomplete.`,
      );
    }
  }

  if (missing === dirs.length) {
    summary.channels.push({ key: ch.key, name: ch.name, missing: true });
    continue;
  }

  state.messages[ch.key].sort((a, b) => Number(a.ts || 0) - Number(b.ts || 0));
  // keep the 600 most recent messages per channel — a sharded regression run costs three of them
  if (state.messages[ch.key].length > 600) {
    state.messages[ch.key] = state.messages[ch.key].slice(-600);
  }

  summary.channels.push({
    key: ch.key,
    name: ch.name,
    parsed,
    added,
    total: state.messages[ch.key].length,
    skipped: skippedCount,
    latest: state.messages[ch.key].at(-1)?.iso || null,
  });
}

rebuildRuns(state);
rebuildTestStats(state);

/**
 * Older state files stored one run per Slack message under `runs`. Move them to `messages`, which
 * is what they always were, so `runs` can hold the merged logical runs everything downstream reads.
 */
function migrateToMessages(state) {
  state.messages ||= {};
  for (const [k, runs] of Object.entries(state.runs || {})) {
    if (state.messages[k]?.length) continue;
    // Already-merged runs carry `parts`; unwrapping them would lose nothing but is not needed.
    state.messages[k] = runs.filter((r) => !r.parts);
  }
}

/** Stitch each channel's messages into logical runs. Idempotent — recomputed on every ingest. */
function rebuildRuns(state) {
  for (const [k, msgs] of Object.entries(state.messages)) {
    state.runs[k] = mergeParts(msgs);
    const holed = state.runs[k].filter((r) => r.missingShards?.length);
    for (const r of holed) {
      summary.warnings.push(
        `#${r.channelName}: the ${r.testType} run at ${r.iso.slice(0, 16).replace("T", " ")} is missing shard(s) ${r.missingShards.join(", ")} — its pass rate covers only part of the suite.`,
      );
    }
  }
}

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
      const detail = new Map(
        (run.failureDetail || []).map((f) => [normTitle(f.title), f]),
      );

      for (const title of run.failures) {
        const n = normTitle(title);
        const d = detail.get(n);
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
          jobUrl: d?.part ? run.parts?.find((p) => p.part === d.part)?.jobUrl || run.jobUrl : run.jobUrl,
          runId: run.runId || null,
          partial: !!run.partial,
          // The reporter's own grouping: "stable" = failed on every retry, "env-dependent" = the
          // spec asserts on pre-existing account state, "blocked" = the suite body never ran.
          group: d?.group || "unknown",
          part: d?.part || null,
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
      // What the reporter itself said about the most recent failures. `envDependent` is the
      // strongest single hint there is toward an ENV label: the spec was tagged @envDependent in
      // the test repo because it asserts on account balance, positions, vault shares or trade
      // history, so a red one usually means the shared account drifted, not that the app regressed.
      const fails = rec.history.filter((h) => h.status === "fail");
      rec.failGroup = fails.at(-1)?.group || "unknown";
      rec.envDependent = fails.some((h) => h.group === "env-dependent");
      rec.shardPart = fails.at(-1)?.part || null;
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
        // Owner, ETA, the bug fields and the fix tracker are judgement too — dropping them here
        // would silently blank the "who / by when" columns on the next morning's ingest.
        rec.owner = old.owner ?? null;
        rec.eta = old.eta ?? null;
        rec.appbug = old.appbug ?? null;
        rec.fix = old.fix ?? null;
      } else {
        rec.label = null;
        rec.labelDate = null;
        rec.note = null;
        rec.ticket = null;
        rec.quarantined = false;
        rec.decisions = [];
        rec.rca = null;
        rec.owner = null;
        rec.eta = null;
        rec.appbug = null;
        rec.fix = null;
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

  // A Slack pull reaches back as far as `limit` allows, which is usually into previous days. Say
  // per suite how much of what was just ingested is actually new since the last sign-off, so the
  // morning review covers the overnight runs and not last week's, and so a gap is visible: if the
  // oldest message pulled is still newer than the checkpoint, runs in between were never seen.
  const cps = state.checkpoints || {};
  const bySuite = new Map();
  for (const runs of Object.values(state.runs)) {
    for (const r of runs) {
      const id = `${r.channelKey}:${r.testType}`;
      if (!bySuite.has(id)) bySuite.set(id, []);
      bySuite.get(id).push(r);
    }
  }
  const lines = [];
  for (const [id, runs] of [...bySuite].sort()) {
    runs.sort((a, b) => Number(a.ts) - Number(b.ts));
    const cp = cps[id];
    const fresh = runs.filter((r) => !cp || Number(r.ts) > Number(cp.ts));
    if (!fresh.length) continue;
    lines.push(
      `     ${id.padEnd(34)} ${String(fresh.length).padStart(2)} run(s) to review` +
        (cp ? ` since ${cp.iso.slice(0, 16).replace("T", " ")}` : `  (never signed off — everything stored counts as new)`),
    );
  }
  if (lines.length) {
    console.log(`  → to review:`);
    for (const l of lines) console.log(l);
  } else {
    console.log(`  → nothing new since the last sign-off.`);
  }
  for (const w of summary.warnings) console.log(`  ! ${w}`);
}
