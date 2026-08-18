import fs from "node:fs";
import path from "node:path";

/**
 * Static anti-pattern scan for a test file. These are the failure modes behind most
 * SCRIPT-labelled failures, and they map directly onto the QE-935 action list:
 * explicit auto-waits instead of implicit ones, dynamic polling instead of fixed sleeps,
 * and data-testid / accessibilityLabel instead of brittle locator chains.
 *
 * A hit is evidence, not a verdict. The line still has to be read in context.
 */
const RULES = [
  {
    id: "fixed-sleep",
    severity: "high",
    re: /\b(waitForTimeout|browser\.pause|driver\.pause|setTimeout\s*\(\s*resolve)\b/,
    what: "Fixed sleep",
    why: "A hard-coded wait is either too short (flaky under load) or too slow. It cannot adapt to a slower environment.",
    fix: "Replace with a condition-based wait: expect(locator).toBeVisible() / waitForResponse / waitUntil on the actual state.",
  },
  {
    id: "arbitrary-timeout",
    severity: "medium",
    re: /timeout:\s*\d{4,}/,
    what: "Large inline timeout",
    why: "A big inline timeout usually papers over an unreliable wait rather than fixing it, and it slows every run down.",
    fix: "Wait for the specific state that is actually being awaited, and set the timeout centrally in the config.",
  },
  {
    id: "xpath-locator",
    severity: "high",
    re: /(\/\/\*?\[|xpath\s*[:=]|By\.xpath)/,
    what: "XPath locator",
    why: "XPath chains break on any DOM restructure, which is exactly the kind of failure that gets misread as a product bug.",
    fix: "Use getByTestId (Web) / accessibilityLabel (Mobile). If the attribute is missing, request it from FE/mobile the same day.",
  },
  {
    id: "text-locator",
    severity: "medium",
    re: /(getByText|hasText|text=|byText)\(/,
    what: "Locator matched on visible text",
    why: "It breaks on every copy change and fails in any locale other than the one it was written for.",
    fix: "Match on a stable test id; keep text assertions for what is actually being asserted, not for finding the element.",
  },
  {
    id: "nth-index",
    severity: "medium",
    re: /\.(nth|eq)\(\s*\d+\s*\)|\[\s*\d+\s*\]\s*\.click/,
    what: "Element selected by position",
    why: "Positional selection silently targets a different element as soon as ordering or data changes.",
    fix: "Select by a stable identifier or by filtering on content that is meaningful to the test.",
  },
  {
    id: "conditional-assert",
    severity: "high",
    re: /if\s*\(.*(isVisible|isDisplayed|count\(\)|exists)/,
    what: "Assertion behind a condition",
    why: "A test that skips its own assertion when the element is absent passes green while verifying nothing.",
    fix: "Assert the expected state unconditionally; if both branches are legitimate, split into two tests.",
  },
  {
    id: "empty-catch",
    severity: "high",
    re: /catch\s*\([^)]*\)\s*\{\s*\}/,
    what: "Swallowed exception",
    why: "The real error is discarded, so the run fails later somewhere unrelated and triage starts from the wrong place.",
    fix: "Let it throw, or log the error and fail with a message that names what went wrong.",
  },
  {
    id: "shared-mutable-state",
    severity: "medium",
    re: /^(let|var)\s+\w+\s*=.*$/,
    scope: "module",
    what: "Mutable state at module level",
    why: "State leaks between tests, so results depend on execution order and on whether an earlier test failed.",
    fix: "Move it into a fixture or a beforeEach so each test starts from a known state.",
  },
  {
    id: "hardcoded-account",
    severity: "medium",
    re: /(0x[a-fA-F0-9]{20,}|@grvt\.io|password\s*[:=]\s*["'])/,
    what: "Hard-coded account or credential",
    why: "The test depends on the state of one specific account; anything that mutates it (balance, positions, KYC) breaks the test.",
    fix: "Take the account from env/fixture and reset the state the test needs in its own setup.",
  },
];

/** @returns {{file: string, exists: boolean, lines: number, hits: object[], byId: object}} */
export function scanFile(repo, relFile) {
  const abs = path.resolve(repo, relFile);
  if (!fs.existsSync(abs)) return { file: relFile, exists: false, lines: 0, hits: [], byId: {} };

  const src = fs.readFileSync(abs, "utf8").split(/\r?\n/);
  const hits = [];

  src.forEach((text, i) => {
    if (/^\s*(\/\/|\*|#)/.test(text)) return; // skip comments
    const indent = text.match(/^\s*/)[0].length;
    for (const rule of RULES) {
      if (rule.scope === "module" && indent > 0) continue;
      if (!rule.re.test(text)) continue;
      hits.push({
        id: rule.id,
        severity: rule.severity,
        what: rule.what,
        why: rule.why,
        fix: rule.fix,
        line: i + 1,
        code: text.trim().slice(0, 140),
      });
    }
  });

  const byId = {};
  for (const h of hits) byId[h.id] = (byId[h.id] || 0) + 1;
  return { file: relFile, exists: true, lines: src.length, hits, byId };
}

/** Pull the numbered line range around a hit, for quoting in a report. */
export function context(repo, relFile, line, radius = 4) {
  const abs = path.resolve(repo, relFile);
  if (!fs.existsSync(abs)) return [];
  const src = fs.readFileSync(abs, "utf8").split(/\r?\n/);
  const from = Math.max(0, line - 1 - radius);
  const to = Math.min(src.length, line + radius);
  return src.slice(from, to).map((text, i) => ({ line: from + i + 1, text }));
}

/**
 * Resolve the local modules a spec imports (page objects, helpers, fixtures). Most of the real
 * anti-patterns live there rather than in the spec, so an RCA that only reads the spec misses
 * the actual cause.
 */
export function localImports(repo, relFile, max = 8) {
  const abs = path.resolve(repo, relFile);
  if (!fs.existsSync(abs)) return [];
  const src = fs.readFileSync(abs, "utf8");
  const dir = path.dirname(abs);
  const out = [];
  const seen = new Set();

  for (const m of src.matchAll(/(?:from|require\()\s*["'](\.[^"']+)["']/g)) {
    const spec = m[1];
    for (const ext of ["", ".ts", ".js", "/index.ts", "/index.js"]) {
      const cand = path.resolve(dir, spec + ext);
      if (!fs.existsSync(cand) || fs.statSync(cand).isDirectory()) continue;
      const rel = path.relative(repo, cand).replace(/\\/g, "/");
      if (seen.has(rel)) break;
      seen.add(rel);
      out.push(rel);
      break;
    }
    if (out.length >= max) break;
  }
  return out;
}

export const rules = RULES;
