import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const prototype = Object.getPrototypeOf(prisma);
const props = Object.getOwnPropertyNames(prototype).filter(p => !p.startsWith('$'));
console.log(JSON.stringify(props, null, 2));
