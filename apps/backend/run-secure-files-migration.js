const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function runMigration() {
  try {
    console.log('🔄 Executando migration: add_secure_files_table...');

    const sqlPath = path.join(__dirname, 'prisma', 'migrations', 'add_secure_files_table.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');

    // Dividir o SQL em statements individuais e filtrar comentários
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => {
        // Remover linhas de comentário
        const lines = s.split('\n').filter(line => !line.trim().startsWith('--'));
        const cleaned = lines.join('\n').trim();
        return cleaned.length > 0;
      });

    console.log(`Total de statements: ${statements.length}`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement && !statement.startsWith('COMMENT')) {
        console.log(`[${i + 1}/${statements.length}] Executando: ${statement.substring(0, 60)}...`);
        await prisma.$executeRawUnsafe(statement);
      }
    }

    console.log('✅ Migration executada com sucesso!');

    // Verificar se a tabela foi criada
    const result = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'secure_files'
    `;

    if (result && result.length > 0) {
      console.log('✅ Tabela secure_files criada com sucesso!');
    } else {
      console.log('⚠️ Tabela secure_files não encontrada');
    }

  } catch (error) {
    console.error('❌ Erro ao executar migration:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runMigration();
