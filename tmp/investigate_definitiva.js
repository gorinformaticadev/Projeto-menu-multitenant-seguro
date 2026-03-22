require('dotenv').config({ path: 'd:/Usuarios/Servidor/GORInformatica/Documents/GitHub/Projeto-menu-multitenant-seguro/apps/backend/.env' });
const { Client } = require('pg');

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is not set');
    return;
  }
  console.log('Connecting to:', connectionString.replace(/:([^:@]+)@/, ':****@'));

  const client = new Client({ connectionString });
  await client.connect();

  console.log("\n=== ETAPA 1: HEARTBEAT DA SESSÃO ===");
  const heartbeats = await client.query('SELECT * FROM "cron_job_heartbeats" WHERE "jobKey" = $1', ['system.session_cleanup']);
  console.dir(heartbeats.rows, { depth: null });

  console.log("\n=== ETAPA 2: ADVISORY LOCKS ===");
  const locks = await client.query("SELECT * FROM pg_locks WHERE locktype = 'advisory'");
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

  console.log("\n=== ETAPA 4: EXPLAIN ANALYZE (Performance) ===");
  try {
    const explain = await client.query('EXPLAIN ANALYZE SELECT id FROM "UserSession" WHERE "expiresAt" < NOW() LIMIT 1000');
    console.log(explain.rows.map(r => r['QUERY PLAN']).join('\n'));
  } catch (e) {
    console.error("Falha no EXPLAIN ANALYZE:", e.message);
  }

  console.log("\n=== ETAPA 4.2: CONTAGEM DE SESSÕES EXPIRADAS ===");
  try {
    const count = await client.query('SELECT COUNT(*) FROM "UserSession" WHERE "expiresAt" < NOW()');
    console.dir(count.rows, { depth: null });
  } catch (e) {
    console.error("Falha na contagem:", e.message);
  }

  console.log("\n=== ETAPA 5: CONTENÇÃO / DEADLOCKS ===");
  const deadlocks = await client.query("SELECT l.pid, l.locktype, l.mode, a.query FROM pg_locks l JOIN pg_stat_activity a ON l.pid = a.pid WHERE NOT l.granted");
  if (deadlocks.rows.length > 0) {
    console.dir(deadlocks.rows, { depth: null });
  } else {
    console.log("Nenhuma contenção de lock (NOT granted) encontrada.");
  }

  await client.end();
}

main().catch(console.error);
