import { defineConfig } from 'prisma/config'

export default defineConfig({
    client: {
        adapter: {
            url: process.env.DATABASE_URL!,
        },
    },
})
