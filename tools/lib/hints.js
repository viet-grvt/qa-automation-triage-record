import { execFileSync } from "node:child_process";
import { normTitle } from "./state.js";

/** Locate the file that owns a test, using the generated test index. */
export function findOwner(test, index) {
  if (!index?.entries?.length) return null;
  const n = normTitle(test.title);
  const suite = test.platform === "mobile" ? "mobile" : "web";
  const pool = index.entries.filter((e) => e.suite === suite);

  const exact = pool.filter((e) => e.norm === n);
  if (exact.length) return { ...pick(exact), confidence: "exact" };

  const contains = pool.filter((e) => e.norm.includes(n) || n.includes(e.norm));
  if (contains.length) return { ...pick(contains), confidence: "partial" };

  // Token overlap: require at least 60% of the significant words to match.
  const toks = new Set(n.split(" ").filter((t) => t.length > 3));
  let best = null;
  for (const e of pool) {
    const et = new Set(e.norm.split(" ").filter((t) => t.length > 3));
    if (!et.size || !toks.size) continue;
    let hit = 0;
    for (const t of toks) if (et.has(t)) hit++;
    const score = hit / toks.size;
    if (score >= 0.6 && (!best || score > best.score)) best = { e, score };
  }
  return best ? { ...best.e, confidence: `fuzzy ${Math.round(best.score * 100)}%` } : null;
}

function pick(list) {
  // Prefer a real test/scenario declaration over an arbitrary string literal.
  return list.find((e) => e.kind !== "literal") || list[0];
}

/** Recent git history for a test file — the main signal for suspecting a SCRIPT defect. */
export function recentCommits(repo, file, days = 14) {
  if (!file) return [];
  try {
    const out = execFileSync(
      "git",
      ["log", `--since=${days}.days`, "--pretty=%h|%ad|%an|%s", "--date=short", "--", file],
      { cwd: repo, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    );
    return out
      .split("\n")
      .filter(Boolean)
      .map((l) => {
        const [hash, date, author, ...rest] = l.split("|");
        return { hash, date, author, subject: rest.join("|") };
      });
  } catch {
    return [];
  }
}

/**
 * Suggest an ENV / APP-BUG / SCRIPT label. This is a hint with stated reasons —
 * the final call is made by a human (or by Claude after reading the actual logs).
 */
export function suggestLabel(test, ctx) {
  const reasons = [];
  let label = null;

  if (test.label) {
    return {
      label: test.label,
      confidence: "carry-over",
      reasons: [
        `already classified as ${test.label} on ${test.labelDate || "?"}${test.ticket ? ` (${test.ticket})` : ""}`,
      ],
    };
  }

  const { crossChannelCount = 1, latestRun, commits = [], thresholds } = ctx;
  const rate = test.failRate10;

  if (latestRun?.infra || latestRun?.partial) {
    reasons.push("latest run had zero passes or timed out — points at infrastructure, not the test");
    label = "ENV";
  }

  if (crossChannelCount >= 2) {
    reasons.push(`same test failing in ${crossChannelCount} environments — leans towards a product defect`);
    label ||= "APP-BUG";
  }

  if (commits.length && test.consecutiveFails <= 3) {
    const c = commits[0];
    reasons.push(`test file changed on ${c.date} (${c.hash} ${c.author}) — check for a script regression first`);
    label = "SCRIPT";
  }

  if (rate != null && rate >= 20 && rate <= 80 && test.consecutiveFails < 3) {
    reasons.push(`failed ${rate}% of the last 10 runs, alternating red/green — flaky signature`);
    label ||= "SCRIPT";
  }

  if (test.consecutiveFails >= (thresholds?.quarantineAfterConsecutiveFails ?? 5)) {
    reasons.push(
      `red for ${test.consecutiveFails} consecutive runs — past the "watch it a bit longer" point: it needs a ticket or a quarantine today`,
    );
    label ||= "APP-BUG";
  }

  if (test.consecutiveFails === 1 && (rate == null || rate <= 10)) {
    reasons.push("first failure after a green streak — read the log once, no larger action yet");
  }

  if (!label) reasons.push("not enough signal — open the log or report to decide");
  return { label, confidence: label ? "heuristic" : "unknown", reasons };
}
