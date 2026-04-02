# 🎯 Plano de Implementação - Phase 2.3: Cost Tracker

**Data de criação:** 02/04/2026  
**Objetivo:** Completar implementação do Cost Tracker  
**ROI:** 🔥🔥🔥🔥 - Economiza $$$ + Visibilidade total de custos  
**Tempo estimado:** 2-4h (60% já implementado!)

---

## 📊 STATUS ATUAL DO COST TRACKER

### ✅ O que JÁ ESTÁ IMPLEMENTADO (60% COMPLETO)

| Componente | Status | Detalhes | LOC |
|------------|--------|----------|-----|
| **CostTracker Class** | ✅ COMPLETO | Classe principal com DB tracking | ~200 |
| **Pricing Config** | ✅ COMPLETO | Copilot (FREE), OpenAI, DeepSeek | ~150 |
| **Token Estimator** | ✅ COMPLETO | Estimativa de tokens por modelo | ~100 |
| **Schema SQLite** | ✅ CRIADO | Tabela `cost_tracking` + índices | - |
| **Testes Unitários** | ✅ EXISTE | `tests/services/cost-tracker/` | ~150 |
| **Integração Copilot** | ✅ FUNCIONANDO | github-copilot-oauth-provider.ts | - |
| **Export API** | ✅ PRONTO | `src/services/cost-tracker/index.ts` | - |

**Arquivos existentes:**
- ✅ `src/services/cost-tracker/cost-tracker.ts` (200 LOC)
- ✅ `src/services/cost-tracker/pricing.ts` (150 LOC)
- ✅ `src/services/cost-tracker/token-estimator.ts` (100 LOC)
- ✅ `src/services/cost-tracker/index.ts` (25 LOC)
- ✅ `tests/services/cost-tracker/cost-tracker.test.ts` (150 LOC)

### ❌ O que FALTA IMPLEMENTAR (40% RESTANTE)

| Tarefa | Prioridade | Tempo | Impacto |
|--------|-----------|-------|---------|
| **1. Integração DeepSeek** | 🔥🔥🔥 ALTA | 30min | Tracking completo |
| **2. Comando /cost** | 🔥🔥🔥 ALTA | 45min | UX essencial |
| **3. Alertas de gastos** | 🔥🔥 MÉDIA | 30min | Segurança financeira |
| **4. Validar testes** | 🔥 BAIXA | 15min | Garantir qualidade |
| **5. Deploy VPS** | 🔥🔥 MÉDIA | 20min | Produção |

**Total:** ~2h20min de trabalho

---

## 🚀 PLANO DE IMPLEMENTAÇÃO (2-4h)

### TAREFA 1: Integrar com DeepSeek Providers (30min)

**Objetivo:** Trackear custos quando usar DeepSeek API

**Arquivos a modificar:**
- `src/core/providers/deepseek-provider.ts`
- `src/core/providers/deepseek-reasoner-provider.ts`

**Implementação:**

```typescript
// Adicionar no final do método generateResponse() em deepseek-provider.ts

import { costTracker } from '../../services/cost-tracker';

// ... após receber llmResponse

// Track cost (DeepSeek é PAGO se usar API Key)
try {
  if (llmResponse.usage) {
    const userId = (options as any)?.userId || 
                  process.env.TELEGRAM_ALLOWED_USER_IDS?.split(',')[0] || 
                  'system';
    
    await costTracker.trackLLMCall({
      provider: 'deepseek',
      model: this.model, // 'deepseek-chat' ou 'deepseek-reasoner'
      userId,
      operation: 'chat-completion',
      usage: {
        promptTokens: llmResponse.usage.promptTokens,
        completionTokens: llmResponse.usage.completionTokens,
        totalTokens: llmResponse.usage.totalTokens,
        cachedTokens: llmResponse.usage.promptTokensDetails?.cachedTokens,
      },
    });
  }
} catch (trackError) {
  console.warn('[CostTracker] Failed to track DeepSeek:', trackError);
}
```

**Mesma lógica para `deepseek-reasoner-provider.ts`.**

---

### TAREFA 2: Criar Comando /cost (45min)

**Objetivo:** Usuário poder consultar gastos via Telegram

**Arquivo a criar:**
- `src/handlers/cost-handler.ts`

**Implementação:**

```typescript
/**
 * Cost Handler - Comando /cost
 * 
 * Exibe custos de LLM por período
 */

import { Message } from '@telegraf/types';
import { costTracker } from '../services/cost-tracker';
import { formatCost } from '../services/cost-tracker/pricing';

export interface CostHandlerOptions {
  period?: 'today' | 'week' | 'month';
}

/**
 * Handler do comando /cost
 */
export async function handleCostCommand(
  message: Message.TextMessage,
  userId: string,
): Promise<string> {
  const text = message.text.toLowerCase().trim();

  // Parse período: /cost today | /cost week | /cost month
  let period: 'today' | 'week' | 'month' = 'today';
  
  if (text.includes('week') || text.includes('semana')) {
    period = 'week';
  } else if (text.includes('month') || text.includes('mês') || text.includes('mes')) {
    period = 'month';
  }

  // Buscar summary por período
  let summary;
  let periodLabel;

  switch (period) {
    case 'today':
      summary = costTracker.getTodayCosts(userId);
      periodLabel = 'Hoje';
      break;
    case 'week':
      summary = costTracker.getWeekCosts(userId);
      periodLabel = 'Últimos 7 dias';
      break;
    case 'month':
      summary = costTracker.getMonthCosts(userId);
      periodLabel = 'Este mês';
      break;
  }

  // Formatar output
  return costTracker.formatSummaryForTelegram(summary, periodLabel);
}
```

**Registrar handler:**

```typescript
// Em src/handlers/telegram-handler.ts ou onde processa comandos

import { handleCostCommand } from './cost-handler';

// Adicionar após outros comandos:
if (message.text.startsWith('/cost')) {
  const userId = message.from.id.toString();
  const response = await handleCostCommand(message, userId);
  return bot.telegram.sendMessage(
    message.chat.id, 
    response, 
    { parse_mode: 'Markdown' }
  );
}
```

**Casos de uso:**
```
/cost               → Custo de hoje
/cost today         → Custo de hoje
/cost week          → Últimos 7 dias
/cost semana        → Últimos 7 dias
/cost month         → Este mês
/cost mês           → Este mês
```

---

### TAREFA 3: Implementar Alertas de Gastos (30min)

**Objetivo:** Avisar se custo diário > $5 (threshold configurável)

**Arquivo a criar:**
- `src/services/cost-tracker/cost-alerts.ts`

**Implementação:**

```typescript
/**
 * Cost Alerts - Alertas de gastos excessivos
 * 
 * Monitora custos e envia notificação Telegram se ultrapassar threshold
 */

import { costTracker } from './cost-tracker';
import { TelegramNotifier } from '../telegram-notifier';
import { formatCost } from './pricing';

export interface CostAlertConfig {
  dailyThresholdUSD: number; // Default: 5.0
  weeklyThresholdUSD: number; // Default: 30.0
  monthlyThresholdUSD: number; // Default: 100.0
  enableAlerts: boolean; // Default: true
}

export class CostAlerts {
  private config: CostAlertConfig;
  private lastDailyCheck: Date | null = null;

  constructor(config: Partial<CostAlertConfig> = {}) {
    this.config = {
      dailyThresholdUSD: config.dailyThresholdUSD || 5.0,
      weeklyThresholdUSD: config.weeklyThresholdUSD || 30.0,
      monthlyThresholdUSD: config.monthlyThresholdUSD || 100.0,
      enableAlerts: config.enableAlerts ?? true,
    };
  }

  /**
   * Verifica se houve excesso de gastos hoje
   */
  public async checkDailyThreshold(userId: string): Promise<void> {
    if (!this.config.enableAlerts) return;

    const now = new Date();
    
    // Verifica apenas 1x por dia
    if (this.lastDailyCheck && 
        this.lastDailyCheck.toDateString() === now.toDateString()) {
      return;
    }

    const summary = costTracker.getTodayCosts(userId);

    if (summary.totalCostUSD > this.config.dailyThresholdUSD) {
      await this.sendAlert(
        userId,
        'daily',
        summary.totalCostUSD,
        this.config.dailyThresholdUSD,
      );
    }

    this.lastDailyCheck = now;
  }

  /**
   * Envia alerta via Telegram
   */
  private async sendAlert(
    userId: string,
    period: 'daily' | 'weekly' | 'monthly',
    currentCost: number,
    threshold: number,
  ): Promise<void> {
    const notifier = TelegramNotifier.getInstance();

    const periodLabels = {
      daily: 'hoje',
      weekly: 'esta semana',
      monthly: 'este mês',
    };

    const message = 
      `⚠️ *ALERTA DE CUSTO LLM*\n\n` +
      `Gastos ${periodLabels[period]} ultrapassaram o limite!\n\n` +
      `💰 *Atual:* ${formatCost(currentCost)}\n` +
      `🚨 *Limite:* ${formatCost(threshold)}\n` +
      `📊 *Excesso:* ${formatCost(currentCost - threshold)}\n\n` +
      `Use \`/cost\` para detalhes.`;

    await notifier.sendMessageToUser(userId, message, { parse_mode: 'Markdown' });

    console.warn(
      `[CostAlerts] Threshold exceeded for user ${userId}: ` +
      `${formatCost(currentCost)} > ${formatCost(threshold)}`
    );
  }
}

// Singleton
export const costAlerts = new CostAlerts({
  dailyThresholdUSD: parseFloat(process.env.COST_ALERT_DAILY_USD || '5.0'),
  weeklyThresholdUSD: parseFloat(process.env.COST_ALERT_WEEKLY_USD || '30.0'),
  monthlyThresholdUSD: parseFloat(process.env.COST_ALERT_MONTHLY_USD || '100.0'),
  enableAlerts: process.env.COST_ALERTS_ENABLED !== 'false',
});
```

**Integrar com AgentController:**

```typescript
// Em src/core/agent-controller.ts, após cada LLM call:

import { costAlerts } from '../services/cost-tracker/cost-alerts';

// ... após costTracker.trackLLMCall()
await costAlerts.checkDailyThreshold(userId);
```

**Variáveis de ambiente (`\\.env`):**

```env
# Cost Alerts Configuration
COST_ALERT_DAILY_USD=5.0
COST_ALERT_WEEKLY_USD=30.0
COST_ALERT_MONTHLY_USD=100.0
COST_ALERTS_ENABLED=true
```

---

### TAREFA 4: Validar Testes (15min)

**Objetivo:** Garantir que testes passam 100%

```bash
# Executar testes do Cost Tracker
npm test -- cost-tracker

# Executar todos os testes
npm test

# Se houver falhas, corrigir antes de mergear
```

**Checklist de testes:**
- [ ] CostTracker.trackLLMCall() registra corretamente
- [ ] Pricing config retorna valores corretos
- [ ] Token estimator calcula tokens
- [ ] Summary aggregation funciona
- [ ] Free providers (Copilot) registram $0
- [ ] Paid providers (DeepSeek) calculam custo
- [ ] Comando /cost retorna formato correto

---

### TAREFA 5: Deploy em Produção (20min)

**Objetivo:** Subir para VPS e validar em produção

**Script de deploy:**

```bash
# 1. Commit local
git add .
git commit -m "feat(cost-tracker): complete Phase 2.3 - DeepSeek integration + /cost command + alerts"

# 2. Push para GitHub
git push origin feature/grep-glob-tools

# 3. Deploy via script existente
python scripts/deploy-vps.py \
  --branch feature/grep-glob-tools \
  --message "Phase 2.3: Cost Tracker completo"

# 4. Validar VPS
ssh jr@159.223.165.243
cd /opt/gueclaw-agent
pm2 logs gueclaw --lines 50

# 5. Testar comando /cost via Telegram
# (Enviar mensagem no Telegram: /cost)
```

**Validação pós-deploy:**
- [ ] VPS online (PID ativo)
- [ ] Comando `/cost` funciona
- [ ] Cost tracking registra chamadas
- [ ] Alertas funcionam (teste com threshold baixo)
- [ ] Logs sem erros críticos

---

## 🎯 CHECKLIST DE CONCLUSÃO - FASE 2.3

Quando TUDO estiver COMPLETO, marcar:

- [ ] ✅ DeepSeek providers integrados com Cost Tracker
- [ ] ✅ Comando `/cost` funcionando no Telegram
- [ ] ✅ Alertas de gastos implementados e testados
- [ ] ✅ Testes unitários passando 100%
- [ ] ✅ Deploy em produção validado
- [ ] ✅ Documentação atualizada
- [ ] ✅ Commit com tag `v3.0-beta` (após validação)

**Após conclusão:**
- Atualizar [CLAUDE-CODE-INTEGRATION-CHECKLIST.md](../tmp/CLAUDE-CODE-INTEGRATION-CHECKLIST.md)
- Marcar Fase 2.3 como ✅ COMPLETA
- Criar tag Git: `git tag v3.0-beta -m "Phase 2.3: Cost Tracker completo"`
- Próxima fase: **2.4 buildTool()** OU **1.2 Skills de Receita**

---

## 📊 MÉTRICAS DE SUCESSO

### Antes da Fase 2.3:
- ❌ Visibilidade de custos: 0%
- ❌ Alertas de gastos: Não existem
- ❌ Comando /cost: Não existe
- ⚠️ Tracking: Apenas Copilot (50%)

### Depois da Fase 2.3:
- ✅ Visibilidade de custos: 100%
- ✅ Alertas de gastos: Automáticos
- ✅ Comando /cost: Funcional (today/week/month)
- ✅ Tracking: Copilot + DeepSeek (100%)

### ROI Esperado:
- **Economia mensal:** ~$10-20 (evita surpresas com APIs)
- **Tempo economizado:** ~30min/semana (não precisa calcular manualmente)
- **Controle financeiro:** Visibilidade total

---

## 🚨 RISCOS & MITIGAÇÕES

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Tracking falhar silenciosamente | 🟡 Média | 🔥 Alto | Try/catch + logs de warning |
| Alertas spammy | 🟡 Média | 🟢 Baixo | Verificar apenas 1x/dia |
| Custo do tracking (DB overhead) | 🟢 Baixa | 🟢 Baixo | SQLite é rápido, overhead < 1ms |
| Deploy quebrar prod | 🟢 Baixa | 🔥🔥 Alto | Testar local + validação VPS |

---

## 📚 REFERÊNCIAS

**Arquivos principais:**
- `src/services/cost-tracker/cost-tracker.ts`
- `src/services/cost-tracker/pricing.ts`
- `src/services/cost-tracker/token-estimator.ts`
- `src/core/providers/github-copilot-oauth-provider.ts` (exemplo de integração)

**APIs de referência:**
- OpenAI Pricing: https://openai.com/api/pricing/
- DeepSeek Pricing: https://platform.deepseek.com/api-docs/pricing/
- Claude Pricing: https://www.anthropic.com/pricing

**Documentação:**
- [CLAUDE-CODE-INTEGRATION-CHECKLIST.md](../tmp/CLAUDE-CODE-INTEGRATION-CHECKLIST.md)
- [DOE/PROXIMO-PASSO.md](./PROXIMO-PASSO.md)

---

**Criado em:** 02/04/2026  
**Última atualização:** 02/04/2026  
**Status:** 🚀 PRONTO PARA EXECUÇÃO  
**Tempo estimado:** 2-4h  
**ROI:** 🔥🔥🔥🔥 (Controle total de custos + economia $$$)

**Próxima ação:** Iniciar Tarefa 1 (Integração DeepSeek)
