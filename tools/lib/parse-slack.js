/**
 * Parser for the output of the Slack MCP `slack_read_channel` tool
 * (response_format: "detailed").
 *
 * The source format is produced by the custom actions in qa-automation:
 *   .github/actions/slack-reporter-frontend/slack_custom_formatter.sh
 *   .github/actions/slack-reporter-mobile/slack_custom_formatter.sh
 *
 * WEB:
 *   :x:WEB E2E Smoke Test [Chrome]
 *   :large_green_circle: *Passed:* 40
 *   :red_circle: *Failed:* 3
 *   <url|Actions Job>
 *   <url|Test Report>
 *   ✘ <failed test title>
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
    const failures = body
      .filter((l) => l.trimStart().startsWith("✘"))
      .map((l) => l.replace(/^\s*✘\s*/, "").trim())
      .filter(Boolean);

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
      truncatedFailureList: failed != null && failures.length > 0 && failed > failures.length,
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
      const t = headerLine.match(/E2E\s+(\w+)\s+Test/i);
      run.testType = (t ? t[1] : "Smoke").toLowerCase();
      const b = headerLine.match(/\[([A-Za-z]+)\]\s*$/);
      run.browser = b ? b[1].toLowerCase() : null;
      run.variant = run.browser;
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
    run.green = run.ok && (failed === 0 || failed == null) && (passed || 0) > 0;
    run.infra = (passed || 0) === 0; // zero passes usually means infrastructure, not a test defect

    runs.push(run);
  }

  runs.sort((a, b) => Number(a.ts || 0) - Number(b.ts || 0));
  return { runs, skipped };
}

export const _internal = { splitMessages, parseDisplayTime, unescapeSlack, runIdFromUrl };
