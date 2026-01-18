import { PrismaConfig } from "@prisma/adapter-node";

export default {
    datasource: {
        provider: "postgresql",
        url: process.env.DATABASE_URL,
    },
} satisfies PrismaConfig;
