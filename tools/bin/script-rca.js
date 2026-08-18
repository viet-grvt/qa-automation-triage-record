#!/usr/bin/env node
/**
 * script-rca.js — build the evidence pack for every SCRIPT-labelled failure, and record the
 * root cause once it is known.
 *
 * Analyse (writes reports/<date>/script-rca.md):
 *   node tools/bin/script-rca.js
 *   node tools/bin/script-rca.js --test "Verify limit sell order..."   # just one
 *   node tools/bin/script-rca.js --json
 *
 * Record a verdict:
 *   node tools/bin/script-rca.js --record --test "..." --channel web-staging \
 *     --cause fixed-sleep --detail "waitForTimeout(3000) before the order book renders" \
 *     --action fix --owner me --prevention "shared waitForOrderBook helper"  *     --pr <link> --verify "5 consecutive runs green" --category "fixed sleep → polling"
 *
 * Quarantine also requires: --review-date <YYYY-MM-DD> --delay-reason "..." --risk "..."
 *
 * Causes are the QE-935 vocabulary plus an escape hatch:
 *   fixed-sleep | brittle-locator | race-condition | test-data | assertion-wrong |
 *   missing-testid | shared-state | env-dependency | obsolete | other
 * Actions: fix | quarantine | rewrite | request-testid | wont-fix
 */
import fs from "node:fs";
import path from "node:path";
import {
  loadConfig,
  loadState,
  saveState,
  loadTestIndex,
  paths,
  normTitle,
  todayInTz,
} from "../lib/state.js";
import { findOwner, recentCommits } from "../lib/hints.js";
import { scanFile, context, localImports } from "../lib/smells.js";
import { proposeFix, fixPlan } from "../lib/propose.js";
import {
  prettyDate,
  areaFromFile,
  plainWhere,
  shortNote,
  CAUSES_PLAIN,
  ACTIONS_PLAIN,
} from "../lib/plain.js";

const argv = process.argv.slice(2);
const has = (n) => argv.includes(`--${n}`);
const getArg = (n, d = null) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : d;
};

const CAUSES = [
  "fixed-sleep",
  "brittle-locator",
  "race-condition",
  "test-data",
  "assertion-wrong",
  "missing-testid",
  "shared-state",
  "env-dependency",
  "obsolete",
  "other",
];
const ACTIONS = ["fix", "quarantine", "rewrite", "request-testid", "wont-fix"];

const cfg = loadConfig();
const state = loadState();
const index = loadTestIndex();
const date = getArg("date", todayInTz(cfg.timezone));

function findTests() {
  const title = getArg("test");
  let list = Object.values(state.tests).filter((t) => t.label === "SCRIPT" && !t.stale);
  if (title) {
    const n = normTitle(title);
    list = list.filter((t) => normTitle(t.title) === n || normTitle(t.title).includes(n));
  }
  const channel = getArg("channel");
  if (channel) list = list.filter((t) => t.channelKey === channel);
  return list;
}

// ------------------------------------------------------------------ record mode
if (has("record")) {
  const cause = getArg("cause");
  const action = getArg("action");
  if (!cause || !action) {
    console.error(`Required: --cause <${CAUSES.join("|")}> --action <${ACTIONS.join("|")}>`);
    process.exit(2);
  }
  if (!CAUSES.includes(cause)) {
    console.error(`Unknown --cause "${cause}". Valid: ${CAUSES.join(", ")}`);
    process.exit(2);
  }
  if (!ACTIONS.includes(action)) {
    console.error(`Unknown --action "${action}". Valid: ${ACTIONS.join(", ")}`);
    process.exit(2);
  }
  const targets = findTests();
  if (!targets.length) {
    console.error("No SCRIPT-labelled test matches. Run without --record to see the list.");
    process.exit(1);
  }
  if (targets.length > 1) {
    console.error(`Matched ${targets.length} tests — narrow it down with --test / --channel:`);
    for (const t of targets) console.error(`  - [${t.channelKey}] ${t.title}`);
    process.exit(1);
  }
  const t = targets[0];
  t.rca = {
    ...(t.rca || {}),
    date,
    cause,
    detail: getArg("detail") || t.rca?.detail || null,
    action,
    owner: getArg("owner") || t.rca?.owner || null,
    file: getArg("file") || t.rca?.file || null,
    pr: getArg("pr") || t.rca?.pr || null,
    // The Block 1 format makes these mandatory: a fix without a prevention step is a fix that
    // comes back, and a quarantine without a review date is a deleted test.
    category: getArg("category") || t.rca?.category || null,
    prevention: getArg("prevention") || t.rca?.prevention || null,
    verify: getArg("verify") || t.rca?.verify || null,
    delayReason: getArg("delay-reason") || t.rca?.delayReason || null,
    reviewDate: getArg("review-date") || t.rca?.reviewDate || null,
    coverageRisk: getArg("risk") || t.rca?.coverageRisk || null,
  };
  if (getArg("owner")) t.owner = getArg("owner");
  if (getArg("eta")) t.eta = getArg("eta");
  if (action === "quarantine") t.quarantined = true;

  const gaps = [];
  if (!t.rca.prevention) gaps.push("--prevention (what stops this class of failure coming back)");
  if (action === "fix" || action === "rewrite") {
    if (!t.rca.pr) gaps.push("--pr <link>");
    if (!t.rca.verify) gaps.push('--verify "5 consecutive runs green"');
  }
  if (action === "quarantine") {
    if (!t.rca.reviewDate) gaps.push("--review-date <YYYY-MM-DD>");
    if (!t.rca.delayReason) gaps.push("--delay-reason \"why it cannot be fixed now\"");
    if (!t.rca.coverageRisk) gaps.push("--risk \"which flow loses coverage\"");
    if (!t.ticket) gaps.push("a tracking ticket (set it with classify.js --ticket)");
  }
  saveState(state);
  console.log(`✔ [${t.channelKey}] ${t.title}`);
  console.log(`  root cause: ${cause}${t.rca.detail ? ` — ${t.rca.detail}` : ""}`);
  console.log(`  action: ${action}${t.rca.owner ? ` (owner: ${t.rca.owner})` : ""}`);
  if (gaps.length) {
    console.log(`  the Block 1 SCRIPT block still needs:`);
    for (const g of gaps) console.log(`    - ${g}`);
  }
  const left = Object.values(state.tests).filter((x) => x.label === "SCRIPT" && !x.stale && !x.rca).length;
  console.log(left ? `${left} SCRIPT failure(s) still without a root cause.` : "Every SCRIPT failure has a root cause on file. ✅");
  process.exit(0);
}

// ------------------------------------------------------------------ analyse mode
const targets = findTests();
const results = targets.map((t) => {
  const owner = findOwner(t, index);
  const scan = owner ? scanFile(cfg.repoPath, owner.file) : null;
  const commits = owner ? recentCommits(cfg.repoPath, owner.file, 30) : [];

  // Hits near the declared test line are far more likely to be the actual cause than hits
  // elsewhere in a large spec file.
  const near = scan?.exists
    ? scan.hits
        .map((h) => ({ ...h, distance: Math.abs(h.line - owner.line) }))
        .sort((a, b) => a.distance - b.distance)
    : [];

  // The spec usually delegates to a page object / helper — scan those too.
  // Rank imported files by how likely they sit on THIS test's path: a file whose name echoes the
  // test title beats a bigger file the test barely touches.
  const titleWords = normTitle(t.title).split(" ").filter((x) => x.length > 3);
  const relevance = (file) => {
    const base = file.split("/").pop().replace(/[.](ts|js)$/, "").toLowerCase();
    return titleWords.filter((x) => base.includes(x)).length;
  };
  const related = owner
    ? localImports(cfg.repoPath, owner.file)
        .map((f) => ({ ...scanFile(cfg.repoPath, f), relevance: relevance(f) }))
        .filter((r) => r.exists && r.hits.length)
        .sort((a, b) => b.relevance - a.relevance || b.hits.length - a.hits.length)
    : [];

  const failVariants = [...new Set((t.history || []).filter((h) => h.status === "fail").map((h) => h.variant).filter(Boolean))];
  const passVariants = [...new Set((t.history || []).filter((h) => h.status === "pass").map((h) => h.variant).filter(Boolean))];
  const lastFail = [...(t.history || [])].reverse().find((h) => h.status === "fail");

  // Timing shape: intermittent points at a race/sleep; always-red points at obsolete or a
  // genuine product change the test never accounted for.
  let shape = "unclear";
  if ((t.observed || 0) < 3) {
    // One or two data points cannot tell "always broken" apart from "unlucky once".
    shape = "too-early";
  } else if (t.failRate10 != null) {
    if (t.failRate10 >= 90) shape = "always-red";
    else if (t.failRate10 <= 30) shape = "rare";
    else shape = "intermittent";
  }

  const likely = [];
  if (near.some((h) => h.id === "fixed-sleep") && shape !== "always-red") likely.push("fixed-sleep");
  if (near.some((h) => h.id === "xpath-locator" || h.id === "text-locator")) likely.push("brittle-locator");
  if (near.some((h) => h.id === "nth-index")) likely.push("brittle-locator");
  if (near.some((h) => h.id === "shared-mutable-state")) likely.push("shared-state");
  if (near.some((h) => h.id === "hardcoded-account")) likely.push("test-data");
  if (near.some((h) => h.id === "conditional-assert" || h.id === "empty-catch")) likely.push("assertion-wrong");
  if (shape === "intermittent" && !likely.includes("fixed-sleep")) likely.push("race-condition");
  if (shape === "always-red" && commits.length === 0 && (t.observed || 0) >= 5) likely.push("obsolete");
  if (failVariants.length === 1 && passVariants.length > 0 && !passVariants.includes(failVariants[0])) {
    likely.push("env-dependency");
  }

  // Has this exact test been "fixed" before? A prior fix commit that names the same test means
  // the earlier root cause was never the real one — that changes the action from fix to rewrite.
  const titleToks = normTitle(t.title).split(" ").filter((x) => x.length > 4);
  const priorFixes = commits.filter((c) => {
    const subj = normTitle(c.subject);
    if (!/fix|repair|stabil/.test(subj)) return false;
    const hit = titleToks.filter((x) => subj.includes(x)).length;
    return titleToks.length > 0 && hit / titleToks.length >= 0.4;
  });

  const relatedIds = new Set(related.flatMap((r) => r.hits.map((h) => h.id)));
  if (relatedIds.has("fixed-sleep") && shape !== "always-red") likely.push("fixed-sleep");
  if (relatedIds.has("xpath-locator") || relatedIds.has("text-locator") || relatedIds.has("nth-index")) {
    likely.push("brittle-locator");
  }

  const plan = fixPlan({
    causes: [...new Set(likely)],
    near,
    related,
    priorFixes,
    shape,
    failVariants,
    passVariants,
  });

  return {
    t,
    owner,
    plan,
    scan,
    related,
    commits,
    near,
    shape,
    failVariants,
    passVariants,
    lastFail,
    priorFixes,
    likely: [...new Set(likely)],
  };
});

if (has("json")) {
  console.log(JSON.stringify(results.map((r) => ({ ...r, t: { key: r.t.key, title: r.t.title } })), null, 2));
  process.exit(0);
}

// ---------------------------------------------------------------- shared causes
// When several tests trace back to the same page object, the fix is that file — not N separate
// patches. That is the single most useful thing on this page, so it goes first.
const byFile = new Map();
for (const r of results) {
  for (const rel of r.related || []) {
    const e = byFile.get(rel.file) || { file: rel.file, tests: [], hits: rel.hits.length, byId: rel.byId };
    e.tests.push(r.t.title);
    byFile.set(rel.file, e);
  }
}
const sharedFiles = [...byFile.values()]
  .filter((e) => e.tests.length > 1)
  .sort((a, b) => b.tests.length - a.tests.length);
const causeCount = {};
for (const r of results) for (const c of r.likely) causeCount[c] = (causeCount[c] || 0) + 1;
const topCauses = Object.entries(causeCount).sort((a, b) => b[1] - a[1]);

const outDir = path.join(paths.reports, date);
fs.mkdirSync(outDir, { recursive: true });
const L = [];
const w = (s = "") => L.push(s);

w(`# Why our own tests are failing — ${prettyDate(date + "T00:00:00Z")}`);
w(``);
w(
  `These ${results.length} test${results.length === 1 ? " was" : "s were"} judged to be **our fault, not the product's**. This page says why each one breaks and what to change.`,
);
w(``);
w(
  `Everything below comes from reading the test code automatically. It is a strong starting point, not proof — the run log is what settles it.`,
);
w(``);

if (sharedFiles.length) {
  const top = sharedFiles[0];
  w(`## Start here`);
  w(``);
  w(
    `**${top.tests.length} of these ${results.length} failures go through the same file — \`${top.file}\`.** Fixing that one file is worth more than fixing the tests one at a time, because each individual patch only buys a few days before the next change breaks it again.`,
  );
  w(``);
  w(`| File | Failing tests using it | Problems found |`);
  w(`|---|---|---|`);
  for (const e of sharedFiles.slice(0, 5)) {
    w(`| \`${e.file}\` | ${e.tests.length} | ${e.hits} |`);
  }
  w(``);
  if (topCauses.length) {
    w(
      `Across all ${results.length}, the recurring problems are: ${topCauses
        .map(([c, n]) => `${CAUSES_PLAIN[c]?.title.toLowerCase() || c}${n > 1 ? ` (${n} tests)` : ""}`)
        .join("; ")}.`,
    );
    w(``);
  }
  w(
    `Anything that has no stable label for the tests to grab becomes **one** request to the frontend team rather than several — that is the action QE-935 asks for, and it is what moves the flakiness number instead of resetting a streak for a day.`,
  );
  w(``);
} else if (topCauses.length > 1) {
  w(`## Start here`);
  w(``);
  w(
    `These failures do not share a file, so each needs its own fix. The recurring problems are: ${topCauses
      .map(([c, n]) => `${CAUSES_PLAIN[c]?.title.toLowerCase() || c}${n > 1 ? ` (${n} tests)` : ""}`)
      .join("; ")}.`,
  );
  w(``);
}

/** Print the before/after for one hit, when a concrete rewrite can be derived. */
function renderFix(h) {
  const fix = proposeFix(h);
  if (!fix) {
    w(`- Fix: ${h.fix}`);
    w(``);
    return;
  }
  w(
    `- Fix (${fix.confidence === "mechanical" ? "mechanical rewrite — still verify it" : "shape is clear, target needs your judgement"}):`,
  );
  w(``);
  w("```diff");
  for (const line of fix.before.split("\n")) w(`- ${line}`);
  for (const line of fix.after.split("\n")) w(`+ ${line}`);
  w("```");
  w(``);
  if (fix.note) w(`  ${fix.note}`);
  if (fix.needsFe) w(`  ⚠️ Needs FE/mobile to add \`${fix.needsFe}\` — raise it today, quarantine meanwhile.`);
  w(``);
}

if (!results.length) {
  w(`No test is currently labelled \`SCRIPT\`. Label one in Block 1 first, then run this.`);
} else {
  for (const [i, r] of results.entries()) {
    const { t, owner, scan, related, commits, near, shape, failVariants, passVariants, lastFail, priorFixes, likely, plan } = r;
    const area = areaFromFile(owner?.file);
    const topCause = t.rca?.cause || likely[0];
    const explain = CAUSES_PLAIN[topCause];

    w(`## ${i + 1}. ${t.title}`);
    w(``);
    w(`${area ? `**Area:** ${area} · ` : ""}**Where:** ${plainWhere({ env: t.env, adhoc: t.env === "mixed" }, t.testType)}`);
    w(``);
    w(
      `**How it fails.** ${
        shape === "too-early"
          ? `Only ${t.observed} run${t.observed === 1 ? " has" : "s have"} been recorded for this test so far, which is not enough to tell a real pattern from bad luck.`
          : shape === "always-red"
            ? `It fails every single time it runs — ${t.consecutiveFails} in a row.`
            : shape === "intermittent"
              ? `It passes some runs and fails others with nothing changing in between (${t.failRate10}% of the last ${Math.min(t.observed, 10)} runs failed).`
              : `It fails occasionally — ${t.failRate10}% of the last ${Math.min(t.observed, 10)} runs.`
      }${failVariants.length === 1 && passVariants.length ? ` It only ever fails on ${failVariants[0]}.` : ""}`,
    );
    w(``);
    w(
      `**Most likely cause.** ${
        !t.rca && shape === "too-early"
          ? "Too early to say. Let it run a few more times, or read the log from the one failure we have."
          : explain
            ? `${explain.title}. ${explain.why}`
            : "Not clear from the code alone — the run log has to decide this one."
      }`,
    );
    if (t.rca) {
      w(``);
      w(
        `**Already decided:** ${ACTIONS_PLAIN[t.rca.action] || t.rca.action}${t.rca.detail ? ` (${shortNote(t.rca.detail, 140)?.text})` : ""}`,
      );
    }
    if (priorFixes.length) {
      w(``);
      w(
        `⚠️ **This was already "fixed" once and came back** — ${priorFixes.map((c) => `${prettyDate(c.date)}, "${c.subject}"`).join("; ")}. Whatever was changed then did not address the real cause, so patching it a second time is unlikely to hold.`,
      );
    }
    const tnote = shortNote(t.note);
    if (tnote) {
      w(``);
      w(`**Note from triage:** ${tnote.text}`);
    }
    w(``);

    if (!owner) {
      w(
        `**Cannot go further yet.** This test is not in the local copy of the repo, so its code could not be read. Run \`git -C ${cfg.repoPath} pull\` and \`node tools/bin/index-tests.js\`, then run this again.`,
      );
      w(``);
      continue;
    }

    w(`**What to change.**`);
    w(``);
    for (const [n, step] of plan.entries()) {
      w(`${n + 1}. ${step.what} — _${step.effort}_`);
      w(`   ${step.why}`);
      if (step.needsOthers) w(`   ⚠️ ${step.needsOthers}`);
    }
    w(``);
    w(`<details><summary>The code, the evidence, and the exact edits</summary>`);
    w(``);

    w(`### Source`);
    w(``);
    w(`\`${owner.file}:${owner.line}\` (${owner.confidence} match, file has ${scan.lines} lines)`);
    w(``);
    if (lastFail?.runId) {
      w(`Run log for the latest failure:`);
      w("```bash");
      w(`gh run view ${lastFail.runId} --log-failed -R ${cfg.repoSlug} | head -120`);
      w("```");
      w(``);
    }

    w(`### Anti-patterns near the test (${near.length} hit(s) in this file)`);
    w(``);
    if (!near.length) {
      w(
        `No static anti-pattern found. That points away from the test code itself — check the run log, the fixture/page-object it calls, and whether the product actually changed.`,
      );
      w(``);
    } else {
      for (const h of near.slice(0, 6)) {
        w(`**${h.what}** — \`${owner.file}:${h.line}\` (${h.severity}, ${h.distance} lines from the test)`);
        w(``);
        w("```ts");
        for (const c of context(cfg.repoPath, owner.file, h.line, 3)) {
          w(`${String(c.line).padStart(5)}${c.line === h.line ? " >" : "  "} ${c.text}`);
        }
        w("```");
        w(``);
        w(`- Why it breaks: ${h.why}`);
        renderFix(h);
      }
      if (near.length > 6) w(`_${near.length - 6} further hit(s) in this file, further from the test._`);
      w(``);
    }

    if (related.length) {
      w(`### Anti-patterns in the page objects / helpers this spec imports`);
      w(``);
      w(`| File | Hits | Kinds | On this test's path? |`);
      w(`|---|---|---|---|`);
      for (const rel of related.slice(0, 6)) {
        w(
          `| \`${rel.file}\` | ${rel.hits.length} | ${Object.keys(rel.byId).join(", ")} | ${rel.relevance ? "likely — the filename matches the test" : "imported, relevance unclear"} |`,
        );
      }
      w(``);
      const worst = related[0].hits.filter((h) => h.severity === "high").slice(0, 2);
      for (const h of worst) {
        w(`**${h.what}** — \`${related[0].file}:${h.line}\``);
        w(``);
        w("```ts");
        for (const c of context(cfg.repoPath, related[0].file, h.line, 2)) {
          w(`${String(c.line).padStart(5)}${c.line === h.line ? " >" : "  "} ${c.text}`);
        }
        w("```");
        w(``);
        w(`- ${h.why}`);
        renderFix(h);
      }
    }

    if (commits.length) {
      w(`### File history (30 days)`);
      w(``);
      for (const c of commits.slice(0, 5)) w(`- \`${c.hash}\` ${c.date} ${c.author} — ${c.subject}`);
      w(``);
    }

    w(`### Likely cause`);
    w(``);
    if (likely.length) {
      for (const c of likely) w(`- \`${c}\``);
    } else {
      w(`- undetermined from static signals alone — the run log decides this one`);
    }
    w(``);
    w(`</details>`);
    w(``);
    w(`**Record the decision**`);
    w(``);
    w("```bash");
    w(
      `node tools/bin/script-rca.js --record --test "${t.title.replace(/"/g, '\\"')}" --channel ${t.channelKey} \\`,
    );
    w(`  --cause <${likely[0] || CAUSES.join("|")}> --action <${ACTIONS.join("|")}> --detail "..." --owner me`);
    w("```");
    w(``);
    w(
      `> Reminder: a \`SCRIPT\` failure on a smoke suite breaks the QE-935 100% accuracy goal, so it is either fixed today or quarantined with a ticket.`,
    );
    w(``);
  }
}

const outFile = path.join(outDir, "script-rca.md");
fs.writeFileSync(outFile, L.join("\n") + "\n");
console.log(`Wrote ${path.relative(paths.root, outFile).replace(/\\/g, "/")}`);
console.log(
  `${results.length} SCRIPT failure(s) analysed, ${results.filter((r) => !r.t.rca).length} still without a recorded root cause.`,
);
