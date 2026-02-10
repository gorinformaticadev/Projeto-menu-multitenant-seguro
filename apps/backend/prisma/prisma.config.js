// prisma.config.js
module.exports = {
    datasources: {
        db: {
            // O segredo é garantir que o process.env esteja acessível
            url: process.env.DATABASE_URL,
        },
    },
};