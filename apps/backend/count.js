const { PrismaClient } = require('./node_modules/@prisma/client');
async function main() {
  const prisma = new PrismaClient();
  try {
    const c = await prisma.$queryRawUnsafe('SELECT COUNT(*) FROM "update_system_settings"');
    console.log(c);
    const all = await prisma.$queryRawUnsafe('SELECT id, "updateChannel" FROM "update_system_settings"');
    console.log(all);
  } finally {
    await prisma.$disconnect();
  }
}
main();
