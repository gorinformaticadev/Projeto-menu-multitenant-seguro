import { defineConfig } from 'prisma/config'

export default defineConfig({
    schema: './schema.prisma',
    seed: './seed.ts',
})