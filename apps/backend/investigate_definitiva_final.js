const { Client } = require('pg');

async function main() {
  // Hardcoded de segurança para evitar problemas de dotenv
  const connectionString = "postgresql://postgres:postgres123@localhost:5432/multitenant_db?schema=public";
  console.log('Connecting to database...');
  const client = new Client({ connectionString });
  await client.connect();

  console.log("\n=== ETAPA 1: VALIDACAO DE EXECUCAO ATIVA (HEARTBEAT) ===");
  const heartbeats = await client.query('SELECT "jobKey", "lastStartedAt", "lastHeartbeatAt", "lastStatus", "cycleId", "instanceId" FROM "cron_job_heartbeats" WHERE "jobKey" = $1', ['system.session_cleanup']);
  if (heartbeats.rows.length > 0) {
    const hb = heartbeats.rows[0];
    console.log(`Job Key: ${hb.jobKey}`);
    console.log(`Status: ${hb.lastStatus}`);
    console.log(`lastStartedAt: ${hb.lastStartedAt}`);
    console.log(`lastHeartbeatAt: ${hb.lastHeartbeatAt}`);
    
    if (hb.lastStartedAt && hb.lastHeartbeatAt) {
      const start = new Date(hb.lastStartedAt).getTime();
      const hbTime = new Date(hb.lastHeartbeatAt).getTime();
      const now = Date.now();
      console.log(`Diferença Start-Heartbeat: ${(hbTime - start) / 1000 / 60} minutos`);
      console.log(`Diferença Heartbeat-Now: ${(now - hbTime) / 1000 / 60} minutos`);
    }
  } else {
    console.log("Nenhum heartbeat encontrado para system.session_cleanup");
  }

  console.log("\n=== ETAPA 2: VALIDACAO DE LOCK (ADVISORY) ===");
  const locks = await client.query("SELECT pid, locktype, mode, granted FROM pg_locks WHERE locktype = 'advisory'");
  console.dir(locks.rows, { depth: null });

  if (locks.rows.length > 0) {
    for (const lock of locks.rows) {
      const pid = lock.pid;
      console.log(`\n=== ETAPA 2.1: ATIVIDADE PARA PID ${pid} ===`);
      const activity = await client.query("SELECT pid, state, query, now() - query_start AS duration FROM pg_stat_activity WHERE pid = $1", [pid]);
      console.dir(activity.rows, { depth: null });
    }
  } else {
    console.log("Nenhum Advisory lock encontrado.");
  }

  console.log("\n=== ETAPA 4: PERFORMANCE DO BANCO (EXPLAIN ANALYZE) ===");
  try {
    const explain = await client.query('EXPLAIN ANALYZE SELECT id FROM "user_sessions" WHERE "expiresAt" < NOW() LIMIT 1000');
    console.log(explain.rows.map(r => r['QUERY PLAN']).join('\n'));
  } catch (e) {
    console.error("Erro no Explain:", e.message);
  }

  console.log("\n=== ETAPA 4.2: VOLUME DE DADOS ===");
  try {
    const count = await client.query('SELECT COUNT(*) FROM "user_sessions" WHERE "expiresAt" < NOW()');
    console.log(`Sessões expiradas: ${count.rows[0].count}`);
  } catch (e) {
    console.error("Erro no Count:", e.message);
  }

  console.log("\n=== ETAPA 5: CONTENCAO / DEADLOCKS ===");
  const deadlocks = await client.query("SELECT l.pid, l.locktype, l.mode, a.query FROM pg_locks l JOIN pg_stat_activity a ON l.pid = a.pid WHERE NOT l.granted");
  if (deadlocks.rows.length > 0) {
    console.dir(deadlocks.rows, { depth: null });
  } else {
    console.log("Nenhuma contenção de lock (NOT granted) encontrada.");
  }

  await client.end();
}

main().catch(console.error);
