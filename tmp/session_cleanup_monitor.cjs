const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');
const backendRequire = createRequire(
  path.resolve(__dirname, '..', 'apps', 'backend', 'package.json'),
);
const { Client } = backendRequire('pg');

const OUTPUT_PATH = path.join(__dirname, 'session_cleanup_monitor_output.jsonl');
const ERROR_PATH = path.join(__dirname, 'session_cleanup_monitor_error.log');
const STATE_PATH = path.join(__dirname, 'session_cleanup_monitor_state.json');
const JOB_KEY = 'system.session_cleanup';
const DEFAULT_LOCK_ID = 98542174;
const WATCHDOG_ACTIONS = ['JOB_NOT_RUNNING', 'JOB_STUCK_RUNNING', 'JOB_REPEATED_FAILURES'];

function readEnvFile(filePath) {
  const out = {};
  const raw = fs.readFileSync(filePath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const idx = trimmed.indexOf('=');
    if (idx < 0) {
      continue;
    }
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim().replace(/^"|"$/g, '');
    out[key] = value;
  }
  return out;
}

function appendJsonLine(payload) {
  fs.appendFileSync(OUTPUT_PATH, `${JSON.stringify(payload)}\n`);
}

function appendError(message) {
  fs.appendFileSync(ERROR_PATH, `[${new Date().toISOString()}] ${message}\n`);
}

function serialize(value) {
  return JSON.stringify(value);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchState(client, lockId, selfPid, lastAuditAtIso) {
  const result = await client.query(
    `
      WITH heartbeat AS (
        SELECT
          "jobKey",
          "lastStartedAt",
          "lastHeartbeatAt",
          "lastSucceededAt",
          "lastFailedAt",
          "lastDurationMs",
          "lastStatus",
          "lastError",
          "nextExpectedRunAt",
          "cycleId",
          "instanceId",
          "consecutiveFailureCount",
          "updatedAt"
        FROM "cron_job_heartbeats"
        WHERE "jobKey" = $1
      ),
      lock_rows AS (
        SELECT
          l.pid,
          l.objid,
          l.mode,
          l.granted,
          a.state,
          a.wait_event_type AS "waitEventType",
          a.wait_event AS "waitEvent",
          now() - a.backend_start AS "backendAge",
          now() - a.query_start AS "queryAge",
          left(a.query, 300) AS query
        FROM pg_locks l
        JOIN pg_stat_activity a ON a.pid = l.pid
        WHERE l.locktype = 'advisory'
          AND l.objid = $2
      ),
      interesting AS (
        SELECT
          a.pid,
          a.state,
          a.wait_event_type AS "waitEventType",
          a.wait_event AS "waitEvent",
          now() - a.backend_start AS "backendAge",
          now() - a.query_start AS "queryAge",
          left(a.query, 300) AS query
        FROM pg_stat_activity a
        WHERE a.pid <> $3
          AND a.datname = current_database()
          AND (
            a.query ILIKE '%pg_try_advisory_lock%'
            OR a.query ILIKE '%pg_advisory_unlock%'
            OR a.query ILIKE '%cron_job_heartbeats%'
            OR a.query ILIKE '%user_sessions%'
          )
      ),
      audits AS (
        SELECT
          id,
          action,
          details,
          "createdAt"
        FROM audit_logs
        WHERE action = ANY($4)
          AND details::text ILIKE '%' || $1 || '%'
          AND "createdAt" > $5::timestamptz
        ORDER BY "createdAt" ASC
      )
      SELECT
        now() AS now,
        (SELECT row_to_json(h) FROM heartbeat h) AS heartbeat,
        (
          SELECT COALESCE(json_agg(row_to_json(l) ORDER BY l.pid), '[]'::json)
          FROM lock_rows l
        ) AS locks,
        (
          SELECT COALESCE(json_agg(row_to_json(i) ORDER BY i.pid), '[]'::json)
          FROM interesting i
        ) AS interesting,
        (
          SELECT COALESCE(json_agg(row_to_json(a) ORDER BY a."createdAt"), '[]'::json)
          FROM audits a
        ) AS audits
    `,
    [JOB_KEY, lockId, selfPid, WATCHDOG_ACTIONS, lastAuditAtIso],
  );

  return result.rows[0];
}

async function main() {
  const backendDir = path.resolve(__dirname, '..', 'apps', 'backend');
  const env = readEnvFile(path.join(backendDir, '.env'));
  const lockId = Number.parseInt(env.SESSION_CLEANUP_LOCK_ID || '', 10) || DEFAULT_LOCK_ID;
  const timeoutMs = Number.parseInt(process.env.MONITOR_TIMEOUT_MS || '', 10) || 60 * 60 * 1000;
  const sampleFastMs = Number.parseInt(process.env.MONITOR_FAST_MS || '', 10) || 100;
  const sampleSlowMs = Number.parseInt(process.env.MONITOR_SLOW_MS || '', 10) || 2000;
  const hotWindowMs = Number.parseInt(process.env.MONITOR_HOT_WINDOW_MS || '', 10) || 2 * 60 * 1000;
  const databaseUrl = env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL ausente em apps/backend/.env');
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  const selfInfo = await client.query('SELECT pg_backend_pid() AS pid');
  const selfPid = selfInfo.rows[0].pid;

  const startedAt = Date.now();
  let lastAuditAtIso = '1970-01-01T00:00:00.000Z';
  let lastSnapshotKey = '';
  let cycleState = null;

  appendJsonLine({
    type: 'monitor_started',
    at: new Date().toISOString(),
    lockId,
    selfPid,
    timeoutMs,
    sampleFastMs,
    sampleSlowMs,
    hotWindowMs,
  });

  while (Date.now() - startedAt < timeoutMs) {
    const row = await fetchState(client, lockId, selfPid, lastAuditAtIso);
    const heartbeat = row.heartbeat || null;
    const locks = Array.isArray(row.locks) ? row.locks : [];
    const interesting = Array.isArray(row.interesting) ? row.interesting : [];
    const audits = Array.isArray(row.audits) ? row.audits : [];

    if (audits.length > 0) {
      lastAuditAtIso = audits[audits.length - 1].createdAt;
    }

    const snapshotKey = serialize({
      heartbeat,
      locks,
      interesting,
      audits,
    });

    if (snapshotKey !== lastSnapshotKey) {
      appendJsonLine({
        type: 'state_change',
        at: row.now,
        heartbeat,
        locks,
        interesting,
        audits,
      });
      lastSnapshotKey = snapshotKey;
    }

    const currentCycleId = heartbeat?.cycleId || null;
    if (currentCycleId && (!cycleState || cycleState.cycleId !== currentCycleId)) {
      cycleState = {
        cycleId: currentCycleId,
        startedAt: heartbeat.lastStartedAt || null,
        successAt: heartbeat.lastSucceededAt || null,
        failureAt: heartbeat.lastFailedAt || null,
        status: heartbeat.lastStatus || null,
        firstLockSeenAt: locks.length > 0 ? row.now : null,
        lastLockSeenAt: locks.length > 0 ? row.now : null,
        lockOwnerPid: locks.length > 0 ? locks[0].pid : null,
        unlockSeenAt: null,
        lingeringLockDetected: false,
      };
      appendJsonLine({
        type: 'cycle_detected',
        at: row.now,
        cycleId: currentCycleId,
        heartbeat,
      });
    }

    if (cycleState && cycleState.cycleId === currentCycleId) {
      cycleState.status = heartbeat?.lastStatus || cycleState.status;
      cycleState.successAt = heartbeat?.lastSucceededAt || cycleState.successAt;
      cycleState.failureAt = heartbeat?.lastFailedAt || cycleState.failureAt;
      if (locks.length > 0) {
        if (!cycleState.firstLockSeenAt) {
          cycleState.firstLockSeenAt = row.now;
        }
        cycleState.lastLockSeenAt = row.now;
        cycleState.lockOwnerPid = locks[0].pid;
      } else if (
        !cycleState.unlockSeenAt &&
        cycleState.firstLockSeenAt &&
        (heartbeat?.lastStatus === 'success' || heartbeat?.lastStatus === 'failed')
      ) {
        cycleState.unlockSeenAt = row.now;
        appendJsonLine({
          type: 'unlock_observed',
          at: row.now,
          cycleId: cycleState.cycleId,
          lockOwnerPid: cycleState.lockOwnerPid,
          heartbeat,
        });
      }

      if (
        locks.length > 0 &&
        (heartbeat?.lastStatus === 'success' || heartbeat?.lastStatus === 'failed')
      ) {
        cycleState.lingeringLockDetected = true;
        appendJsonLine({
          type: 'lock_lingering_after_terminal_state',
          at: row.now,
          cycleId: cycleState.cycleId,
          heartbeat,
          locks,
        });
      }
    }

    const nextExpectedRunAt = heartbeat?.nextExpectedRunAt ? new Date(heartbeat.nextExpectedRunAt).getTime() : null;
    const nowMs = new Date(row.now).getTime();
    const nearWindow =
      nextExpectedRunAt !== null && Math.abs(nextExpectedRunAt - nowMs) <= hotWindowMs;
    const hasOpenCycle =
      heartbeat?.lastStatus === 'running' ||
      (Array.isArray(locks) && locks.length > 0) ||
      interesting.length > 0 ||
      audits.length > 0;

    await sleep(nearWindow || hasOpenCycle ? sampleFastMs : sampleSlowMs);
  }

  appendJsonLine({
    type: 'monitor_finished',
    at: new Date().toISOString(),
  });

  fs.writeFileSync(
    STATE_PATH,
    JSON.stringify(
      {
        finishedAt: new Date().toISOString(),
        outputPath: OUTPUT_PATH,
        errorPath: ERROR_PATH,
      },
      null,
      2,
    ),
  );

  await client.end();
}

main().catch((error) => {
  appendError(error.stack || error.message || String(error));
  process.exitCode = 1;
});
