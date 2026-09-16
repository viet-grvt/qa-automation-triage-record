#!/usr/bin/env node
/**
 * report.js — produce the Block 1 (triage) worksheet, the Block 2 (standup) draft and the
 * daily log row.
 *
 *   node tools/bin/report.js
 *   node tools/bin/report.js --date 2026-08-18 --window 20
 *   node tools/bin/report.js --channels manual-automation
 *
 * Writes: reports/<date>/triage.md, standup.md, log-row.md
 * Reads:  data/state.json (from ingest), data/test-index.json (from index-tests),
 *         data/jira-snapshot.json (optional, written by Claude from the Jira MCP).
 */
import fs from "node:fs";
import path from "node:path";
import {
  loadConfig,
  activeChannels,
  loadState,
  saveState,
  loadTestIndex,
  paths,
  todayInTz,
  pct,
  normTitle,
} from "../lib/state.js";
import { execFileSync } from "node:child_process";
import { findOwner, recentCommits, suggestLabel } from "../lib/hints.js";
import { stability, PATTERN_SHORT, LEANING_SHORT, suggestedLabel } from "../lib/verdict.js";
import { dueDate, slaStatus, runKey, isBusinessDay } from "../lib/sla.js";
import { partLabel } from "../lib/merge-runs.js";
import {
  prettyDate,
  prettyWhen,
  prettyAge,
  LABELS,
  labelPhrase,
  plainPattern,
  plainImpact,
  plainReading,
  plainAction,
  areaFromFile,
  plainChannelHealth,
  plainHeadline,
  plainWhere,
  shortNote,
  clip,
} from "../lib/plain.js";

const NL = String.fromCharCode(10);
const argv = process.argv.slice(2);
const has = (n) => argv.includes(`--${n}`);
const getArg = (n, d = null) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : d;
};

const cfg = loadConfig();
const state = loadState();
const index = loadTestIndex();
const date = getArg("date", todayInTz(cfg.timezone));
const WINDOW = Number(getArg("window", cfg.thresholds.rollingWindow * 2));
const T = cfg.thresholds;
let _sel;
try {
  _sel = new Set(activeChannels(cfg, getArg("channels")).map((c) => c.key));
} catch (e) {
  console.error(e.message);
  console.error("Valid keys: " + cfg.channels.map((c) => c.key).join(", "));
  process.exit(2);
}
const activeKeys = _sel;

const jiraPath = path.join(paths.root, "data", "jira-snapshot.json");
const jira = fs.existsSync(jiraPath) ? JSON.parse(fs.readFileSync(jiraPath, "utf8")) : null;

/** HEAD of the local qa-automation checkout — a stale checkout is why tests fail to map. */
function repoHead() {
  try {
    const out = execFileSync("git", ["log", "-1", "--pretty=%h|%ad|%s", "--date=short"], {
      cwd: cfg.repoPath,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    const [hash, d, ...rest] = out.split("|");
    const branch = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
      cwd: cfg.repoPath,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return { hash, date: d, subject: rest.join("|"), branch };
  } catch {
    return null;
  }
}
const head = repoHead();

// --------------------------------------------------------------- time anchor
// With --date set to a past day the whole report must be evaluated as of the end of that day,
// otherwise "last 24h", staleness and "recovered since" would all be measured against the
// current clock and the report would silently mix days.
const isToday = date === todayInTz(cfg.timezone);
function endOfDay(tz, day) {
  const probe = new Date(`${day}T12:00:00Z`);
  const name = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "longOffset" })
    .formatToParts(probe)
    .find((p) => p.type === "timeZoneName")?.value;
  const off = (name || "GMT+07:00").replace("GMT", "") || "+00:00";
  return Date.parse(`${day}T23:59:59${off}`);
}
const anchor = isToday ? Date.now() : endOfDay(cfg.timezone, date);

/** Recompute a test's stats using only the history up to the anchor. */
function asOf(t) {
  const history = (t.history || []).filter((h) => Date.parse(h.iso) <= anchor);
  if (!history.length) return { ...t, history, observed: 0, currentlyFailing: false, stale: true };
  let streak = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].status === "fail") streak++;
    else break;
  }
  const win = history.slice(-10);
  return {
    ...t,
    history,
    observed: history.length,
    consecutiveFails: streak,
    failCount: history.filter((h) => h.status === "fail").length,
    failRate10: Math.round((win.filter((h) => h.status === "fail").length / win.length) * 1000) / 10,
    firstSeen: history[0].iso,
    lastSeen: history.at(-1).iso,
    lastFail: [...history].reverse().find((h) => h.status === "fail")?.iso || null,
    currentlyFailing: history.at(-1).status === "fail",
  };
}
const tests = Object.values(state.tests).map((t) => (isToday ? t : asOf(t)));

const now = anchor;
const hoursSince = (iso) => (iso ? Math.round(((now - Date.parse(iso)) / 36e5) * 10) / 10 : null);

// ---------------------------------------------------------------- channel health
const channels = cfg.channels
  .filter((c) => activeKeys.has(c.key))
  .map((ch) => {
    const all = (state.runs[ch.key] || []).filter((r) => Date.parse(r.iso) <= anchor);
    const win = all.slice(-WINDOW);
    const last24 = all.filter((r) => hoursSince(r.iso) !== null && hoursSince(r.iso) <= 24);
    const green = win.filter((r) => r.green).length;
    const executed = win.reduce((s, r) => s + (r.passed || 0) + (r.failed || 0), 0);
    const failedCases = win.reduce((s, r) => s + (r.failed || 0), 0);
    const latest = all.at(-1) || null;

    return {
      ...ch,
      runs: all,
      window: win,
      last24,
      latest,
      latestAgeH: latest ? hoursSince(latest.iso) : null,
      // On a historical report the clock is pinned to 23:59 of that day, so measuring staleness in
      // hours would mark every suite silent. What matters there is simply: did it run that day?
      stale: latest ? (isToday ? hoursSince(latest.iso) > T.staleRunHours : latest.iso.slice(0, 10) !== date) : true,
      greenPct: pct(green, win.length),
      green24Pct: pct(last24.filter((r) => r.green).length, last24.length),
      flakinessPct: pct(failedCases, executed),
      delta:
        ch.baselineGreenPct != null && win.length
          ? Math.round((pct(green, win.length) - ch.baselineGreenPct) * 10) / 10
          : null,
    };
  });

// ---------------------------------------------------------------- suites and the review window
// A Slack channel carries more than one suite: #qa-web-automation-testnet posts both the smoke run
// and the regression run. Merging them hides the thing that matters — a green smoke run at 06:58
// makes the channel look healthy while the 04:18 regression run failed 16 tests. Everything below
// is therefore computed per suite (channel × smoke/regression), never per channel.
//
// The review window is the second half of it. A Slack pull returns whatever fits in `limit`, which
// reaches back into previous days, so "today's report" would otherwise re-triage runs that were
// already reviewed yesterday. Each suite carries a checkpoint — the last run that was signed off —
// and the window is everything after it, up to the latest run.
const checkpoints = state.checkpoints || {};
const suiteId = (channelKey, testType) => `${channelKey}:${testType}`;

const suites = [];
for (const c of channels) {
  const byType = new Map();
  for (const r of c.runs) {
    const tt = r.testType || "unknown";
    if (!byType.has(tt)) byType.set(tt, []);
    byType.get(tt).push(r);
  }
  // A channel that produced nothing still needs one row, otherwise "no data" reads as "all green".
  if (!byType.size) byType.set(c.platform === "mobile" ? "e2e" : "smoke", []);
  for (const [testType, runs] of byType) {
    const id = suiteId(c.key, testType);
    const cp = checkpoints[id] || null;
    const newRuns = runs.filter((r) => !cp || Number(r.ts) > Number(cp.ts));
    const win = runs.slice(-WINDOW);
    const latest = runs.at(-1) || null;
    suites.push({
      id,
      channel: c,
      testType,
      runs,
      newRuns,
      checkpoint: cp,
      latest,
      first: newRuns[0] || null,
      stale: latest ? (isToday ? hoursSince(latest.iso) > T.staleRunHours : latest.iso.slice(0, 10) !== date) : true,
      greenPct: pct(win.filter((r) => r.green).length, win.length),
      flakinessPct: pct(
        win.reduce((s, r) => s + (r.failed || 0), 0),
        win.reduce((s, r) => s + (r.passed || 0) + (r.failed || 0), 0),
      ),
    });
  }
}
suites.sort((a, b) => channels.indexOf(a.channel) - channels.indexOf(b.channel) || a.testType.localeCompare(b.testType));

/** The runs a test actually appeared in during this suite's review window. */
function windowRuns(t) {
  const s = suites.find((x) => x.id === suiteId(t.channelKey, t.testType));
  return s ? s.newRuns : [];
}

// ---------------------------------------------------------------- mobile / iOS
const mobile = channels.find((c) => c.platform === "mobile");
const iosRuns = (mobile?.runs || []).filter((r) => r.mobilePlatform === "ios");
const lastIos = iosRuns.at(-1) || null;
const androidRuns = (mobile?.runs || []).filter((r) => r.mobilePlatform === "android");
const lastAndroid = androidRuns.at(-1) || null;

// ---------------------------------------------------------------- failing tests
const failing = tests.filter((t) => t.currentlyFailing && !t.stale && activeKeys.has(t.channelKey));

const crossChannel = new Map();
for (const t of failing) {
  const n = normTitle(t.title);
  crossChannel.set(n, (crossChannel.get(n) || new Set()).add(t.channelKey));
}

const rows = failing
  .map((t) => {
    const ch = channels.find((c) => c.key === t.channelKey);
    const owner = findOwner(t, index);
    const commits = owner ? recentCommits(cfg.repoPath, owner.file, 14) : [];
    const hint = suggestLabel(t, {
      crossChannelCount: crossChannel.get(normTitle(t.title))?.size || 1,
      latestRun: ch?.latest,
      commits,
      thresholds: T,
    });
    const watch = cfg.watchlist.find(
      (w) =>
        normTitle(t.title).includes(normTitle(w.match)) && (!w.channel || w.channel === t.channelKey),
    );
    // The first question of the review: flaky test, or the product is really broken?
    const verdict = stability(t, { commits });
    // Did this test actually fail inside the window under review, or is it a carry-over that has
    // simply not been re-run since it was last looked at? Presenting the second as new work is
    // what makes a morning report look busier than the night actually was.
    const wr = windowRuns(t);
    const failedInWindow = wr.some((r) => r.failures.some((f) => normTitle(f) === normTitle(t.title)));
    return { t, ch, owner, commits, hint, watch, verdict, failedInWindow, suiteId: suiteId(t.channelKey, t.testType) };
  })
  .sort((a, b) => {
    const p = (r) => (r.ch?.critical ? 0 : 1);
    return p(a) - p(b) || b.t.consecutiveFails - a.t.consecutiveFails;
  });

// Tests that failed within the last 24h but whose latest run is green again. These must not be
// dropped: the checklist requires every failure — a PROD one above all — to end with a verdict.
const recovered = tests
  .filter((t) => !t.currentlyFailing && !t.stale && activeKeys.has(t.channelKey))
  .map((t) => {
    const fails24 = (t.history || []).filter(
      (h) => h.status === "fail" && hoursSince(h.iso) != null && hoursSince(h.iso) <= 24,
    );
    const ch = channels.find((c) => c.key === t.channelKey);
    const owner = findOwner(t, index);
    return {
      t,
      fails24,
      ch,
      verdict: stability(t, { commits: owner ? recentCommits(cfg.repoPath, owner.file, 14) : [] }),
    };
  })
  .filter((r) => r.fails24.length)
  .sort((a, b) => (a.ch?.critical ? 0 : 1) - (b.ch?.critical ? 0 : 1));

/** If every failure lands on one browser/device while the others pass, it is variant-specific. */
function variantSignal(t) {
  const failVariants = new Set(
    (t.history || []).filter((h) => h.status === "fail").map((h) => h.variant).filter(Boolean),
  );
  const passVariants = new Set(
    (t.history || []).filter((h) => h.status === "pass").map((h) => h.variant).filter(Boolean),
  );
  if (failVariants.size === 1 && passVariants.size > 0) {
    const only = [...failVariants][0];
    if (!passVariants.has(only)) return only;
  }
  return null;
}

const undecided = rows.filter((r) => !r.t.label);
const appBugsNoTicket = rows.filter((r) => r.t.label === "APP-BUG" && !r.t.ticket);
const scriptRows = rows.filter((r) => r.t.label === "SCRIPT");
const scriptOnSmoke = scriptRows.filter((r) => r.t.testType === "smoke");
const scriptNoRca = scriptRows.filter((r) => !r.t.rca);
const prodFails = rows.filter((r) => r.ch?.env === "prod");
const overdue = rows.filter(
  (r) => r.t.consecutiveFails >= T.quarantineAfterConsecutiveFails && !r.t.ticket && !r.t.quarantined,
);
const prodRecovered = recovered.filter((r) => r.ch?.env === "prod");

// ---------------------------------------------------------------- shared helpers
const outDir = path.join(paths.reports, date);
fs.mkdirSync(outDir, { recursive: true });

const dmy = `${date.slice(8)}/${date.slice(5, 7)}/${date.slice(0, 4)}`;
const dm = `${date.slice(8)}/${date.slice(5, 7)}`;

/** The four actions the format allows, derived from the label and the recorded root cause. */
function actionOf(t) {
  if (t.label === "ENV") return "Monitor (ENV)";
  if (t.label === "APP-BUG") return "Raise PRO";
  if (t.label === "SCRIPT") {
    if (t.quarantined || t.rca?.action === "quarantine") return "Quarantine";
    if (t.rca?.action === "wont-fix") return "Quarantine";
    return "Fix";
  }
  return "—";
}

/** One-sentence root cause for the classification table. */
function rootCauseLine(t) {
  const src = t.rca?.detail || t.note || null;
  if (!src) return t.label ? "_not written yet_" : "_not triaged_";
  const first = String(src).replace(/\s+/g, " ").split(/(?<=\.)\s/)[0];
  return clip(first, 110);
}

const carriedOver = rows.filter((r) => !r.failedInWindow);

const hm = (iso) => (iso ? `${prettyDate(iso)} ${iso.slice(11, 16)}` : "—");

/** One line saying exactly which runs this report covers, so nobody re-triages last night's. */
function reviewWindowLine() {
  const withCp = suites.filter((s) => s.checkpoint);
  const fresh = suites.reduce((n, s) => n + s.newRuns.length, 0);
  if (!withCp.length) {
    return `**everything stored** — no suite has been signed off yet, so there is no "last checked" point to start from. Run \`node tools/bin/report.js --mark-checked\` when you finish today, and tomorrow's report will start from here.`;
  }
  const from = withCp
    .map((s) => s.checkpoint.iso)
    .sort()
    .at(0);
  const to = suites
    .map((s) => s.latest?.iso)
    .filter(Boolean)
    .sort()
    .at(-1);
  return `${fresh} run(s) since the last check — ${hm(from)} → ${hm(to)}. Anything older was already triaged and is not repeated here.`;
}

/** Per-suite: how many runs are new, and how far back the last sign-off was. */
function suiteWindowCell(su) {
  if (!su.runs.length) return "— no data";
  if (!su.checkpoint) return `${su.newRuns.length} (never checked)`;
  if (!su.newRuns.length) return `0 — nothing new since ${hm(su.checkpoint.iso)}`;
  return `**${su.newRuns.length}** since ${hm(su.checkpoint.iso)}`;
}

/** The flaky-or-genuine cell for the classification table. */
function verdictCell(v) {
  return `${LEANING_SHORT[v.leaning]} · ${PATTERN_SHORT[v.pattern]}`;
}

/**
 * The evidence behind that leaning, written for someone who has not opened the repo. This is the
 * block that turns "the tool says flaky" into a decision the reader can check and disagree with.
 */
function verdictBlock(r) {
  const v = r.verdict;
  const out = [];
  out.push("```");
  out.push(`${r.t.title}`);
  out.push(`Leaning     : ${LEANING_SHORT[v.leaning]} (${PATTERN_SHORT[v.pattern]})`);
  out.push(`Reading     : ${v.plain}`);
  out.push(`Evidence    : ${v.why.join("; ")}`);
  out.push(`Next check  : ${v.nextCheck.join(" ")}`);
  const sug = suggestedLabel(v);
  if (sug) out.push(`Then record : node tools/bin/classify.js --test "${r.t.title.replace(/"/g, '\\"')}" --channel ${r.t.channelKey} --label ${sug} --owner <name> --eta <YYYY-MM-DD>`);
  out.push("```");
  return out;
}

function missingFields(t) {
  const out = [];
  if (!t.owner) out.push("owner");
  if (!t.eta) out.push("ETA");
  if (t.label === "APP-BUG") {
    if (!t.ticket) out.push("PRO ticket");
    if (!t.appbug?.team) out.push("team");
    if (!t.appbug?.impact) out.push("impact");
  }
  if (t.label === "SCRIPT" && !t.rca) out.push("root cause");
  return out;
}

const byChannel = new Map();
for (const c of channels) byChannel.set(c.key, []);
for (const r of rows) {
  if (!byChannel.has(r.t.channelKey)) byChannel.set(r.t.channelKey, []);
  byChannel.get(r.t.channelKey).push(r);
}

const counts = { ENV: 0, "APP-BUG": 0, SCRIPT: 0 };
for (const r of rows) if (r.t.label) counts[r.t.label]++;
const unlabelled = rows.filter((r) => !r.t.label).length;

// ENV failures are grouped, never listed one line per test — one environment incident that takes
// out twenty checks is one item to act on, not twenty. Section 1.5 owns the detail; section 1.2
// shows a single row per cluster so the table stays readable.
const ENV_STOP = new Set([
  "verify", "test", "with", "that", "from", "into", "when", "then", "this", "each", "user",
  "successfully", "correctly", "expected", "displayed", "placed", "type", "orders", "order",
  "data", "using", "mode", "button", "value", "page", "account", "check", "should", "can", "and",
  "the", "for", "are", "not", "all", "new",
]);
function clusterEnv(list) {
  // Tests that were given the same explanation are the same incident, however differently they are
  // named. Splitting them by keyword would invent precision that is not there — twenty checks
  // knocked out by one bad run is one cluster, not five.
  const out = [];
  const byNote = new Map();
  const noNote = [];
  for (const r of list) {
    const note = (r.t.note || "").replace(/\s+/g, " ").trim();
    if (!note) noNote.push(r);
    else {
      if (!byNote.has(note)) byNote.set(note, []);
      byNote.get(note).push(r);
    }
  }
  for (const [note, members] of byNote) {
    out.push({ theme: null, sharedNote: note, members });
  }

  const remaining = [...noNote];
  while (remaining.length) {
    const freq = new Map();
    for (const r of remaining) {
      const toks = new Set(
        normTitle(r.t.title).split(/[^a-z0-9-]+/).filter((x) => x.length > 3 && !ENV_STOP.has(x)),
      );
      for (const tok of toks) freq.set(tok, (freq.get(tok) || 0) + 1);
    }
    const [topTok, n] = [...freq.entries()].sort((a, b) => b[1] - a[1])[0] || [];
    if (!topTok || n < 2) {
      if (remaining.length) out.push({ theme: null, members: remaining.splice(0) });
      break;
    }
    const members = remaining.filter((r) => normTitle(r.t.title).includes(topTok));
    for (const m of members) remaining.splice(remaining.indexOf(m), 1);
    out.push({ theme: topTok, members });
  }
  return out;
}
const envClusters = new Map();
for (const [key, list] of byChannel) {
  const envs = list.filter((r) => r.t.label === "ENV");
  if (envs.length) envClusters.set(key, clusterEnv(envs));
}

// Smoke accuracy: a SCRIPT failure on a smoke suite is a false alarm, which breaks the QE-935
// "100% script accuracy on smoke" target. Nothing else counts as a breach.
const smokeScriptFails = rows.filter((r) => r.t.label === "SCRIPT" && r.t.testType === "smoke");

// ---------------------------------------------------------------- 1. TRIAGE RECORD
const L = [];
const w = (s = "") => L.push(s);

w(`# TRIAGE RECORD — ${dmy}`);
w(``);
w(
  `Full record for the day. Block 2 is a summary of this file — it is never written from scratch.`,
);
if (!isToday) {
  w(``);
  w(`> 🕰️ Rebuilt for **${date}** from stored history; anything after that date is excluded.`);
}
w(``);

// ---- 1.1 ------------------------------------------------------------------
w(`## 1.1 Channel status`);
w(``);
w(`_Reviewed: ${reviewWindowLine()}_`);
w(``);
w(`| Channel | Suite | Runs since last check | Latest run | Pass/Total | Fully green? | Report |`);
w(`|---|---|---|---|---|---|---|`);
for (const su of suites) {
  const r = su.latest;
  const total = r ? (r.passed || 0) + (r.failed || 0) : 0;
  w(
    `| ${su.channel.name.replace(/^qa-/, "").toUpperCase()} | **${su.testType}** | ${suiteWindowCell(su)} | ${
      r ? r.iso.slice(5, 16).replace("T", " ") : "—"
    } | ${r ? `${r.passed}/${total}` : "did not run"} | ${su.stale ? "🕒 silent" : r?.green ? "✅" : "❌"} | ${
      r?.reportUrl ? `[report](${r.reportUrl})` : "—"
    } |`,
  );
}
// Always keep a separate iOS line: "iOS did not run" is exactly the fact QE-948 tracks, and it
// disappears if the row is folded into the mobile channel.
if (mobile) {
  const total = lastIos ? (lastIos.passed || 0) + (lastIos.failed || 0) : 0;
  w(
    `| MOBILE-AUTOMATION-TESTNET | — of which iOS | — | ${lastIos ? lastIos.iso.slice(5, 16).replace("T", " ") : "—"} | ${
      lastIos ? `${lastIos.passed}/${total}` : "never run"
    } | ${!lastIos ? "❌ never" : hoursSince(lastIos.iso) > T.iosSilentAlertHours ? `🕒 ${Math.round(hoursSince(lastIos.iso) / 24)}d ago` : lastIos.green ? "✅" : "❌"} | ${lastIos?.reportUrl ? `[report](${lastIos.reportUrl})` : "—"} |`,
  );
}
w(``);
// A channel with nothing stored looks identical to a channel that ran clean. Say which it is,
// otherwise "0 failures" reads as good news when it actually means the Slack pull never happened.
const noData = channels.filter((c) => !(c.runs || []).length);
if (noData.length) {
  w(
    `> ⚠️ **No runs stored for ${noData.map((c) => c.name).join(", ")}.** The rows above are empty, not green — Slack was never read for ${noData.length === 1 ? "this channel" : "these channels"} on this date. Pull it and re-ingest before trusting any number below.`,
  );
  w(``);
}
w(
  `**Total failures: ${rows.length}** → ENV ${counts.ENV} · APP-BUG ${counts["APP-BUG"]} · SCRIPT ${counts.SCRIPT}${unlabelled ? ` · not yet classified ${unlabelled}` : ""}`,
);
w(``);
if (smokeScriptFails.length) {
  w(
    `**Smoke accuracy: 🔴 BREACHED** — ${smokeScriptFails.length} script failure(s) on a smoke suite: ${smokeScriptFails
      .slice(0, 4)
      .map((r) => `_${clip(r.t.title, 60)}_`)
      .join(", ")}${smokeScriptFails.length > 4 ? `, and ${smokeScriptFails.length - 4} more (all listed in 1.3)` : ""}. This breaks the QE-935 100% accuracy target and has to be called out in Block 2, not buried here.`,
  );
} else {
  w(`**Smoke accuracy: ✅ PASS** — no script failure on any smoke suite.`);
}
w(``);
for (const su of suites.filter((x) => x.stale && x.runs.length)) {
  w(
    `> ⚠️ **#${su.channel.name} · ${su.testType}** last ran ${prettyAge(hoursSince(su.latest.iso))}. Check the schedule before reading anything into the tests.`,
  );
}
// A sharded run's pass/total is a sum across several Slack messages. Say so, or the number looks
// like it came from one place and a missing shard looks like a smaller suite rather than a gap.
for (const su of suites.filter((x) => x.latest?.parts?.length > 1)) {
  const parts = su.latest.parts
    .map((p) => `${partLabel(p.part) || "run"} ${(p.passed || 0)}/${(p.passed || 0) + (p.failed || 0)}`)
    .join(" · ");
  w(
    `> 🧩 **#${su.channel.name} · ${su.testType}** is sharded: the ${su.latest.iso.slice(11, 16)} run is ${su.latest.parts.length} Slack messages under one workflow run — ${parts}. The row above is their sum.`,
  );
  if (su.latest.missingShards?.length) {
    w(
      `> ⚠️ **Shard ${su.latest.missingShards.join(", ")} of that run never posted.** Part of the suite has no result at all, so its tests are neither passed nor failed here — do not read the pass rate as full coverage.`,
    );
  }
}
// QE-964's actual acceptance criterion: every red run answered in its thread within 1 business
// day. Tests can all be classified and this can still be failing, so it is stated separately.
{
  const log = state.triageLog || {};
  const allRed = Object.values(state.runs || {}).flat().filter((r) => !r.green && activeKeys.has(r.channelKey));
  const st = allRed.map((r) => slaStatus(r, log[runKey(r)], cfg.timezone, date));
  const od = st.filter((x) => x.status === "overdue").length;
  const open = st.filter((x) => x.status === "due").length;
  if (od) {
    w(
      `> ❌ **${od} red run(s) past the 1-business-day triage deadline** — that breaks the QE-964 criteria for this week. \`node tools/bin/triage-log.js --overdue\` lists them.`,
    );
  } else if (open) {
    w(`> ⏳ ${open} red run(s) still inside the 1-business-day window.`);
  } else if (allRed.length) {
    w(`> ✅ Every red run on record has a classification reply within 1 business day.`);
  }
}
if (carriedOver.length) {
  w(
    `> ℹ️ ${carriedOver.length} failure(s) below did not run in this window at all — they are carried over from an earlier check, not new tonight. They are marked _carried over_ in 1.2.`,
  );
}
if (mobile && !lastIos) w(`> ⚠️ **iOS has never run.** QE-948 Phase 1 is not started.`);
w(``);

// ---- 1.2 ------------------------------------------------------------------
w(`## 1.2 Classification — one row per failing test`);
w(``);
if (!rows.length) {
  w(`No failures today.`);
  w(``);
} else {
  let n = 0;
  for (const [key, list] of byChannel) {
    if (!list.length) continue;
    const c = channels.find((x) => x.key === key);
    w(`### #${c?.name || key} — ${list.length} failure${list.length === 1 ? "" : "s"}`);
    w(``);
    w(`| # | Test | Suite/Env | Flaky or genuine? | Class | Root cause (one sentence) | Action | Ticket | Owner | ETA |`);
    w(`|---|---|---|---|---|---|---|---|---|---|`);
    for (const r of list.filter((r) => r.t.label !== "ENV")) {
      const t = r.t;
      n++;
      const gaps = missingFields(t);
      w(
        `| ${n} | ${clip(t.title, 70)}${r.failedInWindow ? "" : " _(carried over)_"} | ${t.testType}/${t.env} | ${verdictCell(r.verdict)} | ${t.label || "**?**"} | ${rootCauseLine(t)} | ${actionOf(t)} | ${t.ticket || "—"} | ${t.owner || "⚠️"} | ${t.eta || "⚠️"} |`,
      );
      if (gaps.length) {
        w(`| | ↳ _triage incomplete: missing ${gaps.join(", ")}_ | | | | | | | | |`);
      }
    }
    for (const cl of envClusters.get(key) || []) {
      n++;
      const first = cl.members[0].t;
      w(
        `| ${n} | **ENV cluster** — ${cl.members.length} test${cl.members.length === 1 ? "" : "s"}${cl.theme ? ` around \`${cl.theme}\`` : cl.sharedNote ? ", one incident" : ""} (detail in 1.5) | ${first.testType}/${first.env} | — environment | ENV | ${rootCauseLine(first)} | Monitor (ENV) | ${first.ticket || "—"} | ${first.owner || "⚠️"} | ${first.eta || "⚠️"} |`,
      );
    }
    w(``);
  }
  w(
    `_Action is one of: **Fix** · **Quarantine** · **Raise PRO** · **Monitor (ENV)**. A row without an owner and an ETA is not finished triage._`,
  );
  w(``);

  // Step 1 of the team's review: for every failure with no verdict yet, say which way the run
  // history points and what to open to settle it. Without this the "Class" column is a guess.
  const needVerdict = rows.filter((r) => !r.t.label);
  if (needVerdict.length) {
    w(`### Flaky test, or a real product issue? — the ${needVerdict.length} with no verdict yet`);
    w(``);
    w(
      `A test that passes and fails on the same build is unreliable — that is ours to fix. A test that fails every single time is telling you something changed. Neither is decided here: this is the evidence, and what to open next.`,
    );
    w(``);
    for (const r of needVerdict) for (const line of verdictBlock(r)) w(line);
    w(``);
  }
}

// ---- 1.3 ------------------------------------------------------------------
const scriptAll = rows.filter((r) => r.t.label === "SCRIPT");
w(`## 1.3 SCRIPT detail`);
w(``);
if (!scriptAll.length) {
  w(`No script failures today.`);
  w(``);
} else {
  w(`> This is what separates "fixed it" from "understood why it broke". **Prevention is mandatory.**`);
  w(``);
  let i = 0;
  for (const [key, list] of byChannel) {
    const scripts = list.filter((r) => r.t.label === "SCRIPT");
    if (!scripts.length) continue;
    const c = channels.find((x) => x.key === key);
    w(`### #${c?.name || key}`);
    w(``);
    for (const r of scripts) {
      const t = r.t;
      const rca = t.rca;
      i++;
      const id = `SCRIPT-${String(i).padStart(2, "0")}`;
      const quarantined = t.quarantined || rca?.action === "quarantine";
      w("```");
      w(`[${id}] ${t.title}${quarantined ? "   → QUARANTINED" : ""}`);
      w(`Env/Suite   : ${String(t.env).toUpperCase()} / ${t.testType}`);
      w(
        `Failures    : ${t.consecutiveFails} consecutive run${t.consecutiveFails === 1 ? "" : "s"} since ${prettyDate(t.firstSeen)}`,
      );
      if (quarantined) {
        w(`Why delayed : ${rca?.delayReason || "⚠️ not recorded — --delay-reason"}`);
        w(`Tracked in  : ${t.ticket || "⚠️ no ticket"}    Review on: ${rca?.reviewDate || "⚠️ not set"}`);
        w(`Coverage    : ${rca?.coverageRisk || "⚠️ not recorded — which flow loses coverage?"}`);
      } else {
        w(`Root cause  : ${rca?.detail ? clip(rca.detail.replace(/\s+/g, " "), 400) : "⚠️ not recorded — run /script-rca"}`);
        w(`Fix         : ${rca?.pr ? "see PR" : "⚠️ not recorded"}`);
        w(`Category    : ${rca?.category || (rca?.cause ? `${rca.cause} (auto)` : "⚠️ not set")}`);
        w(`PR          : ${rca?.pr || "⚠️ not linked"}`);
        w(`Verify      : ${rca?.verify || "⚠️ not verified — rerun it and record the result"}`);
        w(`Prevention  : ${rca?.prevention || "⚠️ MISSING — without this the same class of failure returns"}`);
      }
      w(`Owner       : ${t.owner || "⚠️ unassigned"}    ETA: ${t.eta || "⚠️ not set"}`);
      w("```");
      w(``);
    }
  }
  const noPrevention = scriptAll.filter((r) => !r.t.rca?.prevention);
  if (noPrevention.length) {
    w(
      `⚠️ ${noPrevention.length} of ${scriptAll.length} script failures have no prevention step recorded. Record it with \`node tools/bin/script-rca.js --record ... --prevention "..."\`.`,
    );
    w(``);
  }
  const badQuarantine = scriptAll.filter(
    (r) => (r.t.quarantined || r.t.rca?.action === "quarantine") && (!r.t.ticket || !r.t.rca?.reviewDate),
  );
  if (badQuarantine.length) {
    w(`⚠️ A quarantine without a ticket and a review date is a deleted test. ${badQuarantine.length} row(s) are in that state.`);
    w(``);
  }
}

// ---- 1.4 ------------------------------------------------------------------
const appBugs = rows.filter((r) => r.t.label === "APP-BUG");
w(`## 1.4 APP-BUG detail`);
w(``);
if (!appBugs.length) {
  w(`No product bugs found today.`);
  w(``);
} else {
  let i = 0;
  for (const [key, list] of byChannel) {
    const bugs = list.filter((r) => r.t.label === "APP-BUG");
    if (!bugs.length) continue;
    const c = channels.find((x) => x.key === key);
    w(`### #${c?.name || key}`);
    w(``);
    for (const r of bugs) {
      const t = r.t;
      const a = t.appbug || {};
      i++;
      const lastFailRun = (r.ch?.runs || [])
        .filter((x) => x.failures.some((f) => normTitle(f) === normTitle(t.title)))
        .at(-1);
      w("```");
      w(`[APP-${String(i).padStart(2, "0")}] ${t.title}`);
      w(`Symptom     : ${a.symptom || t.note || "⚠️ not written — what does the user actually see?"}`);
      w(`Evidence    : ${a.evidence || lastFailRun?.reportUrl || "⚠️ none attached"}`);
      w(`Reproduce   : ${a.repro || "⚠️ not stated — by hand, or automation only?"}`);
      w(
        `Impact      : ${a.impact || "⚠️ not stated"}${t.env === "prod" || a.prodLeak ? "   🚨 PROD — already reaching users" : ""}`,
      );
      w(`PRO ticket  : ${t.ticket || "⚠️ NOT RAISED"}${a.severity ? ` (severity: ${a.severity})` : ""}`);
      w(`Team        : ${a.team || "⚠️ not assigned to a team"}`);
      w(`Owner       : ${t.owner || "⚠️ unassigned"}    ETA: ${t.eta || "⚠️ not set"}`);
      w("```");
      w(``);
    }
  }
}

// ---- 1.5 ------------------------------------------------------------------
const envRows = rows.filter((r) => r.t.label === "ENV");
w(`## 1.5 ENV — grouped, not one line per test`);
w(``);
if (!envRows.length) {
  w(`No environment failures today.`);
  w(``);
} else {
  for (const [key, clusters] of envClusters) {
    const c = channels.find((x) => x.key === key);
    w(`### #${c?.name || key}`);
    w(``);
    for (const cl of clusters) {
      const notes = [...new Set(cl.members.map((m) => m.t.note).filter(Boolean))];
      w("```");
      w(
        `ENV cluster : ${cl.members.length} test(s)${cl.theme ? ` sharing "${cl.theme}"` : cl.sharedNote ? " — same incident, same explanation" : " — no shared explanation recorded"}`,
      );
      const shown = cl.members.slice(0, 6).map((m) => clip(m.t.title, 55));
      w(`Tests       : ${shown.join("; ")}${cl.members.length > 6 ? `; and ${cl.members.length - 6} more` : ""}`);
      w(
        `Hypothesis  : ${cl.sharedNote ? clip(cl.sharedNote, 300) : notes[0] ? clip(notes[0].replace(/\s+/g, " "), 300) : "⚠️ not recorded — thin liquidity, node lag, deploy in progress?"}`,
      );
      w(
        `Proposal    : add an env-health precondition before the suite, or retry-with-tagging so these do not count towards flakiness`,
      );
      w(`Owner       : ${cl.members[0].t.owner || "⚠️ unassigned"}`);
      w("```");
      w(``);
    }
  }
  w(`_ENV failures are never fixed by changing the test._`);
  w(``);
}

// ---- 1.6 ------------------------------------------------------------------
w(`## 1.6 Numbers for the daily log`);
w(``);
w("```");
w(
  `Fully-green: ${suites
    .filter((x) => x.runs.length)
    .map((x) => `${x.channel.platform === "mobile" ? "MOBILE-" : ""}${x.channel.env === "mixed" ? "MANUAL" : x.channel.env.toUpperCase()}/${x.testType} ${x.greenPct ?? "—"}%`)
    .join(" · ")}`,
);
const webCh = channels.filter((c) => c.platform === "web");
const mobCh = channels.filter((c) => c.platform === "mobile");
const flak = (list) => {
  const runs = list.flatMap((c) => c.runs.slice(-T.rollingWindow));
  const exec = runs.reduce((s, r) => s + (r.passed || 0) + (r.failed || 0), 0);
  const fail = runs.reduce((s, r) => s + (r.failed || 0), 0);
  return exec ? `${Math.round((fail / exec) * 1000) / 10}%` : "n/a";
};
w(`Flakiness rolling ${T.rollingWindow} runs: WEB ${flak(webCh)} · MOBILE ${flak(mobCh)}   (target <${T.flakinessTargetPct}%)`);
w(`Failures classified: ENV ${counts.ENV} / APP ${counts["APP-BUG"]} / SCRIPT ${counts.SCRIPT}`);
w(`Failures with no verdict: ${unlabelled}${unlabelled ? "   ⚠️ must be 0" : "   ✅"}`);
w(`Smoke accuracy: ${smokeScriptFails.length ? "BREACHED" : "PASS"}`);
w("```");
w(``);

if (recovered.length) {
  w(`### Failed earlier, green again now`);
  w(``);
  w(`Not in the table above because the latest run passed. They still need a verdict — a test that recovers on its own is flaky or platform-specific.`);
  w(``);
  for (const r of recovered) {
    const vs = variantSignal(r.t);
    w(
      `- **${clip(r.t.title, 80)}** — ${r.ch?.env}/${r.t.testType}, failed ${r.fails24.length}× in 24h${vs ? `, only on ${vs}` : ""}${r.ch?.env === "prod" ? " · 🚨 PROD, needs an answer today" : ""} · [run](${r.fails24.at(-1)?.jobUrl || ""})`,
    );
  }
  w(``);
}

w(`---`);
w(``);
w(`<details><summary>Terms used above</summary>`);
w(``);
w(`| Term | Meaning | Whose job |`);
w(`|---|---|---|`);
for (const [key, meta] of Object.entries(LABELS)) {
  w(`| **${key}** | ${meta.long} | ${meta.who} |`);
}
w(`| **Smoke** | The short suite that runs constantly; it must be trustworthy, so a false alarm here is urgent. | — |`);
w(`| **Regression** | The long suite. Slower, run less often, more tolerant of noise. | — |`);
w(`| **Quarantine** | Switching a test off deliberately, always with a ticket and a review date. | — |`);
w(`| **Fully green** | A run that finished with zero failures. | — |`);
w(``);
w(`</details>`);
w(``);
w(
  `<details><summary>Per-failure evidence and commands</summary>`,
);
w(``);
for (const r of rows) {
  const { t, ch, owner, commits } = r;
  const lastFailRun = (ch?.runs || [])
    .filter((x) => x.failures.some((f) => normTitle(f) === normTitle(t.title)))
    .at(-1);
  w(`**${t.title}** — ${t.channelKey}`);
  w(
    `- ${t.consecutiveFails} in a row (worst ${t.maxConsecutiveFails}), ${t.failRate10}% of the last ${Math.min(t.observed, 10)} runs${variantSignal(t) ? `, only on ${variantSignal(t)}` : ""}`,
  );
  if (owner) w(`- Code: \`${owner.file}:${owner.line}\``);
  else w(`- Code: not in the local checkout — \`git -C ${cfg.repoPath} pull\` then \`node tools/bin/index-tests.js\``);
  if (commits.length) w(`- Last edited ${commits[0].date} by ${commits[0].author} — ${commits[0].subject}`);
  if (lastFailRun) {
    w(`- [Actions job](${lastFailRun.jobUrl}) · [report](${lastFailRun.reportUrl})`);
    if (lastFailRun.runId) w(`- \`gh run view ${lastFailRun.runId} --log-failed -R ${cfg.repoSlug}\``);
  }
  if (!t.label) {
    w(
      `- \`node tools/bin/classify.js --test "${t.title.replace(/"/g, '\\"')}" --channel ${t.channelKey} --label <ENV|APP-BUG|SCRIPT> --owner <name> --eta <YYYY-MM-DD> --note "..."\``,
    );
  }
  w(``);
}
w(`</details>`);
w(``);

fs.writeFileSync(path.join(outDir, "triage.md"), L.join("\n") + "\n");

// ---------------------------------------------------------------- 2. STANDUP
const S = [];
const s = (x = "") => S.push(x);

// Each section that is meant to leave this machine is also written as its own file under
// reports/<date>/posts/, with the destination stated at the top. One file = one message = one
// thread, so nothing has to be re-cut by hand before posting.
const posts = [];
const P = cfg.posting || {};

const progressPath = path.join(paths.root, "data", "progress.json");
const progress = fs.existsSync(progressPath) ? JSON.parse(fs.readFileSync(progressPath, "utf8")) : null;
const targets = cfg.targets || {};
const daysToDue = targets.dueDate ? Math.ceil((Date.parse(targets.dueDate) - anchor) / 864e5) : null;

const fixedToday = rows.filter((r) => r.t.rca?.date === date && ["fix", "rewrite"].includes(r.t.rca?.action));
const quarantinedToday = rows.filter((r) => r.t.quarantined || r.t.rca?.action === "quarantine");

s(`# Block 2 — Standup & communication, ${dm}`);
s(``);
s(`## 2.1 Daily standup post (QA channel)`);
s(``);
s(`Paste as-is. Anyone who wants detail opens the Block 1 record.`);
s(``);
const standupStart = S.length + 1; // first line inside the fence
s("```");
s(`🧪 QA Automation Daily — ${dm}`);
s(``);
s(
  `Green runs: ${channels
    .map((c) => {
      const g = c.last24.filter((r) => r.green).length;
      const n = c.last24.length;
      const name = c.env === "mixed" ? "MANUAL" : c.env.toUpperCase();
      if (!n) {
        return `${name} 🕒 no run${c.latestAgeH != null ? ` in ${Math.round(c.latestAgeH / 24) || "<1"}d` : ""}`;
      }
      const icon = g === n ? "✅" : g === 0 ? "🔴" : "⚠️";
      return `${name} ${icon} ${g}/${n}`;
    })
    .join(" · ")}${mobile ? ` · iOS ${lastIos && hoursSince(lastIos.iso) <= 24 ? "✅" : "❌ not run"}` : ""}`,
);
s(`Fails: ${rows.length} → ENV ${counts.ENV} · APP ${counts["APP-BUG"]} · SCRIPT ${counts.SCRIPT}${unlabelled ? ` · unclassified ${unlabelled}` : ""}`);
s(
  `Smoke accuracy: ${smokeScriptFails.length ? `🔴 breached — script failure on smoke: ${smokeScriptFails.map((r) => clip(r.t.title, 45)).join(", ")}` : "✅ met"}`,
);
s(``);
if (appBugs.length) {
  s(`🔴 Needs dev`);
  for (const r of appBugs) {
    s(
      `• ${r.t.ticket || "PRO-???"} — ${clip(r.t.title, 55)} — ${r.t.appbug?.team || "team ?"} — impact: ${clip(r.t.appbug?.impact || `${r.t.env}/${r.t.platform}`, 45)}`,
    );
  }
  s(``);
}
if (fixedToday.length) {
  s(`🔧 Scripts fixed today`);
  for (const r of fixedToday) {
    s(
      `• ${clip(r.t.title, 45)} — ${r.t.rca.cause} — ${clip(r.t.rca.detail || "fix applied", 40)} — PR ${r.t.rca.pr || "?"} — verify ${r.t.rca.verify || "?"}`,
    );
  }
  s(``);
}
if (quarantinedToday.length) {
  s(`🧊 Quarantined`);
  for (const r of quarantinedToday) {
    s(`• ${clip(r.t.title, 55)} — tracked in ${r.t.ticket || "NO TICKET"}, review ${r.t.rca?.reviewDate || "DATE NOT SET"}`);
  }
  s(``);
}
s(
  `📈 Progress: iOS flows ${progress?.iosFlows ?? "?"}/${targets.iosFlows ?? "?"} · bug scenarios ${progress?.bugScenarios ?? "?"}/${targets.bugScenarios ?? "?"} · PRO bugs raised ${progress?.proBugs ?? "?"}/${targets.proBugsRaised ?? "?"}  (due ${targets.dueDate ? `${targets.dueDate.slice(8)}/${targets.dueDate.slice(5, 7)}` : "?"}${daysToDue != null ? `, ${daysToDue} days left` : ""})`,
);
const blockerList = [
  ...appBugs.filter((r) => !r.t.ticket).map((r) => `${clip(r.t.title, 40)} needs a dev to confirm before I can raise the ticket`),
  ...(mobile && !lastIos ? ["iOS pipeline still not running"] : []),
  ...channels.filter((c) => c.stale && c.runs.length).map((c) => `#${c.name} stopped running`),
];
s(`❗ Blocker: ${blockerList.length ? blockerList.join(" · ") : "none"}`);
s("```");
s(``);
const standupPost = S.slice(standupStart, S.lastIndexOf("```"));
posts.push({
  file: "2.1-standup.md",
  section: "2.1",
  destination: `${P.standup?.target || "the QA channel"}${P.standup?.confirmed === false ? "  ⚠️ destination not confirmed" : ""}`,
  what: "Daily standup post",
  body: standupPost.join("\n"),
});
if (!progress) {
  s(
    `> The progress line reads "?" because \`data/progress.json\` does not exist. Create it as \`{"iosFlows":0,"bugScenarios":0,"proBugs":0}\` and update it as work lands — the format asks for progress against target in every post so 15/09 does not arrive as a surprise.`,
  );
  s(``);
}

// ---- 2.2 -----------------------------------------------------------------
s(`## 2.2 Message to the dev channel — one bug, one message`);
s(``);
if (!appBugs.length) {
  s(`_No product bug to report today._`);
  s(``);
} else {
  // One message per bug, and a bug is a ticket — not a failing test. Seven tests knocked out by
  // PRO-8937 is one thing for the FE team to act on; seven near-identical messages is spam that
  // gets muted, and muting is how the next real one gets missed.
  const byTicket = new Map();
  for (const r of appBugs) {
    const k = r.t.ticket || `untracked:${normTitle(r.t.title)}`;
    if (!byTicket.has(k)) byTicket.set(k, []);
    byTicket.get(k).push(r);
  }
  for (const [, group] of byTicket) {
    const r = group[0];
    const siblings = group.slice(1);
    const t = r.t;
    const a = t.appbug || {};
    const lastFailRun = (r.ch?.runs || [])
      .filter((x) => x.failures.some((f) => normTitle(f) === normTitle(t.title)))
      .at(-1);
    const bugStart = S.length + 1;
    s("```");
    if (t.env === "prod" || a.prodLeak) s(`🚨 PROD — this has reached users.`);
    s(`@${a.team || "<team>"} — ${t.ticket || "PRO-????"} ${clip(t.title, 70)}`);
    s(``);
    s(`What        : ${a.symptom || clip(t.note || t.title, 120)}`);
    s(
      `Where       : ${t.platform === "mobile" ? "mobile app" : "web"} · ${String(t.env).toUpperCase()}${lastFailRun?.appVersion ? ` · ${lastFailRun.appVersion}` : ""}${lastFailRun?.browser ? ` · ${lastFailRun.browser}` : ""}`,
    );
    s(`Impact      : ${a.impact || "<who is affected, which flow is blocked, is it live>"}`);
    s(`Evidence    : ${a.evidence || lastFailRun?.reportUrl || "<screenshot / video / log>"}`);
    s(`Repro       : ${a.repro || "<steps, or: only seen in the automation run>"}`);
    s(
      `Found by    : automated ${t.testType} run${lastFailRun?.runId ? ` #${lastFailRun.runId}` : ""} on ${prettyDate(t.lastFail || t.lastSeen)}${siblings.length ? ` — and ${siblings.length} more test(s) blocked by the same bug` : ""}`,
    );
    for (const sib of siblings) s(`              · ${clip(sib.t.title, 80)}`);
    s(`Next steps  : 1. ${a.team || "<team>"} confirms it is a real defect (asking for a yes/no, not a fix today)`);
    s(`              2. ${t.ticket ? `${t.ticket} is assigned an owner and a priority` : "we raise the PRO ticket once confirmed"}`);
    s(`              3. QA re-runs the test after the fix and reports back in this thread — ${t.owner || "<qa owner>"}, by ${t.eta || "<date>"}`);
    s("```");
    // This is the "communicate it publicly" half of the review. It goes into the run's own thread
    // in the automation channel: public, dev-visible, and sitting next to the evidence.
    posts.push({
      file: `2.2-${(t.ticket || `bug-${posts.length}`).replace(/[^\w-]/g, "")}.md`,
      section: "2.2",
      channelKey: t.channelKey,
      threadTs: lastFailRun?.ts || null,
      destination: `#${r.ch?.name || t.channelKey} — thread of the failing run, @-mention ${a.team ? `the ${a.team} team` : "the owning team"}`,
      what: `Bug report: ${t.ticket || "no ticket"} — ${clip(a.symptom || t.title, 55)}${group.length > 1 ? ` (+${group.length - 1} tests)` : ""}`,
      blocked: !t.ticket || !a.team || !a.impact || !a.evidence,
      body: S.slice(bugStart, S.lastIndexOf("```")).join("\n"),
    });
    s(``);
  }
}

// ---- 2.3 -----------------------------------------------------------------
s(`## 2.3 Gap analysis — bugs manual regression found that automation missed`);
s(``);
const gapPath = path.join(paths.root, "data", "gap-analysis.json");
const gaps = fs.existsSync(gapPath) ? JSON.parse(fs.readFileSync(gapPath, "utf8")) : null;
if (gaps?.items?.length) {
  for (const g of gaps.items) {
    s("```");
    s(`Gap analysis — ${g.bugKey}`);
    s(`Already covered by a test? : ${g.covered ? "Yes" : "No"}`);
    if (g.covered) {
      s(`  Test "${g.test}" exists but did not catch it because: ${g.reason}`);
      s(`  Action: ${g.action} — ${g.owner || "⚠️ unassigned"} — ETA ${g.eta || "⚠️ not set"}`);
    } else {
      s(`  New coverage task: ${g.task || "⚠️ not created"} — planned ${g.eta || "⚠️ not set"}`);
    }
    s("```");
    s(``);
  }
} else {
  s(
    `_Nothing recorded. This is the QE-965 item that is easiest to skip and the best source of new coverage: for every bug manual regression found, say whether a test already covered it and why it did not catch it._`,
  );
  s(``);
  s(`To record one, create \`data/gap-analysis.json\`:`);
  s("```json");
  s(`{ "items": [`);
  s(`  { "bugKey": "PRO-1234", "covered": true, "test": "Verify ...",`);
  s(`    "reason": "assertion only checked the element exists, not its value",`);
  s(`    "action": "tighten the assertion", "owner": "viet", "eta": "2026-08-20" }`);
  s(`] }`);
  s("```");
  s(``);
}

// ---- 2.4 -----------------------------------------------------------------
s(`## 2.4 Escalate now, do not wait for standup`);
s(``);
const esc = [];
const prodAppBug = rows.filter((r) => r.ch?.env === "prod" && r.t.label === "APP-BUG");
if (prodAppBug.length) {
  esc.push(`PROD smoke is red because of a product bug (${prodAppBug.map((r) => clip(r.t.title, 45)).join(", ")}) — the baseline is 100% green, so one red is already abnormal.`);
}
const redDays = cfg.escalation?.channelFullyRedDays || 3;
for (const c of channels) {
  // A channel that has gone quiet is as bad as a red one: either way there is no signal, and the
  // silence is easier to miss because nothing turns red to announce it.
  if (c.latestAgeH != null && c.latestAgeH > redDays * 24) {
    esc.push(
      `#${c.name} has produced no run for ${Math.round(c.latestAgeH / 24)} days — that environment is completely unmonitored right now.`,
    );
    continue;
  }
  const since = anchor - redDays * 864e5;
  const recent = c.runs.filter((r) => Date.parse(r.iso) >= since);
  if (recent.length >= 3 && recent.every((r) => !r.green)) {
    esc.push(
      `#${c.name} has not had a single fully-green run in ${redDays} days (${recent.length} runs, all red).`,
    );
  }
}
for (const r of overdue) {
  esc.push(
    `"${clip(r.t.title, 50)}" has failed ${r.t.consecutiveFails} runs in a row with no ticket and no quarantine decision.`,
  );
}
if (progress && targets.dueDate && daysToDue != null && daysToDue > 0) {
  const need = (targets.iosFlows || 0) + (targets.bugScenarios || 0);
  const done = (progress.iosFlows || 0) + (progress.bugScenarios || 0);
  const perDay = (need - done) / Math.max(daysToDue, 1);
  if (perDay > 2) {
    esc.push(
      `The remaining quota needs ${perDay.toFixed(1)} scenarios per day to hit ${targets.dueDate} — that is above a sustainable rate and should be re-scoped rather than missed quietly.`,
    );
  }
}
if (!esc.length) {
  s(`Nothing meets the escalation bar today.`);
} else {
  s(`Raise these with ${cfg.escalation?.escalateTo || "the team lead"} yourself — this tool does not send them:`);
  s(``);
  for (const e of esc) s(`- ${e}`);
}
s(``);

s(`## My tickets`);
s(``);
if (!jira?.issues?.length) {
  s(`_No Jira snapshot was taken this morning._`);
} else {
  const scored = jira.issues.map((it) => {
    const reasons = [];
    let score = 0;
    const daysLeft = it.duedate ? Math.ceil((Date.parse(it.duedate) - anchor) / 864e5) : null;
    if (daysLeft != null && daysLeft <= 14) {
      reasons.push(daysLeft < 0 ? `overdue by ${-daysLeft} days` : `due in ${daysLeft} days`);
      score += daysLeft < 0 ? 100 : 60 - daysLeft;
    }
    if (it.status === "In Progress") {
      reasons.push("in progress");
      score += 30;
    }
    if (it.status === "To Do" && it.daysSinceCreated > 7) {
      reasons.push(`not started for ${it.daysSinceCreated} days`);
      score += Math.min(it.daysSinceCreated, 40);
    }
    if (cfg.jira.tracked.includes(it.key) && !it.duedate) {
      reasons.push("no deadline agreed");
      score += 10;
    }
    return { ...it, reasons, score };
  });
  const notable = scored.filter((it) => it.reasons.length).sort((a, b) => b.score - a.score);
  const rest = scored.length - notable.length;
  if (!notable.length) {
    s(`${scored.length} tickets open, none needing anything said today.`);
  } else {
    s(`| Ticket | What it is | Why it is here |`);
    s(`|---|---|---|`);
    for (const it of notable.slice(0, 6)) {
      s(
        `| ${it.key} | ${clip((it.summary || "").replace(/^\[(QA|AUTO[^\]]*|Automation)\]\s*/i, "").split("—")[0])} | ${it.reasons.join(", ")} |`,
      );
    }
    if (notable.length > 6) {
      s(``);
      s(`Plus ${notable.length - 6} more with the same flags.`);
    }
    if (rest > 0) {
      s(``);
      s(`${rest} other ticket${rest === 1 ? " is" : "s are"} open and on track.`);
    }
  }
}
s(``);
fs.writeFileSync(path.join(outDir, "standup.md"), S.join("\n") + "\n");

// ---------------------------------------------------------------- task drafts
// "If it is a genuine issue, create a task." A product bug with no ticket is a conversation that
// evaporates — this writes the ticket body so raising it is one confirmation, not ten minutes of
// retyping. Anything still in angle brackets is a gap the person triaging has to fill first.
const tasksDir = path.join(outDir, "tasks");
fs.rmSync(tasksDir, { recursive: true, force: true });
const needTicket = appBugs.filter((r) => !r.t.ticket);
if (needTicket.length) {
  fs.mkdirSync(tasksDir, { recursive: true });
  for (const [i, r] of needTicket.entries()) {
    const t = r.t;
    const a = t.appbug || {};
    const lastFailRun = (r.ch?.runs || [])
      .filter((x) => x.failures.some((f) => normTitle(f) === normTitle(t.title)))
      .at(-1);
    const gaps = [];
    if (!a.impact) gaps.push("impact");
    if (!a.evidence && !lastFailRun?.reportUrl) gaps.push("evidence");
    if (!a.team) gaps.push("team");
    if (!a.repro) gaps.push("how to reproduce");
    const body = [
      `<!-- Jira draft · project ${cfg.jira?.bugProject || "PRO"} · type Bug -->`,
      `<!-- Do not create this until the gaps below are filled. -->`,
      ``,
      `# ${clip(t.title, 90)}`,
      ``,
      `**Project**: ${cfg.jira?.bugProject || "PRO"}  ·  **Type**: Bug  ·  **Team**: ${a.team || "⚠️ not set"}  ·  **Severity**: ${a.severity || "⚠️ not set"}`,
      ``,
      `## What happens`,
      ``,
      a.symptom || t.note || "⚠️ not written — describe what a person sees, not what the assertion says.",
      ``,
      `## Where`,
      ``,
      `${t.platform === "mobile" ? "Mobile app" : "Web"} · ${String(t.env).toUpperCase()}${lastFailRun?.browser ? ` · ${lastFailRun.browser}` : ""}${lastFailRun?.appVersion ? ` · ${lastFailRun.appVersion}` : ""}`,
      ``,
      `## Impact`,
      ``,
      a.impact || "⚠️ not stated — who is affected, which flow is blocked, is it already live?",
      ``,
      `## How to reproduce`,
      ``,
      a.repro || "⚠️ not stated — steps by hand, or say explicitly that it was only seen in the automated run.",
      ``,
      `## Evidence`,
      ``,
      `- Automated ${t.testType} run${lastFailRun?.runId ? ` #${lastFailRun.runId}` : ""}, failing ${t.consecutiveFails} run(s) in a row since ${prettyDate(t.firstSeen)}`,
      lastFailRun?.reportUrl ? `- [Playwright report](${lastFailRun.reportUrl})` : null,
      lastFailRun?.jobUrl ? `- [CI job](${lastFailRun.jobUrl})` : null,
      a.evidence ? `- ${a.evidence}` : null,
      ``,
      `## Next steps`,
      ``,
      `1. ${a.team || "<team>"} confirms whether this is a real defect.`,
      `2. Ticket is assigned an owner and a priority.`,
      `3. QA re-runs the test after the fix — ${t.owner || "⚠️ no QA owner"}, by ${t.eta || "⚠️ no ETA"}.`,
      ``,
      `---`,
      ``,
      gaps.length
        ? `⚠️ **Fill these before raising it**: ${gaps.join(", ")}.\n\n\`\`\`\nnode tools/bin/classify.js --test "${t.title.replace(/"/g, '\\"')}" --channel ${t.channelKey} --label APP-BUG --team <team> --impact "..." --evidence <url> --repro "..."\n\`\`\``
        : `Ready to raise. After creating it, record the key:\n\n\`\`\`\nnode tools/bin/classify.js --test "${t.title.replace(/"/g, '\\"')}" --channel ${t.channelKey} --label APP-BUG --ticket <KEY>\n\`\`\``,
      ``,
    ]
      .filter((x) => x !== null)
      .join("\n");
    fs.writeFileSync(path.join(tasksDir, `task-${String(i + 1).padStart(2, "0")}-${t.channelKey}.md`), body);
  }
}

// ---------------------------------------------------------------- postable messages
// The triage record is cut per channel, not posted whole. It goes into the thread of a run in
// that channel, where the audience only cares about that channel — pasting staging's failures
// into the prod thread is noise, and it leaks a channel's state to people not watching it.
// Each record is rendered from scratch against that channel's rows so nothing from another
// channel can survive in it.
function suiteRecord(su) {
  const c = su.channel;
  const R = [];
  const p = (x = "") => R.push(x);
  // Scoped to this suite, not the whole channel: the smoke run and the regression run are separate
  // jobs posted as separate Slack messages, so each gets its own record in its own thread.
  const list = (byChannel.get(c.key) || []).filter((r) => r.t.testType === su.testType);
  const cCounts = { ENV: 0, "APP-BUG": 0, SCRIPT: 0 };
  for (const r of list) if (r.t.label) cCounts[r.t.label]++;
  const cUnlabelled = list.filter((r) => !r.t.label).length;
  const cSmokeFails = su.testType === "smoke" ? list.filter((r) => r.t.label === "SCRIPT") : [];
  const clusters = (envClusters.get(c.key) || [])
    .map((cl) => ({ ...cl, members: cl.members.filter((m) => m.t.testType === su.testType) }))
    .filter((cl) => cl.members.length);
  const isMobile = c.platform === "mobile";
  const isIos = isMobile && su.testType === "smoke";

  p(`# TRIAGE RECORD — #${c.name} · ${su.testType.toUpperCase()} — ${dmy}`);
  p(``);
  p(
    `_This record covers the **${su.testType}** suite in #${c.name} only. The other suites and channels are triaged in their own threads._`,
  );
  if (!isToday) {
    p(``);
    p(`> 🕰️ Rebuilt for **${date}** from stored history; anything after that date is excluded.`);
  }
  p(``);

  // ---- 1.1
  p(`## 1.1 Suite status`);
  p(``);
  p(`_Reviewed: ${su.checkpoint ? `${su.newRuns.length} run(s) since ${hm(su.checkpoint.iso)}` : "every run stored — this suite has not been signed off before"}._`);
  p(``);
  const r0 = su.latest;
  const tot0 = r0 ? (r0.passed || 0) + (r0.failed || 0) : 0;
  p(`| Channel | Suite | Latest run | Pass/Total | Fully green? | Report |`);
  p(`|---|---|---|---|---|---|`);
  p(
    `| ${c.name.replace(/^qa-/, "").toUpperCase()} | **${su.testType}** | ${r0 ? r0.iso.slice(5, 16).replace("T", " ") : "—"} | ${
      r0 ? `${r0.passed}/${tot0}` : "did not run"
    } | ${su.stale ? "🕒 silent" : r0?.green ? "✅" : "❌"} | ${r0?.reportUrl ? `[report](${r0.reportUrl})` : "—"} |`,
  );
  if (isIos) {
    const totIos = lastIos ? (lastIos.passed || 0) + (lastIos.failed || 0) : 0;
    p(
      `| ${c.name.replace(/^qa-/, "").toUpperCase()} | — of which iOS | ${lastIos ? lastIos.iso.slice(5, 16).replace("T", " ") : "—"} | ${
        lastIos ? `${lastIos.passed}/${totIos}` : "never run"
      } | ${!lastIos ? "❌ never" : hoursSince(lastIos.iso) > T.iosSilentAlertHours ? `🕒 ${Math.round(hoursSince(lastIos.iso) / 24)}d ago` : lastIos.green ? "✅" : "❌"} | ${lastIos?.reportUrl ? `[report](${lastIos.reportUrl})` : "—"} |`,
    );
  }
  p(``);
  if (!su.runs.length) {
    p(
      `> ⚠️ **No runs stored for this suite.** The row above is empty, not green — Slack was never read for it on this date.`,
    );
    p(``);
  }
  // Every run in the window, passes included. A record that lists only failures cannot be checked
  // against the Slack message it sits under, and hides how much of the suite actually ran.
  const wr = su.newRuns.length ? su.newRuns : su.runs.slice(-1);
  if (wr.length) {
    p(`| Run | Passed | Failed | Result |`);
    p(`|---|---|---|---|`);
    for (const r of wr) {
      const tot = (r.passed || 0) + (r.failed || 0);
      p(
        `| ${r.iso.slice(5, 16).replace("T", " ")}${r.variant ? ` · ${r.variant}` : ""} | ${r.passed ?? "—"} | ${r.failed ?? "—"} | ${
          r.partial ? "⏱️ timed out" : r.infra ? "🔧 infra" : r.green ? "✅ all passed" : "❌"
        } |`,
      );
    }
    const totP = wr.reduce((n, r) => n + (r.passed || 0), 0);
    const totF = wr.reduce((n, r) => n + (r.failed || 0), 0);
    if (wr.length > 1) p(`| **${wr.length} runs** | **${totP}** | **${totF}** | |`);
    p(``);
  }
  p(
    `**Total failures: ${list.length}** → ENV ${cCounts.ENV} · APP-BUG ${cCounts["APP-BUG"]} · SCRIPT ${cCounts.SCRIPT}${cUnlabelled ? ` · not yet classified ${cUnlabelled}` : ""}`,
  );
  p(``);
  if (su.testType === "smoke") {
    p(
      cSmokeFails.length
        ? `**Smoke accuracy: 🔴 BREACHED** — ${cSmokeFails.length} script failure(s) on this smoke suite: ${cSmokeFails.slice(0, 4).map((r) => `_${clip(r.t.title, 60)}_`).join(", ")}${cSmokeFails.length > 4 ? `, and ${cSmokeFails.length - 4} more (all in 1.3)` : ""}.`
        : `**Smoke accuracy: ✅ PASS** — no script failure on this smoke suite.`,
    );
    p(``);
  }
  if (isIos && !lastIos) {
    p(`> ⚠️ **iOS has never run.** QE-948 Phase 1 is not started.`);
    p(``);
  }

  // ---- 1.2
  p(`## 1.2 Classification — one row per failing test`);
  p(``);
  if (!list.length) {
    p(`No failures in this suite in the window under review.`);
    p(``);
  } else {
    let n = 0;
    p(`| # | Test | Suite/Env | Flaky or genuine? | Class | Root cause (one sentence) | Action | Ticket | Owner | ETA |`);
    p(`|---|---|---|---|---|---|---|---|---|---|`);
    for (const r of list.filter((x) => x.t.label !== "ENV")) {
      const t = r.t;
      n++;
      p(
        `| ${n} | ${clip(t.title, 70)}${r.failedInWindow ? "" : " _(carried over)_"} | ${t.testType}/${t.env} | ${verdictCell(r.verdict)} | ${t.label || "**?**"} | ${rootCauseLine(t)} | ${actionOf(t)} | ${t.ticket || "—"} | ${t.owner || "⚠️"} | ${t.eta || "⚠️"} |`,
      );
      const gaps = missingFields(t);
      if (gaps.length) p(`| | ↳ _triage incomplete: missing ${gaps.join(", ")}_ | | | | | | | | |`);
    }
    for (const cl of clusters) {
      n++;
      const first = cl.members[0].t;
      p(
        `| ${n} | **ENV cluster** — ${cl.members.length} test${cl.members.length === 1 ? "" : "s"}${cl.theme ? ` around \`${cl.theme}\`` : cl.sharedNote ? ", one incident" : ""} (detail in 1.5) | ${first.testType}/${first.env} | — environment | ENV | ${rootCauseLine(first)} | Monitor (ENV) | ${first.ticket || "—"} | ${first.owner || "⚠️"} | ${first.eta || "⚠️"} |`,
      );
    }
    p(``);
    p(
      `_Action is one of: **Fix** · **Quarantine** · **Raise PRO** · **Monitor (ENV)**. A row without an owner and an ETA is not finished triage._`,
    );
    p(``);
    const needVerdict = list.filter((r) => !r.t.label);
    if (needVerdict.length) {
      p(`### Flaky test, or a real product issue? — the ${needVerdict.length} with no verdict yet`);
      p(``);
      p(
        `A test that passes and fails on the same build is unreliable — that is ours to fix. A test that fails every single time is telling you something changed.`,
      );
      p(``);
      for (const r of needVerdict) for (const line of verdictBlock(r)) p(line);
      p(``);
    }
  }

  // ---- 1.3
  const scripts = list.filter((r) => r.t.label === "SCRIPT");
  p(`## 1.3 SCRIPT detail`);
  p(``);
  if (!scripts.length) {
    p(`No script failures in this suite.`);
    p(``);
  } else {
    p(`> This is what separates "fixed it" from "understood why it broke". **Prevention is mandatory.**`);
    p(``);
    let i = 0;
    for (const r of scripts) {
      const t = r.t;
      const rca = t.rca;
      i++;
      const quarantined = t.quarantined || rca?.action === "quarantine";
      p("```");
      p(`[SCRIPT-${String(i).padStart(2, "0")}] ${t.title}${quarantined ? "   → QUARANTINED" : ""}`);
      p(`Env/Suite   : ${String(t.env).toUpperCase()} / ${t.testType}`);
      p(
        `Failures    : ${t.consecutiveFails} consecutive run${t.consecutiveFails === 1 ? "" : "s"} since ${prettyDate(t.firstSeen)}`,
      );
      if (quarantined) {
        p(`Why delayed : ${rca?.delayReason || "⚠️ not recorded"}`);
        p(`Tracked in  : ${t.ticket || "⚠️ no ticket"}    Review on: ${rca?.reviewDate || "⚠️ not set"}`);
        p(`Coverage    : ${rca?.coverageRisk || "⚠️ not recorded — which flow loses coverage?"}`);
      } else {
        p(`Root cause  : ${rca?.detail ? clip(rca.detail.replace(/\s+/g, " "), 400) : "⚠️ not recorded — run /script-rca"}`);
        p(`Category    : ${rca?.category || (rca?.cause ? `${rca.cause} (auto)` : "⚠️ not set")}`);
        p(`PR          : ${rca?.pr || "⚠️ not linked"}`);
        p(`Verify      : ${rca?.verify || "⚠️ not verified — rerun it and record the result"}`);
        p(`Prevention  : ${rca?.prevention || "⚠️ MISSING — without this the same class of failure returns"}`);
      }
      p(`Owner       : ${t.owner || "⚠️ unassigned"}    ETA: ${t.eta || "⚠️ not set"}`);
      p("```");
      p(``);
    }
  }

  // ---- 1.4
  const bugs = list.filter((r) => r.t.label === "APP-BUG");
  p(`## 1.4 APP-BUG detail`);
  p(``);
  if (!bugs.length) {
    p(`No product bugs found in this suite.`);
    p(``);
  } else {
    let i = 0;
    for (const r of bugs) {
      const t = r.t;
      const a = t.appbug || {};
      i++;
      const lastFailRun = (r.ch?.runs || [])
        .filter((x) => x.failures.some((f) => normTitle(f) === normTitle(t.title)))
        .at(-1);
      p("```");
      p(`[APP-${String(i).padStart(2, "0")}] ${t.title}`);
      p(`Symptom     : ${a.symptom || t.note || "⚠️ not written — what does the user actually see?"}`);
      p(`Evidence    : ${a.evidence || lastFailRun?.reportUrl || "⚠️ none attached"}`);
      p(`Reproduce   : ${a.repro || "⚠️ not stated — by hand, or automation only?"}`);
      p(
        `Impact      : ${a.impact || "⚠️ not stated"}${t.env === "prod" || a.prodLeak ? "   🚨 PROD — already reaching users" : ""}`,
      );
      p(`PRO ticket  : ${t.ticket || "⚠️ NOT RAISED"}${a.severity ? ` (severity: ${a.severity})` : ""}`);
      p(`Team        : ${a.team || "⚠️ not assigned to a team"}`);
      p(`Owner       : ${t.owner || "⚠️ unassigned"}    ETA: ${t.eta || "⚠️ not set"}`);
      p("```");
      p(``);
    }
  }

  // ---- 1.5
  p(`## 1.5 ENV — grouped, not one line per test`);
  p(``);
  if (!clusters.length) {
    p(`No environment failures in this suite.`);
    p(``);
  } else {
    for (const cl of clusters) {
      const notes = [...new Set(cl.members.map((m) => m.t.note).filter(Boolean))];
      p("```");
      p(
        `ENV cluster : ${cl.members.length} test(s)${cl.theme ? ` sharing "${cl.theme}"` : cl.sharedNote ? " — same incident, same explanation" : " — no shared explanation recorded"}`,
      );
      const shown = cl.members.slice(0, 6).map((m) => clip(m.t.title, 55));
      p(`Tests       : ${shown.join("; ")}${cl.members.length > 6 ? `; and ${cl.members.length - 6} more` : ""}`);
      p(
        `Hypothesis  : ${cl.sharedNote ? clip(cl.sharedNote, 300) : notes[0] ? clip(notes[0].replace(/\s+/g, " "), 300) : "⚠️ not recorded — thin liquidity, node lag, deploy in progress?"}`,
      );
      p(`Owner       : ${cl.members[0].t.owner || "⚠️ unassigned"}`);
      p("```");
      p(``);
    }
    p(`_ENV failures are never fixed by changing the test._`);
    p(``);
  }

  // ---- 1.6
  p(`## 1.6 Numbers for the daily log`);
  p(``);
  p("```");
  // Per suite, not per channel: mixing a green 45-test smoke run into the regression suite's
  // flakiness is how a red suite ends up reporting a healthy percentage.
  p(`Fully-green: ${su.greenPct ?? "—"}% of the last ${Math.min(su.runs.length, WINDOW)} ${su.testType} runs`);
  p(`Flakiness rolling ${T.rollingWindow} runs: ${flak([{ runs: su.runs }])}   (target <${T.flakinessTargetPct}%)`);
  p(`Failures classified: ENV ${cCounts.ENV} / APP ${cCounts["APP-BUG"]} / SCRIPT ${cCounts.SCRIPT}`);
  p(`Failures with no verdict: ${cUnlabelled}${cUnlabelled ? "   ⚠️ must be 0" : "   ✅"}`);
  p(`Smoke accuracy: ${su.testType === "smoke" ? (cSmokeFails.length ? "BREACHED" : "PASS") : "n/a — this is not a smoke suite"}`);
  p("```");
  p(``);
  const rec = recovered.filter((r) => r.t.channelKey === c.key);
  if (rec.length) {
    p(`### Failed earlier, green again now`);
    p(``);
    p(`Not in the table above because the latest run passed. They still need a verdict — a test that recovers on its own is flaky or platform-specific.`);
    p(``);
    for (const r of rec) {
      const vs = variantSignal(r.t);
      p(
        `- **${clip(r.t.title, 80)}** — ${r.ch?.env}/${r.t.testType}, failed ${r.fails24.length}× in 24h${vs ? `, only on ${vs}` : ""} · [run](${r.fails24.at(-1)?.jobUrl || ""})`,
      );
    }
    p(``);
  }
  return R.join("\n").trimEnd();
}

// One post per suite, because one suite is one CI job is one Slack message is one thread. Posting
// the regression record into the smoke run's thread would put it under a green message, which is
// exactly where nobody looks. A suite with nothing stored was never checked, so it gets no post.
// ---------------------------------------------------------------- red-run thread replies
// QE-964 measures one thing: every red run gets a classification reply in its own Slack thread
// within one business day. So the unit of posting is the red run, not the suite and not the day.
// A green run has no failing message and nothing to classify — it gets no reply. The full
// per-suite record still exists in records/ for whoever runs the triage; it is not a message.
const recordsDir = path.join(outDir, "records");
fs.rmSync(recordsDir, { recursive: true, force: true });
fs.mkdirSync(recordsDir, { recursive: true });
for (const su of suites) {
  if (!su.runs.length) continue;
  fs.writeFileSync(path.join(recordsDir, `${su.channel.key}-${su.testType}.md`), `${suiteRecord(su)}\n`);
}

/** Look a failing title up in the state, so the reply carries the verdict that was recorded. */
function testFor(run, title) {
  const n = normTitle(title);
  return tests.find(
    (t) => t.channelKey === run.channelKey && t.testType === run.testType && normTitle(t.title) === n,
  );
}

/** The short classification reply the ticket asks for: category + one-line reason + link. */
function threadReply(run) {
  const R = [];
  const p = (x = "") => R.push(x);
  const total = (run.passed || 0) + (run.failed || 0);
  const head = run.headerLine.replace(/^:[a-z_]+:/, "").trim();

  const groups = { ENV: [], "APP-BUG": [], SCRIPT: [], unclassified: [] };
  for (const title of run.failures) {
    const t = testFor(run, title);
    groups[t?.label || "unclassified"].push({ title, t });
  }

  p(`🔴 *Triage — ${head}* · ${prettyDate(run.iso)} ${run.iso.slice(11, 16)}`);
  p(`${run.failed} failed / ${run.passed} passed of ${total}${run.truncatedFailureList ? "  (Slack truncated the failure list)" : ""}`);
  // A sharded run posts one message per shard, so this reply answers for messages the reader
  // cannot see from here. Name them, or the counts look wrong against the message above the reply.
  if (run.parts?.length > 1) {
    p(
      `Covers the whole run (${run.parts.length} messages, one workflow run ${run.runId || ""}): ` +
        run.parts
          .map((pt) => `${partLabel(pt.part) || "run"} ${pt.failed || 0} failed`)
          .join(" · "),
    );
    if (run.missingShards?.length) {
      p(`⚠️ Shard ${run.missingShards.join(", ")} never posted — part of the suite has no result.`);
    }
  }
  if (run.blocked) {
    p(
      `⛔ *BLOCKED (preflight)* — the account gate failed, so the suite body never ran. These results do not count toward the pass rate and say nothing about the product.`,
    );
  }
  p(``);

  // A run can be red without naming a single test: it timed out, or the job died before it got
  // going. That is an environment problem with the run itself, and saying "0 failures" here would
  // read as a clean result under a red message.
  if (!run.failures.length) {
    p(
      `*ENV* — the run itself did not complete${run.partial ? " (timed out)" : run.infra ? " (nothing passed — infrastructure)" : ""}, so no individual test was reported.`,
    );
    p(`Env condition: ⚠️ not recorded — what was wrong with the environment or the runner?`);
    p(``);
    p(`<${run.reportUrl || run.jobUrl}|Test report>${run.runId ? ` · run ${run.runId}` : ""}`);
    return R.join(NL).trimEnd();
  }

  for (const [cat, list] of Object.entries(groups)) {
    if (!list.length) continue;
    p(
      cat === "unclassified"
        ? `*NOT YET CLASSIFIED (${list.length})* — triage is not finished until this is empty`
        : `*${cat}* (${list.length}) — ${LABELS[cat]?.short || cat}`,
    );
    // Tests knocked out by the same cause are one item to act on, not eight. Grouping them on the
    // shared explanation keeps the reply readable without hiding a single name.
    const seen = new Map();
    for (const item of list) {
      const t = item.t;
      const raw = t?.rca?.detail || t?.note || "";
      const k = String(raw).replace(/\s+/g, " ").trim();
      // Only tests that share a *stated* cause are one item. Without that guard everything with no
      // note collapses into "N tests, same cause" — which claims a shared cause nobody established.
      if (!k) {
        seen.set(`__ungrouped:${item.title}`, [item]);
        continue;
      }
      if (!seen.has(k)) seen.set(k, []);
      seen.get(k).push(item);
    }
    for (const [, members] of seen) {
      if (members.length > 1) {
        const t = members[0].t;
        const reason = t?.rca?.detail || t?.note || null;
        p(`• *${members.length} tests, same cause*${reason ? ` — ${clip(String(reason).replace(/\s+/g, " "), 300)}` : ""}`);
        for (const m of members) p(`    ◦ ${clip(m.title, 88)}`);
        if (cat === "SCRIPT") {
          const act = t?.quarantined || t?.rca?.action === "quarantine" ? "quarantine" : t?.rca?.action || null;
          p(`    → ${act ? `${act}${t?.eta ? ` by ${t.eta}` : ""}${t?.ticket ? ` · ${t.ticket}` : ""}` : "⚠️ no fix-or-quarantine decision"}`);
        } else if (cat === "APP-BUG") {
          p(`    → ${t?.ticket ? (cfg.jira?.site ? `<${cfg.jira.site}/browse/${t.ticket}|${t.ticket}>` : t.ticket) : "⚠️ no PRO ticket raised"}`);
        }
        continue;
      }
      for (const { title, t } of members) {
      const reason = t?.rca?.detail || t?.note || null;
      const one = reason ? clip(String(reason).replace(/\s+/g, " ").split(/(?<=\.)\s/)[0], 130) : null;
      // Each category owes a different thing, and the reply is where a missing one shows.
      let decision = "";
      if (cat === "SCRIPT") {
        const act = t?.quarantined || t?.rca?.action === "quarantine" ? "quarantine" : t?.rca?.action || null;
        decision = act
          ? ` → ${act === "quarantine" ? `quarantined until ${t?.rca?.reviewDate || "⚠️ no review date"}${t?.ticket ? ` · ${t.ticket}` : " · ⚠️ no ticket"}` : `${act}${t?.eta ? ` by ${t.eta}` : ""}${t?.ticket ? ` · ${t.ticket}` : ""}`}`
          : " → ⚠️ no fix-or-quarantine decision";
      } else if (cat === "APP-BUG") {
        decision = t?.ticket
          ? ` → ${cfg.jira?.site ? `<${cfg.jira.site}/browse/${t.ticket}|${t.ticket}>` : t.ticket}`
          : " → ⚠️ no PRO ticket raised";
      } else if (cat === "ENV") {
        decision = one ? "" : " → ⚠️ env condition not recorded";
      }
      p(`• ${clip(title, 90)}${one ? ` — ${one}` : ""}${decision}`);
      }
    }
    p(``);
  }

  // Nothing is "unassigned" in practice — an untriaged run belongs to whoever is on QA duty until
  // it is classified. Naming them is more useful in the thread than a warning nobody can action.
  const owners = [...new Set(run.failures.map((f) => testFor(run, f)?.owner).filter(Boolean))];
  p(`Owner: ${owners.join(", ") || cfg.defaultOwner || "⚠️ unassigned"}`);
  p(`<${run.reportUrl || run.jobUrl}|Test report>${run.runId ? ` · run ${run.runId}` : ""}`);
  return R.join(NL).trimEnd();
}

// Only runs inside the review window: an older red run either already has its reply or is listed
// as overdue by triage-log.js, and re-drafting it here would produce a duplicate thread reply.
const redRuns = [];
for (const su of suites) for (const r of su.newRuns) if (!r.green) redRuns.push({ run: r, su });
redRuns.sort((a, b) => Number(b.run.ts) - Number(a.run.ts));

for (const { run, su } of [...redRuns].reverse()) {
  const noTests = !run.failures.length;
  const unclassified = run.failures.filter((f) => !testFor(run, f)?.label).length;
  const missingDecision = run.failures.filter((f) => {
    const t = testFor(run, f);
    if (!t?.label) return false;
    if (t.label === "SCRIPT") return !(t.quarantined || t.rca?.action);
    if (t.label === "APP-BUG") return !t.ticket;
    if (t.label === "ENV") return !(t.note || t.rca?.detail);
    return false;
  }).length;
  posts.unshift({
    // Date in the filename: two runs of the same suite at the same clock time on different days
    // would otherwise overwrite each other, and the one that survived would look like the only one.
    file: `thread-${su.channel.key}-${su.testType}-${run.iso.slice(0, 10)}-${run.iso.slice(11, 16).replace(":", "")}.md`,
    section: "thread reply",
    channelKey: su.channel.key,
    suiteId: su.id,
    destination:
      `#${su.channel.name} — thread of the ${su.testType} run at ${run.iso.slice(11, 16)}` +
      (run.parts?.length > 1
        ? ` (the "${partLabel(run.parts.at(-1).part) || "last"}" message; it is the last of ${run.parts.length} for this run, and the reply covers all of them)`
        : ""),
    threadTs: run.ts,
    runId: run.runId || null,
    due: dueDate(run.iso, cfg.timezone),
    what: `Red run reply — ${su.testType} ${prettyDate(run.iso)} ${run.iso.slice(11, 16)} (${run.failures.length ? `${run.failed} failed` : "run did not complete"})`,
    blocked: noTests || unclassified > 0 || missingDecision > 0,
    blockedWhy: [
      noTests ? "the run named no tests — record the environment condition first" : null,
      unclassified ? `${unclassified} failure(s) with no category` : null,
      missingDecision ? `${missingDecision} classified failure(s) missing the decision their category requires` : null,
    ]
      .filter(Boolean)
      .join("; "),
    body: threadReply(run),
  });
}

// "Daily failure triage" means every day something ran, not only the days something went red. A
// suite that ran clean still gets a short message: it is the difference between "checked, all
// green" and "nobody looked", and from outside the channel those look identical.
//
// This used to skip weekends, which only ever reflected the fact that the note was written by
// hand and nobody was at a desk on Saturday. The CI does not stop — prod runs every 15 minutes
// all weekend — so those runs were going unattested. A run that happened is a run that owes a
// note. The "no run today" warning below is still weekday-only, because a quiet Saturday is
// expected and crying about it every weekend is how a real silence gets ignored.
{
  for (const su of [...suites].reverse()) {
    const dayRuns = su.runs.filter((r) => r.iso.slice(0, 10) === date);
    if (dayRuns.some((r) => !r.green)) continue; // its red runs already have their own replies
    const last = dayRuns.at(-1) || null;
    // Only suites that genuinely run most days are expected daily. Flagging "no run today" for an
    // ad-hoc suite like mobile `manual` would be a false alarm every morning, and a false alarm
    // every morning is how the real silence gets ignored.
    if (!last) {
      // Nothing ran. On a weekday that is worth flagging; on a weekend it is normal, so stay quiet
      // rather than posting "no run today" into every channel each Saturday.
      if (!isBusinessDay(date)) continue;
      const days = new Set(
        su.runs.filter((r) => r.iso.slice(0, 10) <= date && r.iso.slice(0, 10) > shiftDate(date, -7)).map((r) => r.iso.slice(0, 10)),
      );
      if (days.size < 3) continue;
    }
    const passed = dayRuns.reduce((n, r) => n + (r.passed || 0), 0);
    const B = [];
    B.push(
      `${last ? "✅" : "⚠️"} *Daily triage — ${su.channel.name} · ${su.testType}* · ${prettyDate(`${date}T12:00:00+07:00`)}`,
    );
    B.push(
      last
        ? `${dayRuns.length} run(s) today, all green — ${passed} test(s) passed, nothing to classify.`
        : `⚠️ No ${su.testType} run today. Nothing was produced to triage — check the schedule, this is not a pass.`,
    );
    if (last) B.push(`Latest: ${last.iso.slice(11, 16)} · <${last.reportUrl || last.jobUrl}|Test report>`);
    posts.push({
      file: `daily-${su.channel.key}-${su.testType}-${date}.md`,
      section: "daily",
      channelKey: su.channel.key,
      suiteId: su.id,
      threadTs: last?.ts || null,
      destination: last
        ? `#${su.channel.name} — thread of the ${su.testType} run at ${last.iso.slice(11, 16)}`
        : `#${su.channel.name} — new message (no run today, so there is no thread)`,
      what: `Daily triage — ${su.channel.name} · ${su.testType} (${last ? "all green" : "no run"})`,
      body: B.join(NL),
    });
  }
}

function shiftDate(d, n) {
  const x = new Date(`${d}T12:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
}

const postsDir = path.join(outDir, "posts");
fs.rmSync(postsDir, { recursive: true, force: true });
fs.mkdirSync(postsDir, { recursive: true });

const idx = [];
idx.push(`# Messages ready to post — ${dmy}`);
idx.push(``);
idx.push(`One file below is one message for one thread. Review, then post. Nothing is sent automatically.`);
idx.push(``);
idx.push(
  `**One file = one red run = one thread reply.** Green runs get nothing: there is no failure to classify. Each reply carries the category, a one-line reason and the ticket link for every failure in that run, and is due within **1 business day** of the run being posted (QE-964).`,
);
idx.push(``);
idx.push(
  `The long per-suite record lives in [records/](records/) — reference for whoever runs the triage, not a message. \`triage.md\` is the whole-day working copy.`,
);

idx.push(``);
idx.push(`| Section | Message | Goes to | Triage due | Status |`);
idx.push(`|---|---|---|---|---|`);
for (const post of posts) {
  const status = post.blocked ? `⚠️ ${post.blockedWhy || "incomplete"}` : "ready";
  idx.push(
    `| ${post.section} | [${post.what}](posts/${post.file}) | ${post.destination} | ${post.due ? `due ${post.due}` : "—"} | ${status} |`,
  );
  fs.writeFileSync(
    path.join(postsDir, post.file),
    [
      `<!-- Section ${post.section} · post to: ${post.destination} -->`,
      ...(post.channelKey ? [`<!-- channel: ${post.channelKey}${post.suiteId ? ` · suite: ${post.suiteId.split(":")[1]}` : ""}${post.threadTs ? ` · thread_ts: ${post.threadTs}` : " · no failing run found — pick the thread by hand"} -->`] : []),
      `<!-- Everything below the rule is the message body. Do not paste this header. -->`,
      ``,
      `---`,
      ``,
      post.body,
      ``,
    ].join("\n"),
  );
}
idx.push(``);
if (posts.some((p) => p.blocked)) {
  idx.push(
    "⚠️ A reply is held back until every failure in that run has a category, and each category has what it owes: SCRIPT a fix-or-quarantine decision, APP-BUG a PRO ticket, ENV the environment condition. Posting a reply with blanks in it is worse than posting nothing — it looks triaged.",
  );
  idx.push(``);
}
idx.push(
  "Section 2.4 (escalation) is deliberately not turned into a message — it stays in the report for you to raise yourself.",
);
idx.push(``);
if (needTicket.length) {
  idx.push(
    `📋 ${needTicket.length} product bug(s) have no ticket yet. Drafts are in [tasks/](tasks/) — fill the gaps, create them in ${cfg.jira?.bugProject || "PRO"}, then record the key with \`classify.js --ticket\`.`,
  );
  idx.push(``);
}
if (P.standup?.confirmed === false) {
  idx.push(
    `⚠️ The standup destination (${P.standup.target}) is not confirmed yet. Confirm it in \`config/channels.json\` and set \`"confirmed": true\` before the first send.`,
  );
  idx.push(``);
}
fs.writeFileSync(path.join(outDir, "posts.md"), idx.join("\n"));

// ---------------------------------------------------------------- log row
const g = (k) => channels.find((c) => c.key === k);
const cell = (k) => {
  const c = g(k);
  if (!c) return "n/a";
  return `${c.green24Pct ?? c.greenPct ?? "—"}%`;
};
const row =
  `| ${date.slice(8)}/${date.slice(5, 7)} ` +
  `| ${cell("web-prod")} ` +
  `| ${cell("web-testnet")} ` +
  `| ${cell("web-staging")} ` +
  `| ${!mobile ? "n/a" : lastIos && hoursSince(lastIos.iso) <= 24 ? "yes" : "NO"} ` +
  `| ${counts.ENV} / ${counts["APP-BUG"]} / ${counts.SCRIPT} ` +
  `|  |  |`;
fs.writeFileSync(
  path.join(outDir, "log-row.md"),
  `Paste into the log table in QE-964-daily-checklist.md:\n\n${row}\n\n` +
    `Active channels for this run: ${[...activeKeys].join(", ")}. Columns for disabled channels show "n/a".\n` +
    `The last two columns — "scenarios green today" and "PRO bugs raised" — belong to Blocks 3/4; fill them in at end of day.\n`,
);

console.log(`Reports for ${date}:`);
for (const f of ["triage.md", "standup.md", "log-row.md", "posts.md"]) {
  console.log(`  ${path.relative(paths.root, path.join(outDir, f)).replace(/\\/g, "/")}`);
}
console.log(
  `Summary: ${rows.length} red, ${undecided.length} unlabelled, ${overdue.length} past the decision deadline, ${scriptNoRca.length} SCRIPT without root cause` +
    (mobile ? `, iOS ${lastIos ? `${hoursSince(lastIos.iso)}h ago` : "NEVER RAN"}` : "") +
    `.`,
);
if (needTicket.length) {
  console.log(`  reports/${date}/tasks/  — ${needTicket.length} ticket draft(s) for product bugs with no ticket`);
}
// The morning question the report cannot answer on its own: what did we decide yesterday, and did
// it actually get fixed? track.js owns that, so point at it rather than duplicating it here.
const leaning = { flaky: 0, genuine: 0, env: 0, blocked: 0, unclear: 0 };
for (const r of rows) leaning[r.verdict.leaning]++;
console.log(
  `First read: ${leaning.flaky} lean flaky (our test), ${leaning.genuine} lean genuine (the product), ` +
    `${leaning.env} lean environment (@envDependent), ${leaning.unclear} need a look` +
    `${leaning.blocked ? `, ${leaning.blocked} never ran (preflight gate)` : ""}.`,
);
console.log(`Then run: node tools/bin/track.js --overdue   # fixes decided earlier that are still not done`);

// ---------------------------------------------------------------- sign off the window
// Advancing the checkpoint is deliberate, never automatic: it is the moment someone says "I have
// looked at these runs". If report.js moved it on its own, a report nobody read would silently
// mark the night's failures as reviewed.
if (has("mark-checked")) {
  state.checkpoints = state.checkpoints || {};
  let moved = 0;
  for (const su of suites) {
    if (!su.latest) continue;
    const cur = state.checkpoints[su.id];
    if (cur && Number(cur.ts) >= Number(su.latest.ts)) continue;
    state.checkpoints[su.id] = { ts: su.latest.ts, iso: su.latest.iso, at: new Date().toISOString() };
    moved++;
  }
  saveState(state);
  console.log(
    moved
      ? `\n✔ Signed off ${moved} suite(s). Tomorrow's report starts after these runs.`
      : `\nNothing to sign off — every suite was already checked up to its latest run.`,
  );
} else if (suites.some((su) => su.newRuns.length)) {
  console.log(
    `When you have finished triaging: node tools/bin/report.js --mark-checked   # so tomorrow starts from here`,
  );
}
