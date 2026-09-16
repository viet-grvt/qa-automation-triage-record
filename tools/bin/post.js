#!/usr/bin/env node
/**
 * post.js — send a message to Slack.
 *
 * The one thing the toolchain could not do: everything else writes markdown for a person to paste.
 * Points at the test channel by default; anything else needs --confirm.
 *
 *   node tools/bin/post.js --text "hello"
 *   node tools/bin/post.js --file reports/2026-09-16/posts/2.1-standup.md
 *   node tools/bin/post.js --file <f> --channel C07QWGUE2G6 --thread 1789461132.442869 --confirm
 *   node tools/bin/post.js --text "x" --dry        # show what would be sent, send nothing
 *
 * Needs SLACK_BOT_TOKEN (xoxb-…, scope chat:write, app invited to the channel).
 * A webhook cannot reply in a thread, so SLACK_WEBHOOK_URL is only a fallback for plain posts.
 *
 * The ts it prints is the evidence triage-log.js records:
 *   node tools/bin/triage-log.js --record --run <runId> --reply-ts <ts>
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");

const argv = process.argv.slice(2);
const has = (n) => argv.includes(`--${n}`);
const getArg = (n, d = null) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : d;
};

/** The config file has been spelled both ways in this repo; accept either. */
function loadConfig() {
  for (const p of [
    path.join(ROOT, "config", "channel.json"),
    path.join(ROOT, "config", "channels.json"),
  ]) {
    if (fs.existsSync(p)) {
      try {
        return JSON.parse(fs.readFileSync(p, "utf8"));
      } catch {
        return {};
      }
    }
  }
  return {};
}

const cfg = loadConfig();

// ---------------------------------------------------------------- message
let text = getArg("text");
const file = getArg("file");
/** report.js stamps each post file with where it goes; read it rather than retyping it. */
let header = { channelKey: null, threadTs: null };
if (file) {
  const abs = path.resolve(ROOT, file);
  if (!fs.existsSync(abs)) {
    console.error(`No such file: ${file}`);
    process.exit(2);
  }
  const raw = fs.readFileSync(abs, "utf8");
  // <!-- channel: web-staging · suite: smoke · thread_ts: 1789461132.442869 -->
  const m = raw.match(/<!--\s*channel:\s*([^\s·]+)[^>]*?(?:thread_ts:\s*([\d.]+))?\s*-->/);
  if (m) header = { channelKey: m[1], threadTs: m[2] || null };
  // Strip the header comments and the --- rule that separates them from the body.
  text = raw
    .replace(/^(?:<!--[\s\S]*?-->\s*)+/, "")
    .replace(/^\s*---\s*\n/, "")
    .trim();
}
if (!text) {
  console.error('Nothing to send. Pass --text "..." or --file <path>.');
  process.exit(2);
}

// ---------------------------------------------------------------- destination
const TEST_CHANNEL = "C0BJ6L6E44A"; // #qa-manual-automation — the agreed sandbox
/** A channel key from the file header resolves to its id through the config. */
function idForKey(key) {
  return (cfg.channels || []).find((c) => c.key === key)?.id || null;
}
const headerChannel = header.channelKey ? idForKey(header.channelKey) : null;
if (header.channelKey && !headerChannel) {
  console.error(`The file targets channel key "${header.channelKey}", which is not in the config.`);
  process.exit(2);
}
const channel = getArg("channel") || headerChannel || cfg.posting?.testChannel?.id || TEST_CHANNEL;
// A thread_ts only means anything in the channel it came from. Redirecting the message elsewhere
// (e.g. to the test channel) must drop it, or the reply is aimed at a thread that is not there.
const redirected = !!getArg("channel") && !!headerChannel && getArg("channel") !== headerChannel;
const threadTs = getArg("thread") || (redirected ? null : header.threadTs);
const isTest = channel === TEST_CHANNEL;
if (headerChannel && !getArg("channel")) {
  console.log(`  destination read from the file: ${header.channelKey}${header.threadTs ? ` · thread ${header.threadTs}` : " · no thread_ts in header"}`);
} else if (redirected) {
  console.log(`  redirected from ${header.channelKey} → ${channel}; the file's thread_ts was dropped (it belongs to the other channel)`);
}

const token = process.env.SLACK_BOT_TOKEN;
const webhook = process.env.SLACK_WEBHOOK_URL;

console.log(`→ ${channel}${threadTs ? ` · thread ${threadTs}` : ""}${isTest ? "  [test channel]" : ""}`);
console.log(`  ${text.split("\n").length} lines · ${text.length} chars`);
console.log(`  via ${token ? "chat.postMessage" : webhook ? "incoming webhook" : "NO CREDENTIAL"}`);

if (has("dry")) {
  console.log(`\n--- would send ---\n${text}\n--- end ---`);
  process.exit(0);
}

// A message in the wrong channel is harder to undo than a late one.
if (!isTest && !has("confirm")) {
  console.error(
    `\nRefusing to post outside the test channel without --confirm.` +
      `\n  destination: ${channel}` +
      `\n  re-run with --confirm once you have read the message.`,
  );
  process.exit(3);
}

// ---------------------------------------------------------------- send
async function viaToken() {
  const res = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      channel,
      text,
      ...(threadTs ? { thread_ts: threadTs } : {}),
      unfurl_links: false,
      unfurl_media: false,
    }),
  });
  const body = await res.json();
  // Slack does not fail when thread_ts names a message that is gone — it quietly posts the reply
  // at the top of the channel instead. Reporting that as a success is how a triage reply ends up
  // detached from the run it answers, so check what actually happened.
  if (body.ok && threadTs && body.message?.thread_ts !== threadTs) {
    console.warn(
      `  ⚠️ posted TOP-LEVEL, not in the thread — parent ${threadTs} is missing or deleted.`,
    );
  }
  if (!body.ok) {
    const hint =
      body.error === "not_in_channel"
        ? "  → the app is not in that channel. In Slack: /invite @<app name>"
        : body.error === "missing_scope"
          ? `  → the token lacks a scope${body.needed ? ` (needs ${body.needed})` : ""}. Add it, then Reinstall to Workspace.`
          : body.error === "invalid_auth" || body.error === "not_authed"
            ? "  → SLACK_BOT_TOKEN is wrong or revoked. Copy the Bot User OAuth Token again."
            : body.error === "channel_not_found"
              ? "  → wrong channel id, or the app cannot see that channel."
              : "";
    throw new Error(`Slack said: ${body.error}${hint ? `\n${hint}` : ""}`);
  }
  return body.ts;
}

async function viaWebhook() {
  if (threadTs) {
    console.warn("  ⚠️ a webhook cannot reply in a thread — this will post to the channel instead");
  }
  const res = await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  const body = await res.text();
  if (body.trim() !== "ok") throw new Error(`webhook returned: ${body.slice(0, 200)}`);
  return null; // webhooks return no ts, so the SLA evidence has to be read from Slack by hand
}

/** No credential: keep the exact payload so nothing is retyped, and say what is missing. */
function toOutbox() {
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: cfg.timezone || "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const dir = path.join(ROOT, "reports", date, "outbox");
  fs.mkdirSync(dir, { recursive: true });
  const out = path.join(dir, `${Date.now()}-${channel}${threadTs ? `-t${threadTs}` : ""}.json`);
  fs.writeFileSync(
    out,
    JSON.stringify({ channel, thread_ts: threadTs || null, text }, null, 2) + "\n",
  );
  console.log(`\nNothing sent — SLACK_BOT_TOKEN is not set.`);
  console.log(`Payload saved to ${path.relative(ROOT, out)}`);
  console.log(`\nTo enable posting:`);
  console.log(`  1. api.slack.com/apps → qa-ui-bot → OAuth & Permissions`);
  console.log(`  2. Bot Token Scopes → add chat:write → Reinstall to Workspace`);
  console.log(`  3. setx SLACK_BOT_TOKEN "xoxb-..."   (then restart the shell)`);
  console.log(`  4. In Slack: /invite @qa-ui-bot`);
}

try {
  if (token) {
    const ts = await viaToken();
    console.log(`\n✔ posted · ts ${ts}`);
    console.log(`  node tools/bin/triage-log.js --record --run <runId> --reply-ts ${ts}`);
  } else if (webhook) {
    await viaWebhook();
    console.log(`\n✔ posted via webhook (no ts returned — read it from Slack for the triage log)`);
  } else {
    toOutbox();
  }
} catch (e) {
  console.error(`\n✘ not sent: ${e.message}`);
  process.exit(1);
}
