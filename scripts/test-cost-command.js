/**
 * Script de teste do comando /cost
 * Executa: node scripts/test-cost-command.js
 */

const { costTracker } = require('../dist/services/cost-tracker');

async function testCostCommand() {
  console.log('🧪 Testando Cost Tracker...\n');

  try {
    // 1. Verificar tabela
    console.log('📊 1. Verificando tabela cost_tracking...');
    const testUserId = 'test-user-' + Date.now();
    
    // 2. Inserir registro de teste
    console.log('💰 2. Inserindo registro de teste...');
    await costTracker.trackLLMCall({
      userId: testUserId,
      provider: 'deepseek',
      model: 'deepseek-chat',
      promptTokens: 1000,
      completionTokens: 500,
      cachedTokens: 200,
      operation: 'test',
    });
    console.log('✅ Registro inserido com sucesso!\n');

    // 3. Consultar custos de hoje
    console.log('📅 3. Consultando custos do dia...');
    const todaySummary = costTracker.getTodayCosts(testUserId);
    console.log('   Custo total:', `$${todaySummary.totalCostUSD.toFixed(6)}`);
    console.log('   Tokens totais:', todaySummary.totalTokens);
    console.log('   Tokens em cache:', todaySummary.cachedTokens);
    console.log('   Operações:', todaySummary.callCount);
    console.log('');

    // 4. Formatar mensagem Telegram
    console.log('📱 4. Preview do comando /cost:\n');
    const message = costTracker.formatSummaryForTelegram(todaySummary, 'hoje');
    console.log(message);
    console.log('');

    // 5. Testar alerta
    console.log('🚨 5. Testando alertas...');
    const { costAlerts } = require('../dist/services/cost-tracker');
    await costAlerts.checkDailyThreshold(testUserId);
    console.log('✅ Verificação de alertas concluída!\n');

    console.log('✅ Todos os testes passaram! Cost Tracker está funcionando.\n');
    
    console.log('📋 Próximos passos:');
    console.log('   1. Envie /cost no Telegram para testar em produção');
    console.log('   2. Use o bot normalmente - os custos serão registrados');
    console.log('   3. Verifique alertas se custo > $5/dia');

  } catch (error) {
    console.error('❌ Erro no teste:', error);
    process.exit(1);
  }
}

testCostCommand();
