import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    seed: 'NODE_PATH=./node_modules node -r ts-node/register/transpile-only -e "require(\'./prisma/seed.ts\')"',
  },
});
