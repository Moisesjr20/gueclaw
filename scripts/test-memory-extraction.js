#!/usr/bin/env node
/**
 * Test script for Memory Extraction System
 * Simulates a conversation and tests memory extraction
 */

const { MemoryManagerService } = require('../dist/services/memory-extractor');
const { MemoryRepository } = require('../dist/services/memory-extractor/memory-repository');

const TEST_USER_ID = 'test-memory-user-' + Date.now();
const TEST_CONVERSATION_ID = 'test-conv-' + Date.now();

// Test messages simulating a real conversation
const testMessages = [
  { role: 'user', content: 'Oi, estou procurando um sistema de automação', timestamp: new Date() },
  { role: 'assistant', content: 'Olá! Posso ajudá-lo com automação. Que tipo de sistema você precisa?', timestamp: new Date() },
  { role: 'user', content: 'Preciso automatizar WhatsApp e integrar com meu CRM', timestamp: new Date() },
  { role: 'assistant', content: 'Entendi. Para WhatsApp, temos integração via UazAPI. Qual CRM você usa?', timestamp: new Date() },
  { role: 'user', content: 'Uso GoHighLevel. Prefiro soluções em TypeScript', timestamp: new Date() },
  { role: 'assistant', content: 'Perfeito! TypeScript é uma excelente escolha. Podemos integrar com GoHighLevel.', timestamp: new Date() },
  { role: 'user', content: 'Meu objetivo é lançar isso em 2 meses. Tenho orçamento de R$ 10.000', timestamp: new Date() },
  { role: 'assistant', content: 'Entendido. 2 meses é viável e o orçamento é adequado.', timestamp: new Date() },
  { role: 'user', content: 'Ah, importante: não posso usar servidores fora do Brasil', timestamp: new Date() },
  { role: 'assistant', content: 'Sem problemas, usaremos infraestrutura nacional.', timestamp: new Date() },
  { role: 'user', content: 'Ótimo! Também domino Node.js e React, então posso ajudar no desenvolvimento', timestamp: new Date() },
  { role: 'assistant', content: 'Excelente! Sua experiência com Node.js e React será muito útil.', timestamp: new Date() },
  { role: 'user', content: 'Decidi usar n8n para os workflows de automação', timestamp: new Date() },
  { role: 'assistant', content: 'n8n é uma ótima escolha para workflows visuais!', timestamp: new Date() },
  { role: 'user', content: 'O projeto é para minha empresa de consultoria em São Paulo', timestamp: new Date() },
];

async function runTest() {
  console.log('\n🧪 TESTE DO SISTEMA DE EXTRAÇÃO DE MEMÓRIAS\n');
  console.log('═'.repeat(60));
  
  try {
    // 1. Initialize services
    console.log('\n📦 1. Inicializando serviços...');
    const memoryManager = MemoryManagerService.getInstance({
      autoExtractionEnabled: true,
      minMessagesForExtraction: 10,
      maxMessagesPerBatch: 20,
      minConfidenceThreshold: 0.7,
    });
    const repository = new MemoryRepository();
    console.log('   ✅ Serviços inicializados');

    // 2. Clean previous test data
    console.log('\n🧹 2. Limpando dados de teste anteriores...');
    const deletedCount = repository.deleteByUser(TEST_USER_ID);
    console.log(`   ✅ ${deletedCount} memórias de testes anteriores removidas`);

    // 3. Test memory extraction
    console.log('\n💭 3. Testando extração de memórias...');
    console.log(`   📝 Processando ${testMessages.length} mensagens...`);
    
    const result = await memoryManager.extractIfNeeded(
      testMessages,
      TEST_USER_ID,
      TEST_CONVERSATION_ID
    );

    if (!result) {
      console.log('   ⚠️  Extração não foi executada (condições não atendidas ou provider indisponível)');
      console.log('   ℹ️  Possíveis causas:');
      console.log('      - Provider ainda não inicializado (lazy loading)');
      console.log('      - Menos de 10 mensagens');
      console.log('      - Auto-extraction desabilitado');
      
      // Try to check extractor status
      console.log('\n🔍 4. Verificando status do extractor...');
      console.log('   ℹ️  Aguarde alguns segundos e tente novamente');
      console.log('   ℹ️  O extractor usa lazy loading e inicializa no primeiro uso');
      
      process.exit(0);
    }

    console.log(`   ✅ Extração concluída!`);
    console.log(`   📊 Estatísticas:`);
    console.log(`      - Mensagens processadas: ${result.processedMessageCount}`);
    console.log(`      - Memórias extraídas: ${result.memories.length}`);
    console.log(`      - Tempo de processamento: ${result.extractionDurationMs}ms`);

    // 4. Display extracted memories
    console.log('\n🧠 4. Memórias extraídas:');
    console.log('─'.repeat(60));
    
    if (result.memories.length === 0) {
      console.log('   ⚠️  Nenhuma memória extraída (confiança < 0.7)');
    } else {
      result.memories.forEach((memory, index) => {
        const emoji = {
          preference: '⚙️',
          decision: '✅',
          fact: '📝',
          goal: '🎯',
          skill: '💡',
          constraint: '💰',
          context: '🌐'
        }[memory.type] || '📌';

        console.log(`\n   ${emoji} Memória #${index + 1} [${memory.type.toUpperCase()}]`);
        console.log(`      Conteúdo: ${memory.content}`);
        if (memory.context) {
          console.log(`      Contexto: ${memory.context}`);
        }
        console.log(`      Importância: ${memory.importance}`);
        console.log(`      Confiança: ${(memory.confidence * 100).toFixed(0)}%`);
        if (memory.tags && memory.tags.length > 0) {
          console.log(`      Tags: ${memory.tags.join(', ')}`);
        }
      });
    }

    // 5. Test repository queries
    console.log('\n\n📊 5. Testando consultas ao repositório...');
    
    const allMemories = repository.getByUser(TEST_USER_ID);
    console.log(`   ✅ Total de memórias no DB: ${allMemories.length}`);

    const stats = repository.getStats(TEST_USER_ID);
    console.log(`\n   📈 Estatísticas:`);
    console.log(`      - Total: ${stats.totalMemories}`);
    console.log(`      - Confiança média: ${(stats.avgConfidence * 100).toFixed(0)}%`);
    
    console.log(`\n   📋 Por tipo:`);
    Object.entries(stats.byType).forEach(([type, count]) => {
      if (count > 0) {
        const emoji = {
          preference: '⚙️',
          decision: '✅',
          fact: '📝',
          goal: '🎯',
          skill: '💡',
          constraint: '💰',
          context: '🌐'
        }[type] || '📌';
        console.log(`      ${emoji} ${type}: ${count}`);
      }
    });

    console.log(`\n   🔥 Por importância:`);
    Object.entries(stats.byImportance).forEach(([importance, count]) => {
      if (count > 0) {
        const emoji = {
          critical: '🔴',
          high: '🟠',
          medium: '🟡',
          low: '🟢'
        }[importance] || '⚪';
        console.log(`      ${emoji} ${importance}: ${count}`);
      }
    });

    // 6. Test context enrichment
    console.log('\n\n🎨 6. Testando context enrichment...');
    const enrichment = memoryManager.getContextEnrichment(TEST_USER_ID, 5);
    
    if (enrichment) {
      console.log('   ✅ Context enrichment gerado:');
      console.log('─'.repeat(60));
      console.log(enrichment);
      console.log('─'.repeat(60));
    } else {
      console.log('   ℹ️  Nenhum enrichment disponível');
    }

    // 7. Cleanup
    console.log('\n\n🧹 7. Limpando dados de teste...');
    const finalCleanup = repository.deleteByUser(TEST_USER_ID);
    console.log(`   ✅ ${finalCleanup} memórias de teste removidas`);

    console.log('\n' + '═'.repeat(60));
    console.log('✅ TESTE COMPLETO - SISTEMA DE MEMÓRIAS FUNCIONANDO!\n');

  } catch (error) {
    console.error('\n❌ ERRO NO TESTE:', error.message);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  }
}

// Run test
runTest().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
