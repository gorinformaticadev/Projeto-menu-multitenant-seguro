import 'dotenv/config';
import { Client } from 'pg';

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is not set');
    return;
  }

  const client = new Client({ connectionString });
  await client.connect();

  const heartbeatsQuery = await client.query('SELECT * FROM "cron_job_heartbeats" WHERE "jobKey" = $1', ['system.session_cleanup']);
  console.log('Heartbeats for system.session_cleanup:');
  console.dir(heartbeatsQuery.rows, { depth: null });

  const cronScheduleQuery = await client.query('SELECT * FROM "CronSchedule" WHERE "identificador" = $1', ['session_cleanup']);
  console.log('CronSchedule for session_cleanup:');
  console.dir(cronScheduleQuery.rows, { depth: null });

  await client.end();
}

main()
  .catch(e => console.error(e));
