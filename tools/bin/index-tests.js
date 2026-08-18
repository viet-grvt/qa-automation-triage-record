#!/usr/bin/env node
/**
 * index-tests.js — build a lookup table from "test title as shown in Slack" to "file:line".
 *
 *   node tools/bin/index-tests.js
 *   node tools/bin/index-tests.js --repo c:/Gravity/qa-automation
 *
 * WEB (Playwright, ui_tests/tests/**\/*.spec.ts): every sufficiently long string literal is
 * indexed — the repo declares test names both inside test("...") and in constants/arrays, so
 * scanning literals matches far more titles than only catching test(...) calls.
 * MOBILE (Cucumber, mobile_tests/features/**\/*.feature): Scenario / Scenario Outline names.
 */
import fs from "node:fs";
import path from "node:path";
import { loadConfig, paths, normTitle } from "../lib/state.js";

const argv = process.argv.slice(2);
const getArg = (n, d = null) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 ? argv[i + 1] : d;
};

const cfg = loadConfig();
const repo = path.resolve(getArg("repo", cfg.repoPath));
if (!fs.existsSync(repo)) {
  console.error(`Repo not found: ${repo}`);
  process.exit(2);
}

function walk(dir, filter, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name.startsWith(".")) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, filter, out);
    else if (filter(e.name)) out.push(p);
  }
  return out;
}

const entries = [];
const seen = new Set();
const add = (title, file, line, suite, kind) => {
  const n = normTitle(title);
  if (n.length < 12) return;
  const id = `${suite}|${n}|${file}:${line}`;
  if (seen.has(id)) return;
  seen.add(id);
  entries.push({
    title: title.trim(),
    norm: n,
    file: path.relative(repo, file).replace(/\\/g, "/"),
    line,
    suite,
    kind,
  });
};

// ---- WEB ----
const LITERAL = /(["'`])((?:\\.|(?!\1)[^\\\r\n]){16,200})\1/g;
for (const file of walk(path.join(repo, "ui_tests", "tests"), (n) => n.endsWith(".spec.ts"))) {
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((text, i) => {
    if (/^\s*(\/\/|\*)/.test(text)) return;
    const declared = text.match(
      /\b(test|it|describe)(?:\.\w+)*\s*\(\s*(["'`])((?:\\.|(?!\2)[^\\])+)\2/,
    );
    if (declared) add(declared[3], file, i + 1, "web", "test");
    for (const m of text.matchAll(LITERAL)) {
      const v = m[2];
      if (/^[\w./-]+$/.test(v)) continue; // paths, selectors, ids
      if (/^https?:/.test(v)) continue;
      if (/[<>{}$]/.test(v)) continue;
      if (!/\s/.test(v)) continue;
      add(v, file, i + 1, "web", "literal");
    }
  });
}

// ---- MOBILE ----
for (const file of walk(path.join(repo, "mobile_tests", "features"), (n) => n.endsWith(".feature"))) {
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((text, i) => {
    const m = text.match(/^\s*Scenario(?: Outline)?:\s*(.+?)\s*$/);
    if (m) add(m[1], file, i + 1, "mobile", "scenario");
  });
}

const index = {
  generatedAt: new Date().toISOString(),
  repo: repo.replace(/\\/g, "/"),
  counts: {
    web: entries.filter((e) => e.suite === "web").length,
    mobile: entries.filter((e) => e.suite === "mobile").length,
  },
  entries,
};

fs.mkdirSync(path.dirname(paths.testIndex), { recursive: true });
fs.writeFileSync(paths.testIndex, JSON.stringify(index, null, 2) + "\n");
console.log(
  `Indexed ${entries.length} titles (web ${index.counts.web}, mobile ${index.counts.mobile}) → ${path.relative(paths.root, paths.testIndex)}`,
);
