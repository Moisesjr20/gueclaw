#!/usr/bin/env node
/**
 * Script para testar Cost Tracker na VPS
 * Executa: node /tmp/test-cost-vps.js
 */

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join('/opt/gueclaw-agent/data', 'gueclaw.db');

console.log('🧪 Testando Cost Tracker na VPS\n');
console.log('📁 Database:', DB_PATH, '\n');

try {
  const db = new Database(DB_PATH, { readonly: true });
  
  // 1. Verificar se tabela existe
  console.log('📊 1. Verificando tabela cost_tracking...');
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='cost_tracking'").all();
  
  if (tables.length === 0) {
    console.log('❌ Tabela cost_tracking NÃO EXISTE!');
    process.exit(1);
  }
  console.log('✅ Tabela cost_tracking existe!\n');

  // 2. Ver schema
  console.log('📋 2. Schema da tabela:');
  const schema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='cost_tracking'").get();
  console.log(schema.sql);
  console.log('');

  // 3. Contar registros
  console.log('📈 3. Total de registros:');
  const count = db.prepare('SELECT COUNT(*) as total FROM cost_tracking').get();
  console.log(`   ${count.total} registros\n`);

  // 4. Últimos 5 registros
  if (count.total > 0) {
    console.log('💰 4. Últimos 5 registros:');
    const recent = db.prepare(`
      SELECT 
        datetime(timestamp/1000, 'unixepoch') as dt,
        provider,
        model,
        input_tokens + output_tokens as total_tokens,
        cost_usd
      FROM cost_tracking 
      ORDER BY timestamp DESC 
      LIMIT 5
    `).all();
    
    console.table(recent);
  } else {
    console.log('⚠️  4. Nenhum registro ainda (bot precisa processar mensagens)');
  }

  // 5. Custo total por provider
  console.log('\n💵 5. Custo total por provider:');
  const byProvider = db.prepare(`
    SELECT 
      provider,
      COUNT(*) as calls,
      SUM(input_tokens + output_tokens) as total_tokens,
      SUM(cost_usd) as total_cost
    FROM cost_tracking 
    GROUP BY provider
    ORDER BY total_cost DESC
  `).all();
  
  if (byProvider.length > 0) {
    console.table(byProvider);
  } else {
    console.log('   (Nenhum dado ainda)\n');
  }

  db.close();
  
  console.log('\n✅ Cost Tracker está configurado corretamente!\n');
  console.log('📋 Próximos passos:');
  console.log('   1. Envie uma mensagem ao bot via Telegram');
  console.log('   2. Use o comando /cost para ver os custos');
  console.log('   3. Execute este script novamente para ver dados reais');

} catch (error) {
  console.error('❌ Erro:', error.message);
  process.exit(1);
}
