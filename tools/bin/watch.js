#!/usr/bin/env node
/**
 * watch.js — find red CI runs in a Slack channel that have not been answered, and answer them.
 *
 * This is the auto-detect half. The bot is not summoned by the CI message (that would need the
 * reporter to @-mention it and a server listening for the event); it reads the channel on a
 * schedule instead, which needs no change to qa-automation and no hosting.
 *
 *   node tools/bin/watch.js                          # what would be answered, nothing sent
 *   node tools/bin/watch.js --post                   # answer them, in each run's own thread
 *   node tools/bin/watch.js --channel manual-automation --limit 50
 *   node tools/bin/watch.js --since 1789495375.000000
 *
 * A run counts as ANSWERED when this bot already has a reply in its thread. That check is made
 * against Slack itself rather than local state, so a reply posted by hand also counts and the
 * bot never doubles up on a thread a person already handled.
 *
 * Needs SLACK_BOT_TOKEN with:
 *   channels:history   read the channel
 *   chat:write         post the reply
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");

const argv = process.argv.slice(2);
const has = (n) => argv.includes(`--${n}`);
const getArg = (n, d = null) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : d;
};

function loadConfig() {
  for (const p of [
    path.join(ROOT, "config", "channel.json"),
    path.join(ROOT, "config", "channels.json"),
  ]) {
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, "utf8"));
  }
  throw new Error("No config/channel.json found.");
}

const cfg = loadConfig();
const token = process.env.SLACK_BOT_TOKEN;
if (!token) {
  console.error("SLACK_BOT_TOKEN is not set. It needs channels:history and chat:write.");
  process.exit(2);
}

async function slack(method, params = {}, post = false) {
  const url = `https://slack.com/api/${method}`;
  const res = post
    ? await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify(params),
      })
    : await fetch(`${url}?${new URLSearchParams(params)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
  const body = await res.json();
  if (!body.ok) {
    throw new Error(`${method}: ${body.error}${body.needed ? ` (needs ${body.needed})` : ""}`);
  }
  return body;
}

// ---------------------------------------------------------------- which channels to watch
const wantKeys = (getArg("channel") || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const watched = wantKeys.length
  ? cfg.channels.filter((c) => wantKeys.includes(c.key))
  : cfg.channels.filter((c) => c.enabled !== false);
if (!watched.length) {
  console.error(`No channels selected. Keys: ${cfg.channels.map((c) => c.key).join(", ")}`);
  process.exit(2);
}

const limit = Number(getArg("limit", "30"));

/** Epoch seconds at 00:00 today in the configured timezone. */
function startOfTodayTs() {
  const d = new Date();
  const local = new Intl.DateTimeFormat("en-CA", {
    timeZone: cfg.timezone || "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const p = Object.fromEntries(local.map((x) => [x.type, x.value]));
  const secsIntoDay = Number(p.hour) * 3600 + Number(p.minute) * 60 + Number(p.second);
  return String(Math.floor(d.getTime() / 1000) - secsIntoDay);
}

/** Epoch seconds at 00:00 on a YYYY-MM-DD, in the configured timezone. */
function startOfDateTs(date) {
  const noonUtc = Date.parse(`${date}T12:00:00Z`);
  if (Number.isNaN(noonUtc)) {
    console.error(`--from expects YYYY-MM-DD, got "${date}".`);
    process.exit(2);
  }
  const hour = Number(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: cfg.timezone || "Asia/Ho_Chi_Minh",
      hour: "2-digit",
      hour12: false,
    }).format(new Date(noonUtc)),
  );
  // How far local noon sits from UTC noon is the zone's offset for that date.
  return String(Math.floor(noonUtc / 1000) - 12 * 3600 - (hour - 12) * 3600);
}

// Answering a three-week backlog on the first run would bury the channel. Default to today only;
// --from <date> starts from a given day, --since takes a raw ts, --all turns the window off.
const fromDate = getArg("from");
const since = has("all")
  ? null
  : getArg("since") || (fromDate ? startOfDateTs(fromDate) : startOfTodayTs());
if (fromDate) console.log(`Window: from ${fromDate} (${since})`);

/** Red if the reporter marked it failed. Both formats put the state in the first line. */
function isRed(text = "") {
  const head = text.split("\n")[0] || "";
  if (/:white_check_mark:/.test(head)) return false;
  if (/:x:/.test(head)) return true;
  // Fall back to the counts when the header emoji is missing.
  const m = text.replace(/\*/g, "").match(/Failed:\s*(\d+)/i);
  return m ? Number(m[1]) > 0 : false;
}

/**
 * Slack's `text` is a flattened fallback for block messages: the mobile reporter's whole body
 * arrives as one line, which makes the parser read the entire message as the header. Rebuild the
 * real line structure from the blocks, and keep `text` only when there are none.
 */
function bodyOf(m) {
  if (!m.blocks?.length) return String(m.text || "");
  const lines = [];
  for (const b of m.blocks) {
    if (b.type === "header" && b.text?.text) lines.push(b.text.text);
    else if (b.type === "section" && b.text?.text) lines.push(b.text.text);
    else if (b.type === "context") {
      for (const el of b.elements || []) if (el.text) lines.push(el.text);
    } else if (b.type === "rich_text") {
      for (const el of b.elements || []) {
        for (const sub of el.elements || []) if (sub.text) lines.push(sub.text);
      }
    }
  }
  const out = lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return out || String(m.text || "");
}

/** A run message is one this tool understands — web or mobile, with a run behind it. */
function isRun(text = "") {
  const head = text.split("\n")[0] || "";
  return /E2E .*Test/i.test(head) || /\[MOBILE-E2E\]/i.test(head);
}

const runIdOf = (text = "") => (text.match(/\/actions\/runs\/(\d+)/) || [])[1] || null;

/**
 * The mobile reporter sends its body as Slack blocks, so the `text` fallback arrives as one long
 * line. Cut the title at the first count marker rather than at a newline, or it swallows the
 * whole message.
 */
const titleOf = (text = "") => {
  const first = (text.split("\n")[0] || "")
    .replace(/^:[a-z_]+:\s*/, "")
    .split(/:large_green_circle:|:alarm_clock:|:white_circle:/)[0]
    .trim();
  return first.length > 72 ? `${first.slice(0, 69)}…` : first;
};

/** Count failing tests without anchoring to line starts, for the same reason. */
const failureCount = (text = "") => (text.match(/✘/g) || []).length;

const TZ = cfg.timezone || "Asia/Ho_Chi_Minh";

const todayLocal = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

/** "2026-09-16 01:02:55 +07" — the stamp format tools/lib/parse-slack.js expects. */
function stamp(ts) {
  const d = new Date(Number(ts) * 1000);
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZoneName: "longOffset",
  });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  // longOffset gives "GMT+07:00"; parse-slack wants "+07".
  const off = (p.timeZoneName || "GMT+07:00").replace("GMT", "").slice(0, 3) || "+07";
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second} ${off}`;
}

// ---------------------------------------------------------------- scan
const me = (await slack("auth.test", {}, true)).user_id;
const found = [];
const greenRuns = [];

for (const ch of watched) {
  let history;
  try {
    history = await slack("conversations.history", {
      channel: ch.id,
      limit,
      ...(since ? { oldest: since } : {}),
    });
  } catch (e) {
    console.error(`  ${ch.name}: ${e.message}`);
    continue;
  }

    // The ingest reads text dumps, not the API. Writing one here removes the manual Slack pull:
  // watch → dump → ingest → report → post becomes a single chain.
  if (has("dump")) {
    const runs = history.messages.filter((m) => isRun(bodyOf(m)));
    const dump =
      `Channel: #${ch.name} (${ch.id})\n\n` +
      runs
        .map((m) => {
          const author = m.bot_profile?.name || m.username || "";
          const id = m.bot_id || m.user || "";
          const body = bodyOf(m).replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
          return `=== Message from ${author} (${id}) at ${stamp(m.ts)} ===\nMessage TS: ${m.ts}\n${body}`;
        })
        .join("\n\n");
    const dir = path.join(ROOT, "data", "raw", todayLocal());
    fs.mkdirSync(dir, { recursive: true });
    const out = path.join(dir, `${ch.key}.txt`);
    fs.writeFileSync(out, `${dump}\n`);
    console.log(`  wrote ${runs.length} run message(s) → ${path.relative(ROOT, out)}`);
  }

  // Every GREEN run gets its own note, in its own thread. The alternative - one note a day, edited
  // as runs land - produces a message stamped 02:00, sitting under the 00:21 run, whose text reads
  // "Latest: 07:52": three different runs referenced by one message, and a timestamp claiming the
  // check happened hours before the run it describes.
  const greens = history.messages
    .map((m) => ({ m, body: bodyOf(m) }))
    .filter(({ body }) => isRun(body) && !isRed(body));
  for (const { m, body } of greens) {
    let answered = false;
    if (m.reply_count > 0) {
      const thread = await slack("conversations.replies", { channel: ch.id, ts: m.ts, limit: 50 });
      answered = thread.messages.some((r) => r.ts !== m.ts && r.user === me);
    }
    greenRuns.push({
      channel: ch,
      ts: m.ts,
      runId: runIdOf(body),
      title: titleOf(body),
      passed: Number((body.replace(/\*/g, "").match(/Passed:\s*(\d+)/i) || [])[1] || 0),
      reportUrl: (body.match(/<([^|>]+)\|Test Report>/i) || [])[1] || null,
      answered,
    });
  }

  const reds = history.messages
    .map((m) => ({ m, body: bodyOf(m) }))
    .filter(({ body }) => isRun(body) && isRed(body));
  for (const { m, body } of reds) {
    // Already answered? Ask Slack, not our own state — a human reply counts too.
    let answered = false;
    let answeredBy = null;
    if (m.reply_count > 0) {
      const thread = await slack("conversations.replies", { channel: ch.id, ts: m.ts, limit: 50 });
      const replies = thread.messages.filter((r) => r.ts !== m.ts);
      const mine = replies.find((r) => r.user === me);
      if (mine) {
        answered = true;
        answeredBy = "this bot";
      } else if (replies.length) {
        answered = true;
        answeredBy = "someone else";
      }
    }
    found.push({
      channel: ch,
      ts: m.ts,
      runId: runIdOf(body),
      title: titleOf(body),
      failures: failureCount(body),
      answered,
      answeredBy,
    });
  }
}

// An all-green day is not "nothing to do" — that is exactly when the daily note is owed, so this
// reports and carries on rather than exiting.
if (!found.length) console.log("No red runs in the window.");

/**
 * Slack does not say whether a run was cron'd or dispatched by hand, but GitHub does. The token
 * comes from Git Credential Manager, the same place git gets it, so nothing has to be configured.
 */
function ghToken() {
  try {
    const out = execFileSync("git", ["credential", "fill"], {
      input: "protocol=https\nhost=github.com\n\n",
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
    });
    return (out.match(/^password=(.*)$/m) || [])[1] || null;
  } catch {
    return null;
  }
}

function runEvent(runId, token) {
  if (!runId || !token) return null;
  try {
    return execFileSync(
      "gh",
      ["run", "view", runId, "-R", cfg.repoSlug || "gravity-technologies/qa-automation", "--json", "event", "--jq", ".event"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], env: { ...process.env, GH_TOKEN: token } },
    ).trim();
  } catch {
    return null;
  }
}

if (has("scheduled-only")) {
  const token = ghToken();
  if (!token) {
    console.error("--scheduled-only needs a GitHub credential; none found in Git Credential Manager.");
    process.exit(2);
  }
  for (const f of found) {
    f.event = runEvent(f.runId, token);
    // Unknown beats wrong: a run whose trigger cannot be read is skipped, not assumed scheduled.
    f.skipped = f.event !== "schedule";
  }
  const dropped = found.filter((f) => f.skipped && !f.answered);
  if (dropped.length) {
    console.log(`\nSkipping ${dropped.length} run(s) — not scheduled:`);
    for (const f of dropped) console.log(`  · ${f.title} (${f.event || "trigger unknown"})`);
  }
}

// greenNotesOnly: this channel gets the "checked, all green" note but no per-run reply. Useful
// while the red replies are still being trialled — they are the loud ones, and they assert a
// streak, a leaning and a root cause that the green note never claims.
const greenOnlyKeys = new Set(
  (cfg.channels || []).filter((c) => c.greenNotesOnly).map((c) => c.key),
);
const held = found.filter((f) => !f.answered && !f.skipped && greenOnlyKeys.has(f.channel.key));
if (held.length) {
  console.log(`\nHolding ${held.length} red-run repl(ies) — these channels are greenNotesOnly:`);
  for (const f of held) console.log(`  · ${f.channel.name}  ${f.title}`);
}

const open = found.filter(
  (f) => !f.answered && !f.skipped && !greenOnlyKeys.has(f.channel.key),
);
console.log(`${found.length} red run(s) seen · ${open.length} unanswered\n`);
for (const f of found) {
  const mark = f.answered ? `✔ answered by ${f.answeredBy}` : "→ needs a reply";
  console.log(`  ${mark}`);
  console.log(`     ${f.channel.name} · ${f.title}`);
  console.log(`     ${f.failures} failing test(s) · run ${f.runId || "?"} · ts ${f.ts}`);
}

if (found.length && !open.length) console.log("\nEvery red run already has a reply.");

// ---------------------------------------------------------------- answer
// The reply text is whatever report.js generated for that run. Matching on thread_ts is exact:
// the header report.js writes carries the ts of the message the reply belongs under.
function replyFileFor(ts) {
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: cfg.timezone || "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const dir = path.join(ROOT, "reports", date, "posts");
  if (!fs.existsSync(dir)) return null;
  for (const name of fs.readdirSync(dir)) {
    if (!name.startsWith("thread-")) continue;
    const p = path.join(dir, name);
    if (fs.readFileSync(p, "utf8").includes(`thread_ts: ${ts}`)) return path.relative(ROOT, p);
  }
  return null;
}

// The reply files are produced by report.js, which reads state, which is fed by ingest.js. Run the
// chain here so one scheduled command covers the whole loop; --no-refresh skips it when the caller
// has already done it by hand.
// Refresh for every watched channel, not just the ones with open red runs: on an all-green day
// there are no open runs, and the daily note still has to be generated.
if (has("post") && !has("no-refresh")) {
  const keys = watched.map((c) => c.key).join(",");
  for (const [label, script] of [
    ["ingest", "ingest.js"],
    ["report", "report.js"],
  ]) {
    try {
      execFileSync(process.execPath, [path.join(ROOT, "tools", "bin", script), "--channels", keys], {
        cwd: ROOT,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
      console.log(`  ${label}: ok (${keys})`);
    } catch (e) {
      console.error(`  ${label} failed — not posting, because the replies would be stale.`);
      console.error(String(e.stderr || e.stdout || e.message).trim().split("\n").slice(-3).join("\n"));
      process.exit(1);
    }
  }
}

// ---------------------------------------------------------------- green runs
// Every green run is answered in its own thread, once. The alternative — a single note per suite
// per day, edited as more runs land — produced a message stamped 02:00, sitting under the 00:21
// run, whose text read "Latest: 07:52": three different runs referenced by one message, and a
// timestamp claiming the check happened hours before the run it describes.
//
// Whether a run has been answered is read from its thread on Slack, so there is no local record to
// lose and a note written by hand counts too.
// Answering literally every green run follows the CI, not the check interval, and on a channel
// like web-prod the CI is faster: gaps of 37, 40, 47 minutes are normal, so a 2-hourly bot still
// emits ~20 notes a day, several under an hour apart. Hold a minimum gap between ANSWERED runs
// instead — one attestation per --min-gap per suite. The runs in between are covered by the note
// either side of them; a gap larger than the check interval is what stops a note ever being late.
const minGapMin = Number(getArg("min-gap", "120"));
const suiteOf = (g) => `${g.channel.key}::${g.title.replace(/\s*\[[^\]]*\]\s*$/, "").trim()}`;

const openGreens = [];
{
  // Newest first within each suite. Walking oldest-first answered the EARLIEST eligible run and
  // then restarted the clock from it, which is backwards: at the 08:00 pass both 07:09 and 07:48
  // were waiting, 07:09 won, and the note went out already 51 minutes behind the real state.
  // Taking the newest means the note describes the suite as it actually is, and the older runs in
  // the same window are the ones held.
  const bySuite = new Map();
  for (const g of greenRuns) {
    const k = suiteOf(g);
    if (!bySuite.has(k)) bySuite.set(k, []);
    bySuite.get(k).push(g);
  }

  for (const runs of bySuite.values()) {
    // Already-answered runs anchor the clock, so a restart cannot reopen a gap already closed.
    const anchors = runs.filter((r) => r.answered).map((r) => Number(r.ts));
    const newestFirst = runs.filter((r) => !r.answered).sort((a, b) => Number(b.ts) - Number(a.ts));

    for (const g of newestFirst) {
      const ts = Number(g.ts);
      // Distance to the nearest answered run either side: a run too close to one already answered
      // is held whichever direction it sits in.
      const nearest = anchors.reduce(
        (best, a) => Math.min(best, Math.abs(ts - a) / 60),
        Infinity,
      );
      if (nearest < minGapMin) {
        g.heldFor = Math.round(nearest);
        continue;
      }
      openGreens.push(g);
      anchors.push(ts);
    }
  }

  openGreens.sort((a, b) => Number(b.ts) - Number(a.ts));
}

const heldGreens = greenRuns.filter((g) => g.heldFor != null);
if (greenRuns.length) {
  console.log(`\n${greenRuns.length} green run(s) · ${openGreens.length} to answer · ${heldGreens.length} within ${minGapMin} min of one already answered`);
  for (const g of heldGreens.slice(0, 6)) {
    console.log(`  · skipping ${g.title} — ${g.heldFor} min after the last answered run`);
  }
  if (heldGreens.length > 6) console.log(`  · …and ${heldGreens.length - 6} more`);
}

/**
 * How many green runs this suite has had today, counting up to and including this one, and how
 * many tests they passed between them.
 *
 * Phrased "so far" on purpose. The old daily note said "4 run(s) today" and had to be edited every
 * time another landed — which is what put a message stamped 02:00 under the 00:21 run reading
 * "Latest: 07:52". A total that is true AS AT THIS RUN stays true for ever.
 */
function tallyAt(g) {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const dayOf = (ts) => day.format(new Date(Number(ts) * 1000));
  const today = dayOf(g.ts);
  const sameDaySuite = (x) =>
    x.channel.key === g.channel.key &&
    suiteOf(x) === suiteOf(g) &&
    dayOf(x.ts) === today &&
    Number(x.ts) <= Number(g.ts);

  const green = greenRuns.filter(sameDaySuite);
  // Red runs are counted too. A note that only ever mentions the green ones reads as though the
  // day had no failures — prod ran red at 14:11 today and every green note above it said nothing.
  const red = found.filter(sameDaySuite);
  return {
    green: green.length,
    red: red.length,
    total: green.length + red.length,
    passed: green.reduce((s, x) => s + (x.passed || 0), 0),
    failed: red.reduce((s, x) => s + (x.failures || 0), 0),
  };
}

/** One run, one note. Every figure in it comes from that run and stays true. */
function greenNote(g) {
  // Date only. The time belongs to the "Latest:" line; carrying it here as well prints the same
  // clock time twice in a three-line message.
  const when = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    day: "numeric",
    month: "short",
  }).format(new Date(Number(g.ts) * 1000));
  const t = tallyAt(g);
  const hhmm = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(Number(g.ts) * 1000));
  const out = [
    `:white_check_mark: *Triage — ${g.title}* · ${when}`,
    // Both halves of the day, so a failure is never invisible behind a green note.
    t.red > 0
      ? `${t.total} run(s) today — ${t.green} green, ${t.red} red (${t.failed} test(s) failed) · ${t.passed} test(s) passed.`
      : `${t.green} run(s) today, all green — ${t.passed} test(s) passed, nothing to classify.`,
  ];
  // The run id is already in the link's URL and in the run message above; printing it adds a long
  // number to every note and tells the reader nothing they cannot click through to.
  if (g.reportUrl) out.push(`Latest: ${hhmm} · <${g.reportUrl}|Test report>`);
  return out.join("\n");
}

if (openGreens.length) {
  console.log(`\n--- ${has("post") ? "answering green runs" : "dry run — pass --post to send"} ---`);
  for (const g of openGreens) {
    const text = greenNote(g);
    if (!has("post")) {
      console.log(`  · would post to ${g.channel.name} thread ${g.ts}`);
      for (const line of text.split("\n")) console.log(`      ${line}`);
      continue;
    }
    try {
      const out = execFileSync(
        process.execPath,
        [
          path.join(ROOT, "tools", "bin", "post.js"),
          "--text", text,
          "--channel", g.channel.id,
          "--thread", g.ts,
          "--confirm",
        ],
        { cwd: ROOT, encoding: "utf8", env: process.env },
      );
      const ts = (out.match(/posted · ts ([\d.]+)/) || [])[1];
      console.log(`  ✔ ${g.channel.name} · ${g.title} → ts ${ts || "?"}`);
    } catch (e) {
      console.log(`  ✘ ${g.channel.name} · ${g.title} — ${String(e.stdout || e.message).trim().split("\n").pop()}`);
    }
  }
}

console.log(`\n--- ${has("post") ? "answering" : "dry run — pass --post to send"} ---`);
for (const f of open) {
  const file = replyFileFor(f.ts);
  if (!file) {
    console.log(`  ✘ ${f.title} — no reply generated for ts ${f.ts}`);
    console.log(`     run ingest + report for this channel first:`);
    console.log(`       node tools/bin/ingest.js --channels ${f.channel.key}`);
    console.log(`       node tools/bin/report.js --channels ${f.channel.key}`);
    continue;
  }
  if (!has("post")) {
    console.log(`  · would post ${file}`);
    console.log(`       → ${f.channel.name} thread ${f.ts}`);
    continue;
  }
  try {
    const out = execFileSync(
      process.execPath,
      [path.join(ROOT, "tools", "bin", "post.js"), "--file", file, "--confirm"],
      { cwd: ROOT, encoding: "utf8", env: process.env },
    );
    const ts = (out.match(/posted · ts ([\d.]+)/) || [])[1];
    console.log(`  ✔ ${f.title} → ts ${ts || "?"}`);
    if (f.runId && ts) {
      console.log(`       node tools/bin/triage-log.js --record --run ${f.runId} --reply-ts ${ts}`);
    }
  } catch (e) {
    console.log(`  ✘ ${f.title} — ${String(e.stdout || e.message).trim().split("\n").pop()}`);
  }
}
