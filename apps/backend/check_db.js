const { PrismaClient } = require('./node_modules/@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  try {
    const r = await prisma.$queryRawUnsafe('SELECT * FROM "update_system_settings" LIMIT 1');
    console.dir(r, { depth: null });
    
    // Test direct update fallback logic
    const columns = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'update_system_settings'
    `;
    console.log("COLUMNS:", columns.map(c => c.column_name));
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
