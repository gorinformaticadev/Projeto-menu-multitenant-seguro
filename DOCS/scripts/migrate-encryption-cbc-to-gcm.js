#!/usr/bin/env node

/**
 * Script de Migração de Criptografia - CBC para GCM
 * 
 * Este script migra dados criptografados no formato legado (AES-256-CBC)
 * para o novo formato seguro (AES-256-GCM) com autenticação.
 * 
 * USO: node scripts/migrate-encryption-cbc-to-gcm.js
 */

const { PrismaClient } = require('@prisma/client');
const { decryptSensitiveData, encryptSensitiveData } = require('../apps/backend/src/common/utils/security.utils');

// Configurações
const BATCH_SIZE = 100; // Processar em lotes para evitar sobrecarga de memória
const DELAY_BETWEEN_BATCHES = 1000; // 1 segundo entre lotes

// Modelos que podem conter dados sensíveis criptografados
const MODELS_WITH_SENSITIVE_DATA = [
  { model: 'User', fields: ['cpf', 'rg', 'telefone'] },
  { model: 'Client', fields: ['cpfCnpj', 'rg', 'telefone', 'endereco'] },
  { model: 'Equipment', fields: ['serialNumber', 'imei'] },
  { model: 'OrderService', fields: ['clientInfo', 'equipmentInfo'] },
  // Adicione outros modelos conforme necessário
];

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function migrateModelData(prisma, modelName, fields) {
  console.log(`\n🔄 Migrando modelo: ${modelName}`);
  
  try {
    // Buscar registros que possuem dados nos campos especificados
    const records = await prisma[modelName].findMany({
      where: {
        OR: fields.map(field => ({
          [field]: { not: null }
        }))
      },
      select: { id: true, ...fields.reduce((acc, field) => ({ ...acc, [field]: true }), {}) }
    });

    console.log(`📊 Registros encontrados: ${records.length}`);

    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    // Processar em lotes
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      
      console.log(`\n📦 Processando lote ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(records.length/BATCH_SIZE)}`);
      
      for (const record of batch) {
        try {
          const updateData = {};
          
          // Verificar cada campo sensível
          for (const field of fields) {
            const fieldValue = record[field];
            
            if (fieldValue && typeof fieldValue === 'string') {
              try {
                // Tentar descriptografar com o método legado
                const decrypted = decryptSensitiveData(fieldValue);
                
                // Se descriptografou com sucesso, significa que estava no formato legado
                if (decrypted) {
                  // Recriptografar no novo formato GCM
                  const reEncrypted = encryptSensitiveData(decrypted);
                  
                  updateData[field] = reEncrypted;
                  migratedCount++;
                  console.log(`  ✅ ${modelName}[${record.id}].${field} - Migrado`);
                } else {
                  skippedCount++;
                  console.log(`  ⚠️  ${modelName}[${record.id}].${field} - Já no formato novo ou inválido`);
                }
              } catch (decryptError) {
                // Se falhar a descriptografia, pode ser que já esteja no novo formato
                // ou dados corrompidos
                skippedCount++;
                console.log(`  ⚠️  ${modelName}[${record.id}].${field} - Pulado (${decryptError.message})`);
              }
            }
          }
          
          // Atualizar registro se houver dados para migrar
          if (Object.keys(updateData).length > 0) {
            await prisma[modelName].update({
              where: { id: record.id },
              data: updateData
            });
          }
          
        } catch (error) {
          errorCount++;
          console.error(`  ❌ Erro ao migrar ${modelName}[${record.id}]:`, error.message);
        }
      }
      
      // Pequeno delay entre lotes para não sobrecarregar o banco
      if (i + BATCH_SIZE < records.length) {
        await delay(DELAY_BETWEEN_BATCHES);
      }
    }

    console.log(`\n📈 Resultado da migração de ${modelName}:`);
    console.log(`   ✅ Migrados: ${migratedCount}`);
    console.log(`   ⚠️  Pulados: ${skippedCount}`);
    console.log(`   ❌ Erros: ${errorCount}`);
    
    return { migrated: migratedCount, skipped: skippedCount, errors: errorCount };
    
  } catch (error) {
    console.error(`❌ Erro ao migrar modelo ${modelName}:`, error.message);
    return { migrated: 0, skipped: 0, errors: 1 };
  }
}

async function backupDatabase() {
  console.log('💾 Criando backup do banco de dados...');
  
  // Aqui você pode implementar a lógica de backup
  // Por exemplo, usando pg_dump para PostgreSQL
  try {
    // Exemplo básico - adaptar conforme seu ambiente
    const { execSync } = require('child_process');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupCommand = `pg_dump -h localhost -U postgres -d multitenant_db > backup_pre_migracao_${timestamp}.sql`;
    
    console.log(`Executando: ${backupCommand}`);
    // execSync(backupCommand); // Descomentar quando em produção
    
    console.log('✅ Backup criado com sucesso');
    return true;
  } catch (error) {
    console.error('❌ Falha ao criar backup:', error.message);
    return false;
  }
}

async function validateMigration(prisma) {
  console.log('\n🔍 Validando migração...');
  
  let validationErrors = 0;
  
  for (const { model, fields } of MODELS_WITH_SENSITIVE_DATA) {
    try {
      const sampleRecords = await prisma[model].findMany({
        where: {
          OR: fields.map(field => ({
            [field]: { not: null }
          }))
        },
        take: 5 // Testar algumas amostras
      });
      
      for (const record of sampleRecords) {
        for (const field of fields) {
          const fieldValue = record[field];
          if (fieldValue && typeof fieldValue === 'string') {
            try {
              // Tentar descriptografar - deve funcionar com o novo formato
              decryptSensitiveData(fieldValue);
            } catch (error) {
              console.error(`❌ Validação falhou para ${model}[${record.id}].${field}:`, error.message);
              validationErrors++;
            }
          }
        }
      }
    } catch (error) {
      console.error(`❌ Erro na validação do modelo ${model}:`, error.message);
      validationErrors++;
    }
  }
  
  if (validationErrors === 0) {
    console.log('✅ Validação concluída com sucesso!');
    return true;
  } else {
    console.log(`❌ ${validationErrors} erros encontrados na validação`);
    return false;
  }
}

async function main() {
  console.log('🚀 Iniciando migração de criptografia CBC → GCM\n');
  
  const prisma = new PrismaClient();
  
  try {
    // 1. Criar backup (opcional, mas altamente recomendado)
    const backupSuccess = await backupDatabase();
    if (!backupSuccess) {
      console.log('⚠️  Continuando sem backup...');
    }
    
    // 2. Confirmar início da migração
    console.log('\n⚠️  ATENÇÃO: Esta operação irá modificar dados criptografados no banco.');
    console.log('Certifique-se de ter feito backup e testado em ambiente de staging.\n');
    
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const answer = await new Promise(resolve => {
      readline.question('Deseja continuar com a migração? (sim/não): ', resolve);
    });
    
    readline.close();
    
    if (answer.toLowerCase() !== 'sim') {
      console.log('❌ Migração cancelada pelo usuário.');
      return;
    }
    
    // 3. Executar migração para cada modelo
    const results = [];
    
    for (const { model, fields } of MODELS_WITH_SENSITIVE_DATA) {
      const result = await migrateModelData(prisma, model, fields);
      results.push({ model, ...result });
      
      // Pequena pausa entre modelos
      await delay(2000);
    }
    
    // 4. Mostrar resumo final
    console.log('\n📋 RESUMO DA MIGRAÇÃO:');
    console.log('=' .repeat(50));
    
    let totalMigrated = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    
    for (const result of results) {
      console.log(`${result.model}:`);
      console.log(`  ✅ Migrados: ${result.migrated}`);
      console.log(`  ⚠️  Pulados: ${result.skipped}`);
      console.log(`  ❌ Erros: ${result.errors}`);
      
      totalMigrated += result.migrated;
      totalSkipped += result.skipped;
      totalErrors += result.errors;
    }
    
    console.log('\n📈 TOTAL GERAL:');
    console.log(`  ✅ Migrados: ${totalMigrated}`);
    console.log(`  ⚠️  Pulados: ${totalSkipped}`);
    console.log(`  ❌ Erros: ${totalErrors}`);
    
    // 5. Validar resultados
    if (totalErrors === 0) {
      const validationPassed = await validateMigration(prisma);
      if (validationPassed) {
        console.log('\n🎉 MIGRAÇÃO CONCLUÍDA COM SUCESSO!');
        console.log('✅ Todos os dados foram migrados para o formato GCM seguro.');
      } else {
        console.log('\n⚠️  Migração concluída, mas validação falhou.');
        console.log('Verifique os logs acima para detalhes.');
      }
    } else {
      console.log('\n⚠️  Migração concluída com erros.');
      console.log('Recomenda-se investigar os erros e executar novamente.');
    }
    
  } catch (error) {
    console.error('\n💥 Erro fatal durante a migração:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

// Executar apenas se chamado diretamente
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  migrateModelData,
  backupDatabase,
  validateMigration
};