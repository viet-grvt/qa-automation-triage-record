/**
 * Turn an anti-pattern hit into a concrete before/after suggestion.
 *
 * Two confidence levels, and the difference matters:
 *   "mechanical" — the rewrite is derivable from the line itself and is almost certainly correct
 *                  (e.g. an XPath on @role maps exactly onto getByRole).
 *   "judgement"  — the shape of the fix is known but the right target has to be chosen by a human
 *                  (e.g. what to wait for instead of a fixed sleep).
 *
 * Nothing here edits files. It produces the patch to review.
 */

const kebab = (s) =>
  String(s)
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-zA-Z0-9-]/g, "")
    .replace(/-+/g, "-")
    .toLowerCase()
    .replace(/^-|-$/g, "");

/** Pull the first quoted string out of a line (XPath and selectors live in those). */
function firstString(code) {
  const m = code.match(/(["'`])((?:\\.|(?!\1).)*)\1/);
  return m ? m[2] : null;
}

/** Map an XPath expression onto the Playwright locator that expresses the same intent. */
function xpathToLocator(xp) {
  if (!xp) return null;
  const expr = xp.replace(/^xpath=/, "");

  // A multi-step XPath targets a DESCENDANT of whatever the first predicate matches. Collapsing it
  // to the first node would silently point the test at the wrong element, so any rewrite derived
  // from it needs a human to pick the real target — it is never "mechanical".
  const steps = expr.replace(/\[[^\]]*\]/g, "").split("/").filter(Boolean).length;
  const multiStep = steps > 1;
  const temper = (r) =>
    r && multiStep
      ? {
          ...r,
          confidence: "judgement",
          note: [
            `This XPath walks ${steps} steps — the suggestion below only resolves the first one, so it targets the ancestor, not the element the test actually clicks. Pick the real target before applying it.`,
            r.note,
          ]
            .filter(Boolean)
            .join(" "),
        }
      : r;

  let m = expr.match(/@data-testid\s*=\s*["']([^"']+)["']/);
  if (m) return temper({ code: `page.getByTestId("${m[1]}")`, confidence: "mechanical" });

  m = expr.match(/@role\s*=\s*["']([^"']+)["']/);
  if (m) return temper({ code: `page.getByRole("${m[1]}")`, confidence: "mechanical" });

  m = expr.match(/@aria-label\s*=\s*["']([^"']+)["']/);
  if (m) return temper({ code: `page.getByLabel("${m[1]}")`, confidence: "mechanical" });

  m = expr.match(/@id\s*=\s*["']([^"']+)["']/);
  if (m) return temper({ code: `page.locator("#${m[1]}")`, confidence: "mechanical" });

  m = expr.match(/text\(\)\s*=\s*["']([^"']+)["']/);
  if (m) {
    return temper({
      code: `page.getByRole("<role>", { name: "${m[1]}" })`,
      confidence: "judgement",
      note: "Matching on visible text breaks in other locales — prefer a test id and keep the text as the assertion.",
    });
  }

  m = expr.match(/contains\(@class\s*,\s*["']([^"']+)["']\)/);
  if (m) {
    const id = kebab(m[1]);
    return temper({
      code: `page.getByTestId("${id}")`,
      confidence: "judgement",
      needsFe: `data-testid="${id}"`,
      note: `Derived from the class name "${m[1]}". A class is a styling hook, so this breaks on any CSS refactor.`,
    });
  }

  m = expr.match(/@class\s*=\s*["']([^"']+)["']/);
  if (m) {
    const first = m[1].split(/\s+/)[0];
    const id = kebab(first) || "target-element";
    return temper({
      code: `page.getByTestId("${id}")`,
      confidence: "judgement",
      needsFe: `data-testid="${id}"`,
      note: `The XPath pins the exact class list ("${m[1].slice(0, 60)}${m[1].length > 60 ? "…" : ""}"), so one utility-class change breaks it.`,
    });
  }

  return temper({
    code: `page.getByTestId("<stable-id>")`,
    confidence: "judgement",
    needsFe: "a data-testid on this element",
    note: "The XPath encodes DOM structure, so any restructure breaks it. Ask FE for a stable attribute.",
  });
}

/**
 * @param {object} hit  a hit from smells.scanFile
 * @returns {{before: string, after: string, confidence: string, note?: string, needsFe?: string}|null}
 */
export function proposeFix(hit) {
  const code = hit.code;

  switch (hit.id) {
    case "fixed-sleep": {
      const ms = code.match(/(\d{3,})/)?.[1];
      return {
        before: code,
        after: [
          `// wait for the state that sleep was standing in for, not for the clock:`,
          `await expect(<locator>).toBeVisible({ timeout: 15_000 });`,
          `// data-driven waits:`,
          `await page.waitForResponse((r) => r.url().includes("/<endpoint>") && r.ok());`,
        ].join("\n"),
        confidence: "judgement",
        note: `${ms ? `${ms}ms ` : ""}is a guess about how slow the environment is. Under load it is too short (flaky); when things are fast it is wasted run time.`,
      };
    }

    case "arbitrary-timeout":
      return {
        before: code,
        after: [
          `// remove the inline timeout and set the budget once:`,
          `// playwright.config.js →  expect: { timeout: 15_000 }`,
          code.replace(/,?\s*timeout:\s*\d+/, ""),
        ].join("\n"),
        confidence: "mechanical",
        note: "An inline timeout usually hides an unreliable wait. Fix the wait, and keep timeouts in one place.",
      };

    case "xpath-locator": {
      const xp = firstString(code);
      const loc = xpathToLocator(xp);
      if (!loc) return null;

      // Selector constants sit at module scope, where `page` does not exist yet. Keep the
      // constant a plain value and let the call site build the locator from it.
      const decl = code.match(/^(?:export\s+)?const\s+(\w+)\s*=/);
      if (decl) {
        const testId = loc.code.match(/getByTestId\(\s*["'`]([^"'`]+)["'`]/)?.[1];
        return {
          before: code,
          after: testId
            ? [`const ${decl[1]} = "${testId}";`, `// call site:  page.getByTestId(${decl[1]})`].join("\n")
            : [
                `// no plain-string form — build this where the page object uses it:`,
                `// ${loc.code}`,
              ].join("\n"),
          confidence: loc.confidence,
          note: loc.note,
          needsFe: loc.needsFe,
        };
      }

      // `.locator("<xpath>")` becomes a chained call, not a locator nested inside .locator().
      const chained = code.match(/\.locator\(\s*(["'`])/);
      if (chained) {
        const call = loc.code.replace(/^page\./, "");
        return {
          before: code,
          after: code.replace(/\.locator\(\s*(["'`])(?:\\.|(?!\1).)*\1\s*,?\s*\)?/, `.${call}`),
          confidence: loc.confidence,
          note: loc.note,
          needsFe: loc.needsFe,
        };
      }

      return {
        before: code,
        after: code.replace(/(["'`])(?:\\.|(?!\1).)*\1/, loc.code),
        confidence: loc.confidence,
        note: loc.note,
        needsFe: loc.needsFe,
      };
    }

    case "text-locator":
      return {
        before: code,
        after: [
          `// find by identity, assert on text:`,
          `const el = page.getByTestId("<stable-id>");`,
          `await expect(el).toHaveText(<expected>);`,
        ].join("\n"),
        confidence: "judgement",
        note: "A text locator fails on every copy change and in every locale except the one it was written for — which is exactly what the locale suites exercise.",
      };

    case "nth-index":
      return {
        before: code,
        after: [
          `// select by what makes the row the right row:`,
          `page.getByTestId("<row-id>").filter({ hasText: <identifying value> })`,
        ].join("\n"),
        confidence: "judgement",
        note: "Positional selection quietly targets a different element as soon as ordering or data changes — the test still passes, it just checks the wrong thing.",
      };

    case "conditional-assert":
      return {
        before: code,
        after: [
          `// assert the expected state instead of branching on it:`,
          `await expect(<locator>).toBeVisible();`,
          `// if both branches are genuinely valid, split this into two tests`,
        ].join("\n"),
        confidence: "judgement",
        note: "When the element is missing this branch is skipped and the test goes green while verifying nothing.",
      };

    case "empty-catch":
      return {
        before: code,
        after: [
          `} catch (error) {`,
          `  logger.error(\`<what was being attempted> failed: \${error.message}\`);`,
          `  throw error;   // or fail with a message that names the step`,
          `}`,
        ].join("\n"),
        confidence: "mechanical",
        note: "Swallowing the error moves the failure somewhere unrelated, so triage starts from the wrong place.",
      };

    case "shared-mutable-state": {
      const name = code.match(/^(?:let|var)\s+(\w+)/)?.[1] || "state";
      return {
        before: code,
        after: [
          `// move it into a fixture so every test starts from a known state:`,
          `export const test = base.extend({`,
          `  ${name}: async ({}, use) => { await use(<initial value>); },`,
          `});`,
        ].join("\n"),
        confidence: "judgement",
        note: `"${name}" persists across tests in this file, so results depend on execution order and on whether an earlier test failed.`,
      };
    }

    case "hardcoded-account":
      return {
        before: code,
        after: [
          `// take it from the environment and set up the state the test needs:`,
          `const account = ENV.<ACCOUNT_KEY>;`,
        ].join("\n"),
        confidence: "judgement",
        note: "The test depends on one specific account, so anything that changes its balance, positions or KYC state breaks it.",
      };

    default:
      return null;
  }
}

/**
 * Turn the diagnosed causes into an ordered plan: what to change, how big it is, and whether it
 * needs someone outside QA.
 */
export function fixPlan({ causes, near, related, priorFixes, shape, failVariants, passVariants }) {
  const steps = [];
  const worstRelated = related?.[0];

  const has = (id) =>
    (near || []).some((h) => h.id === id) || (related || []).some((r) => r.byId?.[id]);

  if (causes.includes("brittle-locator")) {
    const xpathCount =
      (near || []).filter((h) => h.id === "xpath-locator").length +
      (related || []).reduce((s, r) => s + (r.byId?.["xpath-locator"] || 0), 0);
    const heavy = worstRelated && (worstRelated.byId?.["xpath-locator"] || 0) >= 10;
    steps.push({
      what: heavy
        ? `Rewrite the locators in \`${worstRelated.file}\` (${worstRelated.byId["xpath-locator"]} XPath expressions)`
        : `Replace the ${xpathCount} XPath/text locator(s) on the failing path with test ids`,
      effort: heavy ? "large — a page-object rewrite, not a one-line fix" : "small",
      why: heavy
        ? "Patching one selector here buys a few days; the whole file breaks on the next DOM change."
        : "The selector no longer matches the DOM; the product itself may be fine.",
      needsOthers: "Any element without a stable attribute needs a data-testid from FE — raise that request today (QE-935 action 3).",
    });
  }

  if (causes.includes("fixed-sleep") || causes.includes("race-condition")) {
    steps.push({
      what: has("fixed-sleep")
        ? "Replace the fixed sleep with a wait on the state the test actually depends on"
        : "Find the unsynchronised step and wait on its completion signal (response, spinner gone, value settled)",
      effort: "small to medium",
      why: `The failure is ${shape}, which is the signature of a timing gap rather than a broken assertion.`,
    });
  }

  if (causes.includes("test-data")) {
    steps.push({
      what: "Make the test create or reset the data it needs instead of assuming account state",
      effort: "medium",
      why: "Shared accounts drift — balances, open positions and KYC state all change under the test.",
    });
  }

  if (causes.includes("shared-state")) {
    steps.push({
      what: "Move the module-level state into a fixture or beforeEach",
      effort: "small",
      why: "Right now the result depends on execution order and on whether an earlier test failed.",
    });
  }

  if (causes.includes("assertion-wrong")) {
    steps.push({
      what: "Make the assertion unconditional, or split the conditional branches into separate tests",
      effort: "small",
      why: "A skipped assertion reports green while verifying nothing — worse than a failure.",
    });
  }

  if (causes.includes("env-dependency")) {
    const only = failVariants?.length === 1 ? failVariants[0] : null;
    steps.push({
      what: only
        ? `Reproduce on \`${only}\` specifically and decide: engine-specific product bug, or a locator/wait that only that engine exposes`
        : "Reproduce on the failing variant before changing anything",
      effort: "investigation first",
      why: `It passes on ${(passVariants || []).join(", ") || "other variants"}, so the test logic is not wholesale wrong.`,
      needsOthers: "If the product genuinely behaves differently there, this is an APP-BUG, not a SCRIPT defect — re-classify it.",
    });
  }

  if (causes.includes("obsolete")) {
    steps.push({
      what: "Confirm the flow still exists in the product; if it does not, delete the test and say what replaces the coverage",
      effort: "small",
      why: "It has been red continuously with no recent code change, which usually means the product moved on.",
    });
  }

  if (causes.includes("missing-testid")) {
    steps.push({
      what: "Raise the data-testid request with FE/mobile and quarantine the test until the attribute lands",
      effort: "blocked on another team",
      why: "There is no stable way to target the element today, so any locator written now is the next flake.",
    });
  }

  if (priorFixes?.length) {
    steps.unshift({
      what: "Rewrite rather than patch",
      effort: "—",
      why: `This test was already "fixed" in ${priorFixes.map((c) => c.hash).join(", ")} and came back. The earlier root cause was not the real one.`,
    });
  }

  if (!steps.length) {
    steps.push({
      what: "No fix can be proposed from static signals alone — read the run log first",
      effort: "investigation",
      why: "Neither the spec nor its page objects show an anti-pattern on the failing path.",
    });
  }

  return steps;
}
