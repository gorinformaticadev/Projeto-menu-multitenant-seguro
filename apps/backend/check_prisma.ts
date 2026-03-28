import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
console.log('Available models/methods on PrismaClient:');
const members = Object.keys(prisma).filter(k => !k.startsWith('_') && !k.startsWith('$'));
console.log(JSON.stringify(members, null, 2));

process.exit(0);
