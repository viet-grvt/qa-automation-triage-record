import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, "..", "..");

export const paths = {
  root: ROOT,
  config: path.join(ROOT, "config", "channels.json"),
  state: path.join(ROOT, "data", "state.json"),
  testIndex: path.join(ROOT, "data", "test-index.json"),
  raw: path.join(ROOT, "data", "raw"),
  reports: path.join(ROOT, "reports"),
};

export function loadConfig() {
  return JSON.parse(fs.readFileSync(paths.config, "utf8"));
}

/** Channels the tool currently operates on. `--channels a,b` overrides the `enabled` flag. */
export function activeChannels(cfg, override = null) {
  if (override) {
    const want = override.split(",").map((s) => s.trim()).filter(Boolean);
    const found = cfg.channels.filter((c) => want.includes(c.key));
    const missing = want.filter((k) => !found.some((c) => c.key === k));
    if (missing.length) {
      throw new Error(`Unknown channel key(s): ${missing.join(", ")}`);
    }
    return found;
  }
  return cfg.channels.filter((c) => c.enabled !== false);
}

// `messages` holds one entry per Slack post; `runs` holds the logical runs those posts merge into
// (a sharded regression run posts several messages under one workflow run id — see merge-runs.js).
// Everything downstream reads `runs`.
const EMPTY_STATE = { version: 1, updatedAt: null, messages: {}, runs: {}, tests: {}, daily: {} };

export function loadState() {
  if (!fs.existsSync(paths.state)) return structuredClone(EMPTY_STATE);
  try {
    const s = JSON.parse(fs.readFileSync(paths.state, "utf8"));
    return { ...structuredClone(EMPTY_STATE), ...s };
  } catch (e) {
    throw new Error(`state.json is corrupt (${e.message}). Fix it by hand or delete it to rebuild.`);
  }
}

export function saveState(state) {
  state.updatedAt = new Date().toISOString();
  fs.mkdirSync(path.dirname(paths.state), { recursive: true });
  fs.writeFileSync(paths.state, JSON.stringify(state, null, 2) + "\n");
}

export function loadTestIndex() {
  if (!fs.existsSync(paths.testIndex)) return { generatedAt: null, entries: [] };
  return JSON.parse(fs.readFileSync(paths.testIndex, "utf8"));
}

/** Normalise a test title so the same test matches across runs. */
export function normTitle(title) {
  return String(title)
    .toLowerCase()
    .replace(/["'`]/g, "")
    .replace(/\s+/g, " ")
    .replace(/[.…]+$/, "")
    .trim();
}

export function testKey(suiteKey, title) {
  return `${suiteKey}::${normTitle(title)}`;
}

export function todayInTz(tz) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function pct(num, den) {
  if (!den) return null;
  return Math.round((num / den) * 1000) / 10;
}
