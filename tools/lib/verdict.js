/**
 * verdict.js — the first question of the morning review: is this failure a flaky test, or is the
 * product genuinely broken?
 *
 * This does NOT decide for you. It reads the pass/fail history the ingest already stores and says
 * which way the evidence points, what the evidence actually is, and what to open next to settle
 * it. The judgement stays with the person doing triage — a wrong "flaky" verdict is how a real
 * bug reaches users, so every leaning here carries its reasoning and its counter-check.
 *
 * Patterns, in the order they are tested:
 *
 *   too-early     fewer than 3 observations — nothing can be concluded yet
 *   intermittent  passes and fails on the same code — the signature of a flaky test
 *   variant-only  fails on exactly one browser/device while the others pass
 *   always-fails  red on every run since it started — deterministic, so something really changed
 *   first-time    failed once, never before — a one-off until it repeats
 */

/** Failures that land on one browser/device only, while every other variant passes. */
export function variantOnly(t) {
  const fails = new Set((t.history || []).filter((h) => h.status === "fail").map((h) => h.variant).filter(Boolean));
  const passes = new Set((t.history || []).filter((h) => h.status === "pass").map((h) => h.variant).filter(Boolean));
  if (fails.size === 1 && passes.size > 0) {
    const only = [...fails][0];
    if (!passes.has(only)) return only;
  }
  return null;
}

/** Pass→fail and fail→pass transitions inside the last `n` runs. */
function flips(history, n = 10) {
  const win = (history || []).slice(-n);
  let f = 0;
  for (let i = 1; i < win.length; i++) if (win[i].status !== win[i - 1].status) f++;
  return { flips: f, window: win.length };
}

/** ISO of the first failure in the current unbroken red streak. */
function streakStart(history) {
  const h = history || [];
  let i = h.length - 1;
  while (i >= 0 && h[i].status === "fail") i--;
  return h[i + 1]?.iso || null;
}

/**
 * Was the test's own file edited just before it started failing? A commit landing within a day of
 * the streak starting is the single most useful signal there is: it moves the suspicion from the
 * product onto our own change, and it is cheap to verify by reading the diff.
 */
function editedJustBefore(commits, sinceIso) {
  if (!sinceIso || !commits?.length) return null;
  const cut = Date.parse(sinceIso) - 36e5 * 24;
  return commits.find((c) => Date.parse(`${c.date}T23:59:59`) >= cut) || null;
}

export function stability(t, { commits = [] } = {}) {
  const history = t.history || [];
  const observed = history.length;
  const { flips: fl, window } = flips(history);
  const variant = variantOnly(t);
  const since = streakStart(history);
  const edit = editedJustBefore(commits, since);
  const why = [];
  const nextCheck = [];

  const passesInWindow = history.slice(-10).filter((h) => h.status === "pass").length;
  const failsInWindow = history.slice(-10).filter((h) => h.status === "fail").length;

  let pattern, leaning, plain;

  const lastFail = [...history].reverse().find((h) => h.status === "fail");
  const envTagged = history.some((h) => h.status === "fail" && h.group === "env-dependent");

  if (lastFail?.group === "blocked") {
    pattern = "blocked";
    leaning = "blocked";
    plain = `The run never got past its preflight account gate, so this test did not actually execute. The reporter says outright that a blocked run does not count toward the pass rate — it is evidence about the account setup, not about the test or the product.`;
    why.push("listed under BLOCKED (preflight) — the suite body never ran");
    nextCheck.push("Fix or re-run the gated account, then judge the test on the next run that actually executes. Do not classify it from this one.");
  } else if (envTagged) {
    // The test repo tags these @envDependent because they assert on pre-existing account state —
    // balance, open positions, vault shares, trade history. The reporter groups them separately for
    // exactly this reason, and it is the one signal that points at the environment before any log
    // is opened. It still is not proof: the same assertion fails when the product really breaks.
    pattern = "env-dependent";
    leaning = "env";
    plain = `The test repo tags this one @envDependent: it asserts on account state that has to be there already — a balance, an open position, vault shares, trade history. When it goes red the shared account has usually drifted, not the product.`;
    why.push("the reporter listed it under FAILED (env-dependent)");
    if (t.consecutiveFails > 1) why.push(`${t.consecutiveFails} consecutive failures — the account has not been restored`);
    nextCheck.push("Check the account state the test expects before touching anything else. If the state is right and it still fails, the tag is misleading and this is a real failure — classify it on the log, not on the tag.");
  } else if (observed < 3) {
    pattern = "too-early";
    leaning = "unclear";
    plain = `Only ${observed} run${observed === 1 ? "" : "s"} of this test are on record. That is not enough to tell a real problem from bad luck.`;
    why.push(`${observed} observation${observed === 1 ? "" : "s"} — no pattern yet`);
    nextCheck.push("Re-run it. If it fails again the pattern will show; if it passes, it was noise.");
  } else if (fl >= 2 && passesInWindow > 0 && failsInWindow > 0) {
    pattern = "intermittent";
    leaning = "flaky";
    plain = `It passed and failed ${fl} times back and forth over the last ${window} runs. The product does not change between two runs ten minutes apart, so the test itself is unreliable.`;
    why.push(`${fl} pass/fail flips in the last ${window} runs`);
    why.push(`${passesInWindow} passed, ${failsInWindow} failed in the same window`);
    nextCheck.push("Run `/script-rca` on it — the usual cause is a fixed sleep, a locator that depends on render order, or leftover state from another test.");
  } else if (variant) {
    pattern = "variant-only";
    leaning = "unclear";
    plain = `It fails only on ${variant} and passes everywhere else. That is either a real defect on ${variant}, or our locator only matches on the other engines — the two look identical from here.`;
    why.push(`every failure is on ${variant}; other variants pass`);
    nextCheck.push(`Open the flow on ${variant} by hand. If it is broken for a person, it is a product bug; if it works, the test is at fault.`);
  } else if (t.consecutiveFails >= 3 && passesInWindow === 0) {
    pattern = "always-fails";
    leaning = edit ? "flaky" : "genuine";
    plain = edit
      ? `Red on all ${t.consecutiveFails} runs since ${since?.slice(0, 10)}, and the test file was edited on ${edit.date} ("${edit.subject}") right before it started. Our own change is the first suspect.`
      : `Red on all ${t.consecutiveFails} runs in a row, never passing. A test that fails every single time is not flaky — something genuinely changed.`;
    why.push(`${t.consecutiveFails} consecutive failures, no pass in the last ${window} runs`);
    if (edit) why.push(`test file edited ${edit.date} by ${edit.author}: ${edit.subject}`);
    nextCheck.push(
      edit
        ? `Read that commit first: \`git show ${edit.hash}\`. If it changed the locator or the expectation, this is ours.`
        : "Reproduce the step by hand on that environment. If it fails for a person too, raise it as a product bug.",
    );
  } else if (t.consecutiveFails === 1 && observed >= 3 && failsInWindow === 1) {
    pattern = "first-time";
    leaning = "unclear";
    plain = `It has passed consistently until now and failed once. One failure is not a pattern — but it is also how a real regression begins.`;
    why.push(`first failure after ${observed - 1} clean runs`);
    nextCheck.push("Open the failure log. A timeout points at flakiness; a wrong value on screen points at the product.");
  } else {
    pattern = "mixed";
    leaning = "unclear";
    plain = `${failsInWindow} of the last ${window} runs failed, with no clean pattern either way.`;
    why.push(`${failsInWindow}/${window} runs failed`);
    nextCheck.push("Open the last failure log and compare it with the last passing run.");
  }

  return {
    pattern,
    leaning, // "flaky" | "genuine" | "unclear"
    plain,
    why,
    nextCheck,
    flips: fl,
    window,
    variant,
    since,
    edit,
    observed,
  };
}

/** Short label for the classification table. */
export const PATTERN_SHORT = {
  "too-early": "too early to say",
  intermittent: "flaky pattern",
  "variant-only": "one browser only",
  "always-fails": "fails every run",
  "first-time": "first failure",
  mixed: "no clear pattern",
  "env-dependent": "tagged @envDependent",
  blocked: "never ran — preflight gate",
};

export const LEANING_SHORT = {
  flaky: "🔁 likely our test",
  genuine: "🐞 likely the product",
  env: "🌍 likely the environment",
  blocked: "⛔ did not run",
  unclear: "❔ needs a look",
};

/** Which label the leaning suggests — a starting point for classification, never the answer. */
export function suggestedLabel(v) {
  if (v.leaning === "flaky") return "SCRIPT";
  if (v.leaning === "genuine") return "APP-BUG";
  if (v.leaning === "env") return "ENV";
  return null;
}
