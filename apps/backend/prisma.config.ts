import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    seed: 'NODE_PATH=./node_modules ts-node prisma/seed.ts',
  },
});
