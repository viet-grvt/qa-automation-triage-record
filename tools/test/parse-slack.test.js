/**
 * Tests for the Slack reporter format — run with `node --test tools/test/`.
 *
 * The web reporter's header changed on 2026-09-15 and the old parser failed silently on it: a
 * sharded regression message fell through to the default "Smoke" test type, so regression results
 * were filed into the smoke suite and the QE-935 smoke-accuracy number was measured on them. That
 * is the failure mode worth a test — nothing threw, the report just quietly described a different
 * suite than the one that ran.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { parseChannel } from "../lib/parse-slack.js";
import { mergeParts } from "../lib/merge-runs.js";

const CH = { key: "web-testnet", name: "qa-web-automation-testnet", platform: "web", env: "testnet" };
const MOB = { key: "mobile-testnet", name: "qa-mobile-automation-testnet", platform: "mobile", env: "testnet" };

const msg = (ts, stamp, body) =>
  `=== Message from qa-ui-bot-testnet (B07KPMJPNNL) at ${stamp} ===\nMessage TS: ${ts}\n${body}\n`;

const job = (runId, jobId) =>
  `<https://github.com/gravity-technologies/qa-automation/actions/runs/${runId}/job/${jobId}|Actions Job>`;

test("the new header yields the real test type, shard, env and browser", () => {
  const raw = msg(
    "1789507601.498809",
    "2026-09-16 04:26:41 +07",
    [
      ":x:WEB E2E Regression (shard 1/2) Test [testnet · Chrome]",
      ":large_green_circle: *Passed:* 118",
      ":red_circle: *Failed:* 2",
      job("34979263648", "104445413966"),
      "*FAILED (stable)*",
      "✘ Verify user cannot sign up with a wallet currently used as secondary SecureKey",
      "✘ Verify user cannot sign up with a wallet previously removed as secondary",
    ].join("\n"),
  );
  const [run] = parseChannel(raw, CH).runs;

  assert.equal(run.testType, "regression", "a sharded regression must not fall back to smoke");
  assert.equal(run.part, "shard-1/2");
  assert.deepEqual(run.shard, { index: 1, total: 2 });
  assert.equal(run.browser, "chrome");
  assert.equal(run.env, "testnet");
  assert.equal(run.runId, "34979263648");
  assert.equal(run.failures.length, 2);
  assert.equal(run.failureDetail[0].group, "stable");
});

test("Pre-shard is the same suite as the shards, not a suite of its own", () => {
  const raw = msg(
    "1789485805.289219",
    "2026-09-15 22:23:25 +07",
    [":x:WEB E2E Pre-shard Test [testnet · Chrome]", ":large_green_circle: *Passed:* 31", ":red_circle: *Failed:* 0"].join("\n"),
  );
  const [run] = parseChannel(raw, CH).runs;
  assert.equal(run.testType, "regression");
  assert.equal(run.part, "pre-shard");
});

test("the pre-2026-09-15 header still parses", () => {
  const raw = msg(
    "1787000000.000100",
    "2026-08-26 04:45:00 +07",
    [":white_check_mark:WEB E2E Smoke Test [Chrome]", ":large_green_circle: *Passed:* 49", ":red_circle: *Failed:* 0"].join("\n"),
  );
  const [run] = parseChannel(raw, CH).runs;
  assert.equal(run.testType, "smoke");
  assert.equal(run.browser, "chrome");
  assert.equal(run.part, null);
  assert.equal(run.green, true);
});

test("failures carry the group heading they appeared under", () => {
  const raw = msg(
    "1789515796.446989",
    "2026-09-16 06:43:16 +07",
    [
      ":x:WEB E2E Smoke Test [testnet · Brave]",
      ":large_green_circle: *Passed:* 48",
      ":red_circle: *Failed:* 2",
      "*FAILED (stable)*",
      "✘ A stable one",
      "*FAILED (env-dependent)*",
      "✘ Verify the Margin Ratio is greater than zero while a position is open",
    ].join("\n"),
  );
  const [run] = parseChannel(raw, CH).runs;
  assert.deepEqual(
    run.failureDetail.map((f) => f.group),
    ["stable", "env-dependent"],
  );
});

test("a blocked run is not evidence about the product", () => {
  const raw = msg(
    "1789400000.000200",
    "2026-09-16 02:00:00 +07",
    [
      ":no_entry:WEB E2E Regression Test [testnet · Chrome] — BLOCKED",
      ":large_green_circle: *Passed:* 0",
      ":red_circle: *Failed:* 3",
      "*BLOCKED (preflight)*",
      "✘ Some test",
    ].join("\n"),
  );
  const [run] = parseChannel(raw, CH).runs;
  assert.equal(run.blocked, true);
  assert.equal(run.green, false);
  assert.equal(run.infra, true, "a blocked run must be excluded from pass inference");
  assert.equal(run.failureDetail[0].group, "blocked");
});

test("shards of one workflow run merge into one run", () => {
  const raw = [
    msg(
      "1789485805.289219",
      "2026-09-15 22:23:25 +07",
      [":x:WEB E2E Pre-shard Test [testnet · Chrome]", ":large_green_circle: *Passed:* 31", ":red_circle: *Failed:* 2", job("34979263648", "1"), "*FAILED (stable)*", "✘ Pre A", "✘ Pre B"].join("\n"),
    ),
    msg(
      "1789503515.307149",
      "2026-09-16 03:18:35 +07",
      [":x:WEB E2E Regression (shard 2/2) Test [testnet · Chrome]", ":large_green_circle: *Passed:* 118", ":red_circle: *Failed:* 1", job("34979263648", "2"), "*FAILED (stable)*", "✘ Shard two"].join("\n"),
    ),
    msg(
      "1789507601.498809",
      "2026-09-16 04:26:41 +07",
      [":x:WEB E2E Regression (shard 1/2) Test [testnet · Chrome]", ":large_green_circle: *Passed:* 118", ":red_circle: *Failed:* 2", job("34979263648", "3"), "*FAILED (stable)*", "✘ Shard one a", "✘ Shard one b"].join("\n"),
    ),
  ].join("\n");

  const runs = mergeParts(parseChannel(raw, CH).runs);
  assert.equal(runs.length, 1, "three messages, one workflow run");
  const [run] = runs;
  assert.equal(run.passed, 267);
  assert.equal(run.failed, 5);
  assert.equal(run.failures.length, 5);
  assert.equal(run.parts.length, 3);
  assert.deepEqual(run.missingShards, []);
  assert.equal(run.ts, "1789507601.498809", "the reply belongs in the last message's thread");
});

test("a missing shard is reported, not silently averaged away", () => {
  const raw = msg(
    "1789503515.307149",
    "2026-09-16 03:18:35 +07",
    [":x:WEB E2E Regression (shard 2/3) Test [testnet · Chrome]", ":large_green_circle: *Passed:* 80", ":red_circle: *Failed:* 1", job("999", "2"), "*FAILED (stable)*", "✘ X"].join("\n"),
  ) +
    msg(
      "1789503999.307149",
      "2026-09-16 03:26:35 +07",
      [":x:WEB E2E Regression (shard 3/3) Test [testnet · Chrome]", ":large_green_circle: *Passed:* 80", ":red_circle: *Failed:* 1", job("999", "3"), "*FAILED (stable)*", "✘ Y"].join("\n"),
    );
  const [run] = mergeParts(parseChannel(raw, CH).runs);
  assert.deepEqual(run.missingShards, [1]);
  assert.equal(run.partial, true, "an incomplete run must not be used to infer passes");
});

test("mobile messages sharing a run id are separate runs, not shards", () => {
  const raw = [
    msg(
      "1789000001.000000",
      "2026-09-14 03:39:48 +07",
      [
        ":x:[MOBILE-E2E] [SMOKE] [ANDROID] - OKX",
        ":large_green_circle: Passed: 26   :red_circle: Failed: 2 " + job("34776997623", "1"),
        "*Env:* testnet | *Platform:* android | *Wallet:* OKX Wallet & Privy | *Result:* failure",
        "✘ Android only failure",
      ].join("\n"),
    ),
    msg(
      "1789000002.000000",
      "2026-09-14 03:49:48 +07",
      [
        ":white_check_mark:[MOBILE-E2E] [SMOKE] [IOS] - Privy",
        ":large_green_circle: Passed: 26   :red_circle: Failed: 0 " + job("34776997623", "2"),
        "*Env:* testnet | *Platform:* ios | *Wallet:* Privy | *Result:* success",
      ].join("\n"),
    ),
  ].join("\n");

  const runs = mergeParts(parseChannel(raw, MOB).runs);
  assert.equal(runs.length, 2, "two devices are two runs — merging hides a device-only failure");
});
