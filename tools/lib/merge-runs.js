/**
 * merge-runs.js — stitch the several Slack messages of one workflow run back into one run.
 *
 * Since 2026-09-15 a web regression run fans out: a serial `Pre-shard` batch, then one job per
 * shard, each posting its own Slack message. They share a single GitHub Actions run id — the same
 * suite, the same commit, one run split across messages.
 *
 * They must be merged before anything is inferred from them, because **each shard runs a different
 * half of the suite**. The pass rule in ingest.js reads "every test known in this suite that is not
 * in this run's failure list passed"; applied to shard 2 on its own, that marks every test in
 * shard 1 as passing. A test genuinely red all week then shows as passing and failing on alternate
 * messages — the exact signature of a flaky test — and the verdict flips from "something really
 * changed" to "our test is flaky". Merging first is what keeps that inference honest.
 *
 * Messages that carry no part (smoke, mobile, the pre-2026-09-15 format) merge to themselves, so
 * this is safe to run over all history.
 */

/**
 * Messages belong to the same logical run only when one of them says it is a *part* of one —
 * `Pre-shard`, `shard i/n`. A shared run id is not enough on its own: the mobile workflow posts one
 * message per device and wallet under a single run id, and those are whole separate runs of the
 * suite on different hardware. Merging them would hide a failure that lands on one device only,
 * which is exactly the signal the variant-only verdict depends on.
 */
function groupKey(m) {
  if (!m.part || !m.runId) return `ts:${m.channelKey}:${m.ts}`;
  return `run:${m.channelKey}:${m.suiteKey}:${m.variant || "-"}:${m.runId}`;
}

const sumOrNull = (vals) => {
  const nums = vals.filter((v) => typeof v === "number");
  return nums.length ? nums.reduce((a, b) => a + b, 0) : null;
};

/**
 * @param {object[]} messages  Parsed Slack messages, one per post (parse-slack.js output)
 * @returns {object[]} logical runs, each carrying `parts` — the messages it was built from
 */
export function mergeParts(messages) {
  const groups = new Map();
  for (const m of messages) {
    const k = groupKey(m);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(m);
  }

  const runs = [];
  for (const [, parts] of groups) {
    parts.sort((a, b) => Number(a.ts || 0) - Number(b.ts || 0));
    const last = parts.at(-1);

    if (parts.length === 1) {
      runs.push({ ...last, parts: [partOf(last)] });
      continue;
    }

    // A shard list with a hole in it is not a whole run. Say so rather than reporting a pass rate
    // computed from half the suite: the missing shard's tests would all be inferred as passing.
    const total = parts.find((p) => p.shard)?.shard?.total || null;
    const seen = new Set(parts.filter((p) => p.shard).map((p) => p.shard.index));
    const missingShards = total
      ? Array.from({ length: total }, (_, i) => i + 1).filter((i) => !seen.has(i))
      : [];

    const failureDetail = parts.flatMap((p) =>
      (p.failureDetail || p.failures.map((t) => ({ title: t, group: "unknown" }))).map((f) => ({
        ...f,
        part: p.part || null,
      })),
    );

    runs.push({
      ...last,
      // The run is identified by its last message: that is the thread a reply lands in, and the
      // moment the run actually finished.
      ts: last.ts,
      iso: last.iso,
      date: last.date,
      headerLine: last.headerLine.replace(/\s*\(shard\s+\d+\s*\/\s*\d+\)/i, ""),
      part: null,
      shard: null,
      passed: sumOrNull(parts.map((p) => p.passed)),
      failed: sumOrNull(parts.map((p) => p.failed)),
      failures: failureDetail.map((f) => f.title),
      failureDetail,
      ok: parts.every((p) => p.ok),
      green: parts.every((p) => p.green),
      blocked: parts.some((p) => p.blocked),
      partial: parts.some((p) => p.partial) || missingShards.length > 0,
      truncatedFailureList: parts.some((p) => p.truncatedFailureList),
      infra: parts.every((p) => p.infra),
      threadReplies: parts.reduce((a, p) => a + (p.threadReplies || 0), 0),
      missingShards,
      parts: parts.map(partOf),
    });
  }

  runs.sort((a, b) => Number(a.ts || 0) - Number(b.ts || 0));
  return runs;
}

/** The per-message facts a thread reply needs: where to post it and what that message showed. */
function partOf(m) {
  return {
    part: m.part || null,
    ts: m.ts,
    iso: m.iso,
    passed: m.passed,
    failed: m.failed,
    green: !!m.green,
    blocked: !!m.blocked,
    jobUrl: m.jobUrl || null,
    reportUrl: m.reportUrl || null,
    failures: m.failures || [],
  };
}

/** Short label for a part, for report tables and message headers. */
export function partLabel(part) {
  if (!part) return "";
  if (part === "pre-shard") return "pre-shard";
  const m = part.match(/^shard-(\d+)\/(\d+)$/);
  return m ? `shard ${m[1]}/${m[2]}` : part;
}
