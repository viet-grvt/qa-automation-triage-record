/**
 * Parser for the output of the Slack MCP `slack_read_channel` tool
 * (response_format: "detailed").
 *
 * The source format is produced by the custom actions in qa-automation:
 *   .github/actions/slack-reporter-frontend/slack_custom_formatter.sh
 *   .github/actions/slack-reporter-mobile/slack_custom_formatter.sh
 *
 * WEB:
 *   :x:WEB E2E Smoke Test [testnet · Chrome]
 *   :large_green_circle: *Passed:* 40
 *   :red_circle: *Failed:* 3
 *   <url|Actions Job>
 *   <url|Test Report>
 *   *FAILED (stable)*
 *   ✘ <failed test title>
 *
 * Two things about the web header changed on 2026-09-15 and both change the numbers:
 *
 *   1. The context suffix went from `[Chrome]` to `[<env> · <Browser>]`, and the test type can now
 *      carry a shard — `Regression (shard 1/2)` — or be the serial `Pre-shard` batch. One
 *      regression *workflow run* therefore posts several messages (pre-shard + one per shard) that
 *      share a single GitHub run id. They are parsed here as `parts` and stitched back into one
 *      logical run by merge-runs.js: each shard runs a different half of the suite, so treating
 *      them as separate runs makes every test in the other half look like it passed.
 *   2. Failures are grouped under a heading that carries the reporter's own verdict:
 *        *FAILED (stable)*         — failed on every retry, no @envDependent tag
 *        *FAILED (env-dependent)*  — the spec asserts on pre-existing account state
 *        *BLOCKED (preflight)*     — the account gate failed, the body never ran
 *      A blocked run proves nothing about the product and does not count toward the pass rate.
 *      Note that Playwright's `flaky` status (failed, passed on retry) is counted as *passed* by
 *      the reporter, so a title that reaches Slack at all has already failed every retry.
 *
 * MOBILE:
 *   :white_check_mark: [MOBILE-E2E] [SMOKE] [ANDROID] - OKX
 *   :large_green_circle: Passed: 23   :red_circle: Failed: 0 <url|Actions Job> <url|Test Report>
 *   *Env:* testnet | *Platform:* android | *Wallet:* OKX Wallet & Privy | *Result:* success
 *   *Version:* 3.3.0 (172) - 085329d1 | *Device:* Google Pixel 6 · Android 12.0
 *   ✘ <failed scenario name>
 */

const MSG_HEADER =
  /^=== Message from (.*?) \(([^)]+)\) at (\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} [+-]\d{2}) ===\s*$/;

function unescapeSlack(text) {
  return text
    .replace(/\\\//g, "/")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

/** "2026-08-18 12:51:52 +07" -> { iso, date, epoch }, preserving the displayed offset. */
function parseDisplayTime(stamp) {
  const m = stamp.match(
    /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2}) ([+-])(\d{2})$/,
  );
  if (!m) return null;
  const [, y, mo, d, h, mi, s, sign, off] = m;
  const iso = `${y}-${mo}-${d}T${h}:${mi}:${s}${sign}${off}:00`;
  return { iso, date: `${y}-${mo}-${d}`, epoch: Date.parse(iso) / 1000 };
}

function splitMessages(raw) {
  const lines = unescapeSlack(raw).split(/\r?\n/);
  const out = [];
  let cur = null;
  for (const line of lines) {
    const h = line.match(MSG_HEADER);
    if (h) {
      if (cur) out.push(cur);
      cur = { author: h[1].trim(), botId: h[2], stamp: h[3], body: [] };
      continue;
    }
    if (!cur) continue; // skip the leading "Channel: #... (CID)" line
    if (/^Message TS:\s*([\d.]+)/.test(line)) {
      cur.ts = line.match(/^Message TS:\s*([\d.]+)/)[1];
      continue;
    }
    if (/^Thread: \d+ replies/.test(line)) {
      cur.threadReplies = Number(line.match(/^Thread: (\d+)/)[1]);
      continue;
    }
    if (/^Reactions: /.test(line)) {
      cur.reactions = line.slice("Reactions: ".length).trim();
      continue;
    }
    cur.body.push(line);
  }
  if (cur) out.push(cur);
  return out;
}

function pickNumber(body, label) {
  const re = new RegExp(`${label}:\\**\\s*(\\d+)`, "i");
  for (const line of body) {
    const m = line.replace(/\*/g, "").match(re);
    if (m) return Number(m[1]);
  }
  return null;
}

function pickLink(body, label) {
  const re = new RegExp(`<([^|>]+)\\|${label}>`);
  for (const line of body) {
    const m = line.match(re);
    if (m) return m[1];
  }
  return null;
}

function pickField(body, label) {
  const re = new RegExp(`\\*${label}:\\*\\s*([^|]+)`);
  for (const line of body) {
    const m = line.match(re);
    if (m) return m[1].trim();
  }
  return null;
}

/** Failure group headings the frontend reporter emits, mapped to the short code stored per test. */
const GROUP_HEADINGS = [
  [/^FAILED \(stable\)$/i, "stable"],
  [/^FAILED \(env-dependent\)$/i, "env-dependent"],
  [/^BLOCKED \(preflight\)$/i, "blocked"],
  [/^FAILED$/i, "stable"], // pre-2026-09-15 messages had no heading at all
];

/**
 * Failure titles with the heading they appeared under. Titles before any heading (the old format,
 * and the mobile reporter, which does not group) are recorded as `unknown` rather than guessed at:
 * "stable" is a claim about retries, and inventing it would put a verdict in the tool's mouth.
 */
function pickFailures(body) {
  const out = [];
  let group = null;
  for (const raw of body) {
    const line = raw.trim();
    if (!line) continue;
    const heading = line.replace(/^\*|\*$/g, "").replace(/^_|_$/g, "").trim();
    const hit = GROUP_HEADINGS.find(([re]) => re.test(heading));
    if (hit) {
      group = hit[1];
      continue;
    }
    if (!line.startsWith("✘")) continue;
    const title = line.replace(/^✘\s*/, "").trim();
    if (title) out.push({ title, group: group || "unknown" });
  }
  return out;
}

/**
 * "WEB E2E Regression (shard 1/2) Test [testnet · Chrome]" ->
 *   { testType: "regression", part: "shard-1/2", shard: {index:1,total:2}, env, browser }
 *
 * `Pre-shard` is not a suite of its own: it is the serial batch of the same regression workflow,
 * posted separately because it runs before the shards fan out. Filing it as its own suite would
 * split one run's results across two suites and leave both looking like they half-ran.
 */
function parseWebHeader(headerLine) {
  const clean = headerLine.replace(/^:[a-z_0-9]+:/i, "").trim();
  const m = clean.match(/^WEB\s+E2E\s+(.+?)\s+Test\b(?:\s*\[([^\]]+)\])?(?:\s*[—-]\s*BLOCKED)?\s*$/i);
  const rawType = (m ? m[1] : "Smoke").trim();
  const ctx = m && m[2] ? m[2] : "";

  const sh = rawType.match(/\(shard\s+(\d+)\s*\/\s*(\d+)\)/i);
  const base = rawType.replace(/\(shard\s+\d+\s*\/\s*\d+\)/i, "").trim() || "Smoke";
  const isPreshard = /^pre-?shard$/i.test(base);

  const tokens = ctx.split(/\s*[·|]\s*/).map((t) => t.trim()).filter(Boolean);
  // Old format carried the browser alone; the new one prefixes the environment.
  const browser = tokens.length ? tokens[tokens.length - 1].toLowerCase() : null;
  const env = tokens.length > 1 ? tokens[0].toLowerCase() : null;

  return {
    testType: isPreshard ? "regression" : base.toLowerCase().replace(/\s+/g, "-"),
    part: sh ? `shard-${sh[1]}/${sh[2]}` : isPreshard ? "pre-shard" : null,
    shard: sh ? { index: Number(sh[1]), total: Number(sh[2]) } : null,
    env,
    browser,
  };
}

/** GitHub Actions run id, taken from the "Actions Job" link — used to fetch logs via gh. */
function runIdFromUrl(url) {
  const m = url && url.match(/\/actions\/runs\/(\d+)/);
  return m ? m[1] : null;
}

/**
 * @param {string} raw  The `messages` field returned by slack_read_channel
 * @param {object} channel  An entry from config/channels.json
 * @returns {{runs: object[], skipped: object[]}}
 */
export function parseChannel(raw, channel) {
  const runs = [];
  const skipped = [];

  for (const msg of splitMessages(raw)) {
    const body = msg.body;
    const headerLine = body.find((l) => l.trim().length > 0) || "";
    const time = parseDisplayTime(msg.stamp);
    if (!time) {
      skipped.push({ reason: "bad-timestamp", stamp: msg.stamp });
      continue;
    }

    const isWeb = /E2E .*Test/i.test(headerLine) && !/MOBILE-E2E/i.test(headerLine);
    const isMobile = /\[MOBILE-E2E\]/i.test(headerLine);
    if (!isWeb && !isMobile) {
      skipped.push({ reason: "not-a-run", ts: msg.ts, head: headerLine.slice(0, 80) });
      continue;
    }

    const passed = pickNumber(body, "Passed");
    const failed = pickNumber(body, "Failed");
    const failureDetail = pickFailures(body);
    const failures = failureDetail.map((f) => f.title);

    const jobUrl = pickLink(body, "Actions Job");
    const run = {
      channelKey: channel.key,
      channelName: channel.name,
      platform: channel.platform,
      env: channel.env,
      adhoc: !!channel.adhoc,
      ts: msg.ts,
      iso: time.iso,
      date: time.date,
      author: msg.author,
      headerLine: headerLine.trim(),
      ok: /white_check_mark/.test(headerLine),
      passed,
      failed,
      failures,
      failureDetail,
      truncatedFailureList: failed != null && failures.length > 0 && failed > failures.length,
      // The preflight account gate failed, so the suite body never ran. The reporter says outright
      // that these results do not count toward the pass rate — so they must not set a streak, and
      // they must never be read as "the product is broken".
      blocked:
        /BLOCKED \(preflight\)/i.test(body.join("\n")) ||
        /no_entry/.test(headerLine) ||
        /[—-]\s*BLOCKED\s*$/i.test(headerLine.trim()),
      jobUrl,
      runId: runIdFromUrl(jobUrl),
      reportUrl: pickLink(body, "Test Report"),
      threadReplies: msg.threadReplies || 0,
      reactions: msg.reactions || null,
      // Timed-out or unfinished run — never used to infer that a test passed.
      partial: /TIMED OUT|did not finish/i.test(body.join("\n")),
    };

    if (isWeb) {
      run.suite = "web";
      const h = parseWebHeader(headerLine);
      run.testType = h.testType;
      run.part = h.part;
      run.shard = h.shard;
      run.browser = h.browser;
      run.variant = run.browser;
      // The header now names the environment it ran against. Trust it over the channel default —
      // a channel is a place messages land, not a guarantee of which env produced them.
      if (h.env) run.env = h.env;
    } else {
      run.suite = "mobile";
      const tags = [...headerLine.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1]);
      run.testType = (tags[1] || "E2E").toLowerCase().replace(/\s+/g, "-");
      run.mobilePlatform = (tags[2] || "").toLowerCase() || null;
      const w = headerLine.match(/-\s*([A-Za-z]+)\s*$/);
      run.wallet = w ? w[1] : null;
      run.env = pickField(body, "Env") || channel.env;
      run.mobilePlatform =
        (pickField(body, "Platform") || run.mobilePlatform || "").toLowerCase() || null;
      run.result = pickField(body, "Result");
      run.appVersion = pickField(body, "Version");
      run.device = pickField(body, "Device");
      run.variant = [run.mobilePlatform, run.wallet].filter(Boolean).join("/") || null;
    }

    // Suite key: streaks are only ever compared within the same test suite.
    run.suiteKey = `${channel.key}::${run.suite}:${run.testType}`;
    run.green = run.ok && !run.blocked && (failed === 0 || failed == null) && (passed || 0) > 0;
    // Zero passes usually means infrastructure, not a test defect. A blocked run is the same in
    // effect — nothing ran — so it is excluded from pass inference by the same flag.
    run.infra = (passed || 0) === 0 || run.blocked;

    runs.push(run);
  }

  runs.sort((a, b) => Number(a.ts || 0) - Number(b.ts || 0));
  return { runs, skipped };
}

export const _internal = {
  splitMessages,
  parseDisplayTime,
  unescapeSlack,
  runIdFromUrl,
  parseWebHeader,
  pickFailures,
};
