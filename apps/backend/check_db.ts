import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  try {
    const tables = await prisma.$queryRaw`SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public'`;
    console.log('Tables in public schema:');
    console.dir(tables, { depth: null });
  } catch (e) {
    console.error('Error connecting to database or querying tables:');
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
