/**
 * Plain-language layer.
 *
 * The reports are read by people who did not build this tool — manual QA, a lead skimming before
 * standup, a developer who just got tagged. Every number in here has to arrive as a sentence that
 * makes sense on its own, with the jargon glossed the first time it appears and never assumed.
 *
 * Rule of thumb for everything below: if a sentence needs the reader to already know what a
 * "suite key" or a "variant" is, it is the wrong sentence.
 */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function prettyDate(iso) {
  if (!iso) return "unknown";
  const d = new Date(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** "today 10:02" / "yesterday 15:48" / "3 days ago" — relative to the report's anchor. */
export function prettyWhen(iso, anchor = Date.now()) {
  if (!iso) return "unknown";
  const hours = (anchor - Date.parse(iso)) / 36e5;
  const time = iso.slice(11, 16);
  if (hours < 0) return `${prettyDate(iso)} ${time}`;
  if (hours < 14) return `today ${time}`;
  if (hours < 38) return `yesterday ${time}`;
  return `${Math.round(hours / 24)} days ago (${prettyDate(iso)})`;
}

export function prettyAge(hours) {
  if (hours == null) return "never";
  if (hours < 1) return `${Math.round(hours * 60)} min ago`;
  if (hours < 24) return `${Math.round(hours)}h ago`;
  return `${Math.round(hours / 24)} days ago`;
}

/** What the three triage labels actually mean, in one clause each. */
export const LABELS = {
  ENV: {
    short: "environment problem",
    plural: "environment problems",
    long: "the test environment broke, not the product and not our test",
    who: "infra — we do not change the test",
  },
  "APP-BUG": {
    short: "real product bug",
    plural: "real product bugs",
    long: "the product genuinely misbehaves; a customer could hit this",
    who: "the dev team — needs a PRO ticket",
  },
  SCRIPT: {
    short: "our test is wrong",
    plural: "caused by our own tests",
    long: "the product is fine; our automated test is flaky, outdated or badly written",
    who: "us — QA automation",
  },
};

export function labelPhrase(label) {
  if (!label) return "not decided yet";
  const l = LABELS[label];
  return l ? `${label} — ${l.short}` : label;
}

/** The failure pattern, as a sentence rather than a percentage. */
export function plainPattern(t) {
  const streak = t.consecutiveFails || 0;
  const rate = t.failRate10;
  const seen = Math.min(t.observed || 0, 10);
  const since = prettyDate(t.firstSeen);

  if (streak >= 5) {
    return `Broken and staying broken — it has failed ${streak} runs in a row since ${since}.`;
  }
  if (rate != null && rate >= 90 && seen >= 3) {
    return `Fails almost every time it runs (${seen === 1 ? "1 run" : `${seen} recent runs`} checked, since ${since}).`;
  }
  if (streak === 0) {
    return `It failed earlier but the latest run passed, so it is green again right now.`;
  }
  if (rate != null && rate >= 20 && rate <= 80) {
    return `Comes and goes — failed ${Math.round((rate / 100) * seen)} of the last ${seen} runs. That on-and-off pattern usually means a timing problem, not a broken feature.`;
  }
  if (streak === 1 && (rate == null || rate <= 20)) {
    return `First failure after a run of green results — could easily be a one-off.`;
  }
  if (seen <= 2) {
    return `Only seen ${seen} time${seen === 1 ? "" : "s"} so far (first on ${since}) — too little history to call it yet.`;
  }
  return `Failed ${streak} run${streak === 1 ? "" : "s"} in a row, first seen ${since}.`;
}

/** Why it matters, phrased for whoever is reading. */
export function plainImpact(channel, test) {
  const env = String(channel?.env || test?.env || "").toLowerCase();
  if (env === "prod") {
    return "This is **production** — the same thing may be happening to real customers right now.";
  }
  if (env === "staging") {
    return "Staging only. No customer impact, but while it is red the staging smoke run tells us nothing.";
  }
  if (env === "testnet") {
    return "Testnet only. No customer impact; it does hide any new problem in the same area.";
  }
  if (env === "mixed") {
    return "This came from a manually triggered run, so which environment it hit varies — check the run before drawing conclusions.";
  }
  return "No customer impact identified.";
}

/** One sentence on what the evidence points at, before any label has been applied. */
export function plainReading(t, { variantOnly, commits, crossChannelCount, shape }) {
  if (variantOnly) {
    return `It only fails on **${variantOnly}** and passes everywhere else, so it is specific to that browser/device rather than broken for everyone.`;
  }
  if (crossChannelCount >= 2) {
    return `The same test is failing in ${crossChannelCount} different environments at once, which points at the product rather than at our test.`;
  }
  if (commits?.length && (t.consecutiveFails || 0) <= 3) {
    return `The test file was edited on ${prettyDate(commits[0].date)} and it started failing around then — check that change first.`;
  }
  if (shape === "intermittent") {
    return `It passes sometimes and fails other times with no code change in between, which normally means the test does not wait long enough for something.`;
  }
  if ((t.consecutiveFails || 0) >= 5 && !commits?.length) {
    return `Nobody has touched this test recently, yet it fails every run — so something in the product or the environment changed under it.`;
  }
  return `Not enough signal yet to say whose fault it is — the run log will settle it.`;
}

/** What to do next, given where the test has got to. */
export function plainAction(t, { quarantineAfter = 5, isProd = false }) {
  if (t.rca) {
    return `Root cause already recorded (${t.rca.cause}); the agreed action is **${t.rca.action}**.`;
  }
  if (!t.label) {
    if (isProd) return "**Decide today.** It is on production, so it cannot wait for tomorrow's check.";
    if ((t.consecutiveFails || 0) >= quarantineAfter) {
      return `**Decide today.** It has been failing for ${t.consecutiveFails} runs, which is past the point where "let's watch it" is still a decision.`;
    }
    return "Open the run log and decide whose fault it is: environment, product, or our test.";
  }
  if (t.label === "APP-BUG" && !t.ticket) return "**Raise a PRO ticket and tell the dev team.** No ticket exists yet.";
  if (t.label === "SCRIPT" && !t.rca) return "**Run /script-rca** to find out why our test is wrong before fixing anything.";
  if (t.label === "ENV") return "No test change needed. Worth adding a check that the environment is healthy before the suite runs.";
  if (t.ticket) return `Being tracked in ${t.ticket}.`;
  return "Decided — nothing further needed today.";
}

/** Turn a file path into the feature area a non-engineer would recognise. */
export function areaFromFile(file) {
  if (!file) return null;
  const parts = file.split("/");
  const i = parts.findIndex((p) => p === "tests" || p === "features");
  let name = null;
  if (i >= 0 && parts.length > i + 2) name = parts[i + 1];
  else name = parts.at(-1)?.replace(/\.(spec\.ts|feature|ts|js)$/, "");
  if (!name) return null;
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

/** Health of one channel as a sentence. */
export function plainChannelHealth(c) {
  if (!c.runs?.length) {
    return `No results stored yet — this channel has never been read in.`;
  }
  if (c.stale) {
    return `⚠️ Nothing has run here for ${prettyAge(c.latestAgeH)}. Check the schedule before blaming any test.`;
  }
  const green = c.window.filter((r) => r.green).length;
  const total = c.window.length;
  if (green === total) return `All ${total} recent runs passed cleanly.`;
  if (green === 0) return `Every one of the last ${total} runs had at least one failure.`;
  return `${green} of the last ${total} runs finished with zero failures.`;
}

/** Headline for the whole report. */
/** Where a test runs, in words. */
export function plainWhere(channel, testType) {
  const kind = testType === "smoke" ? "smoke" : testType === "regression" ? "regression" : testType;
  if (channel?.adhoc) return `a manually-triggered ${kind} run`;
  return `the ${channel?.env} ${kind} run`;
}

/** Keep a long human note readable in the main flow; the full text lives in the details block. */
export function shortNote(note, max = 180) {
  if (!note) return null;
  const clean = String(note).replace(/\s+/g, " ").trim();
  if (clean.length <= max) return { text: clean, truncated: false };
  const cut = clean.slice(0, max);
  const at = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf(" — "));
  return { text: (at > 80 ? cut.slice(0, at + 1) : cut) + " …", truncated: true };
}

/** Trim to a word boundary rather than mid-word. */
export function clip(text, max = 55) {
  const clean = String(text || "").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const sp = cut.lastIndexOf(" ");
  return (sp > max * 0.6 ? cut.slice(0, sp) : cut) + "…";
}

export function plainHeadline({ mustDoToday, redCount, prodInvolved, staleChannels }) {
  if (prodInvolved) {
    return `🔴 **Production is affected.** ${mustDoToday} thing${mustDoToday === 1 ? "" : "s"} need a decision today.`;
  }
  if (staleChannels) {
    return `🟠 **${staleChannels} channel${staleChannels === 1 ? "" : "s"} stopped reporting.** Fix that first — until then the results below are incomplete.`;
  }
  if (mustDoToday > 0) {
    return `🟠 **${mustDoToday} thing${mustDoToday === 1 ? " needs" : "s need"} a decision today.** ${redCount} test${redCount === 1 ? " is" : "s are"} failing in total.`;
  }
  if (redCount > 0) {
    return `🟡 **${redCount} test${redCount === 1 ? " is" : "s are"} failing**, none of them urgent. Worth a look, nothing is on fire.`;
  }
  return `🟢 **Everything is green.** Nothing needs a decision today.`;
}

/** What each root-cause code actually means, for someone who has never seen the vocabulary. */
export const CAUSES_PLAIN = {
  "fixed-sleep": {
    title: "The test waits a fixed number of seconds instead of waiting for the page",
    why: "When the site is slower than usual the wait runs out and the test fails even though nothing is broken.",
  },
  "brittle-locator": {
    title: "The test finds elements by their position or styling instead of a stable name",
    why: "Any change to the page layout or CSS moves the target, so the test stops finding the button it needs.",
  },
  "race-condition": {
    title: "The test acts before the page has finished updating",
    why: "Sometimes the page is ready in time and sometimes it is not, which is why it passes and fails at random.",
  },
  "test-data": {
    title: "The test depends on a specific account being in a specific state",
    why: "Balances, open positions and settings drift, so the test breaks without anyone touching the code.",
  },
  "assertion-wrong": {
    title: "The test checks the wrong thing, or skips its check entirely",
    why: "It can report success without actually verifying anything, which is worse than failing.",
  },
  "missing-testid": {
    title: "The element has no stable label for the test to grab",
    why: "Until the developers add one, any way of finding that element is guesswork that will break again.",
  },
  "shared-state": {
    title: "Tests in the same file leak state into each other",
    why: "The result depends on what ran before it, so a failure early on knocks over everything after it.",
  },
  "env-dependency": {
    title: "It only breaks on one browser, device or environment",
    why: "The test logic is fine elsewhere, so this is about that specific platform, not about the test as a whole.",
  },
  obsolete: {
    title: "The test checks a flow the product no longer has",
    why: "It will never pass again until it is rewritten or removed.",
  },
  other: { title: "Cause outside the usual list", why: "Needs a written explanation from whoever investigated." },
};

export const ACTIONS_PLAIN = {
  fix: "Fix the test now — the cause is small and local.",
  rewrite: "Rewrite it — patching it again will not hold.",
  quarantine: "Switch it off for now, with a ticket so it is not forgotten.",
  "request-testid": "Ask the developers for a stable label on the element, then fix the test.",
  "wont-fix": "Leave it — the test is no longer worth keeping.",
};
