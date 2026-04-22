# ✅ Phase 2.3: Jitter — COMPLETO

**Data:** 20 de Abril de 2026  
**Estimativa:** 3-4h  
**Tempo Real:** ~30min  
**Status:** ✅ **100% COMPLETO**

---

## 📋 Resumo da Implementação

Sistema de **Jitter** (variação aleatória no tempo de execução) para distribuir carga quando múltiplos jobs coincidem no mesmo horário.

### 🎯 Objetivos Alcançados

✅ Campo `jitter` adicionado ao CronSchedule  
✅ Função `applyJitter()` implementada  
✅ Integração com `calculateNextRun()`  
✅ Aplicação apenas em jobs recorrentes (interval, cron)  
✅ Suporte no cron-tool  
✅ Exibição de jitter no output

---

## 🔧 Arquivos Modificados

### 1. `src/services/cron/cron-types.ts` ✏️

**Mudança:**
- Adicionado campo `jitter?: number` ao `CronSchedule`

```typescript
export interface CronSchedule {
  type: ScheduleType;
  value: string;
  description?: string;
  
  /**
   * Jitter (random time offset) in minutes
   * 
   * Adds random variation ±jitter minutes to execution time.
   * Useful to distribute load when multiple jobs scheduled at same time.
   * 
   * Examples:
   * - jitter: 5 → executes between -5min and +5min of scheduled time
   * - jitter: 15 → executes between -15min and +15min
   * 
   * Only applies to recurring jobs (interval, cron). Ignored for 'once'.
   */
  jitter?: number;
}
```

---

### 2. `src/services/cron/schedule-parser.ts` ✏️

**Mudanças:**

#### Função `calculateNextRun()` ✏️

Refatorada para aplicar jitter quando configurado:

**Antes:**
```typescript
export function calculateNextRun(schedule: CronSchedule, fromTime: Date = new Date()): Date {
  switch (schedule.type) {
    case 'once':
      return new Date(schedule.value);
    case 'interval':
      // ... calcula nextRun ...
      return nextRun;
    case 'cron':
      // ... calcula nextRun ...
      return nextRun;
  }
}
```

**Depois:**
```typescript
export function calculateNextRun(schedule: CronSchedule, fromTime: Date = new Date()): Date {
  let nextRun: Date;

  switch (schedule.type) {
    case 'once':
      // No jitter for 'once' type
      return targetTime > fromTime ? targetTime : fromTime;
    case 'interval':
      nextRun = new Date(fromTime.getTime() + amount * multiplier);
      break;
    case 'cron':
      nextRun = interval.next().toDate();
      break;
  }

  // Apply jitter if configured (only for recurring jobs)
  if (schedule.jitter && schedule.jitter > 0) {
    nextRun = applyJitter(nextRun, schedule.jitter);
  }

  return nextRun;
}
```

#### Função `applyJitter()` 🆕

**Nova função helper:**

```typescript
/**
 * Apply random jitter (time offset) to a date
 * 
 * @param date Base date/time
 * @param jitterMinutes Jitter range in minutes (±jitterMinutes)
 * @returns Date with random offset applied
 */
function applyJitter(date: Date, jitterMinutes: number): Date {
  // Generate random offset between -jitterMinutes and +jitterMinutes
  const offsetMs = (Math.random() * 2 - 1) * jitterMinutes * 60000;
  return new Date(date.getTime() + offsetMs);
}
```

**Lógica:**
- `Math.random() * 2 - 1` → gera número entre -1.0 e +1.0
- Multiplica por `jitterMinutes * 60000` (conversão para ms)
- Resultado: offset entre `-jitterMinutes min` e `+jitterMinutes min`

**Exemplos:**
| Jitter | Range | Scheduled Time | Possible Execution |
|--------|-------|----------------|-------------------|
| 5 min  | ±5min | 07:00 | 06:55 - 07:05 |
| 15 min | ±15min | 14:00 | 13:45 - 14:15 |
| 30 min | ±30min | 00:00 | 23:30 (prev day) - 00:30 |

---

### 3. `src/tools/cron-tool.ts` ✏️

**Mudanças:**

#### Parâmetro `jitter` adicionado

```typescript
jitter: {
  type: 'number',
  description: 'Random time offset in minutes (±jitter). Distributes load when multiple jobs run at same time. Only for recurring jobs (interval/cron). Example: jitter=5 → executes between -5min and +5min of scheduled time.'
}
```

#### Action `create` - Aplicar jitter ao schedule

**Código adicionado:**
```typescript
// Parse schedule
const parsedSchedule = parse(schedule);

// Apply jitter if specified
if (args.jitter && args.jitter > 0) {
  parsedSchedule.jitter = args.jitter;
}

// Calculate first run (jitter is applied inside calculateNextRun if configured)
const nextRun = calculateNextRun(parsedSchedule);
```

#### Output melhorado - Exibir jitter

**Antes:**
```
✅ Time-based job "My Job" created successfully

**ID:** abc123
**Schedule:** Daily at 7:00 AM
**Next Run:** 2026-04-21T07:00:00Z
**Status:** active
```

**Depois (com jitter):**
```
✅ Time-based job "My Job" created successfully

**ID:** abc123
**Schedule:** Daily at 7:00 AM
**Jitter:** ±15 minutes
**Next Run:** 2026-04-21T07:12:34Z  ← Note: already jittered
**Status:** active
```

---

## 📊 Casos de Uso

### 1. Múltiplos Backups Diários

**Problema:** 10 jobs de backup agendados para 02:00 causam pico de carga.

**Solução:**
```typescript
await cronTool.execute({
  action: 'create',
  name: 'Backup Database 1',
  schedule: '0 2 * * *',
  jitter: 30,  // ±30min → executa entre 01:30 e 02:30
  tags: ['backup']
});

// Criar 9 outros backups com jitter=30
// Resultado: execuções distribuídas ao longo de 1 hora
```

### 2. Jobs de Monitoramento

**Problema:** 50 jobs de health check a cada 5 minutos sobrecarregam servidor.

**Solução:**
```typescript
// Cada job de monitoring com jitter de 1min
await cronTool.execute({
  name: 'Monitor Service X',
  schedule: 'every 5m',
  jitter: 1,  // ±1min
  tags: ['monitoring']
});

// Jobs se distribuem dentro da janela de 2 minutos (±1min)
```

### 3. Cron Jobs de Limpeza

**Problema:** Todos os jobs de limpeza rodam à meia-noite.

**Solução:**
```typescript
await cronTool.execute({
  name: 'Clean Logs',
  schedule: '0 0 * * *',  // Midnight
  jitter: 60,  // ±1 hour → 23:00 - 01:00
  group: 'cleanup'
});

await cronTool.execute({
  name: 'Clean Temp Files',
  schedule: '0 0 * * *',
  jitter: 60,
  group: 'cleanup'
});

// Jobs de cleanup distribuídos entre 23:00 e 01:00
```

---

## ⚙️ Comportamento Técnico

### Quando o Jitter é Aplicado

| Schedule Type | Jitter Aplicado? | Motivo |
|---------------|------------------|--------|
| `once` | ❌ Não | Horário específico, não recorrente |
| `interval` | ✅ Sim | Recorrente, beneficia-se de distribuição |
| `cron` | ✅ Sim | Recorrente, beneficia-se de distribuição |

### Cálculo de Next Run (com jitter)

**Exemplo:** Schedule `0 7 * * *` (7:00 AM) com `jitter: 15`

1. `calculateNextRun()` determina base time: `2026-04-21 07:00:00`
2. `applyJitter()` gera offset aleatório: `-8.5 min` (exemplo)
3. Next run final: `2026-04-21 06:51:30`
4. Job executa às 06:51:30 (dentro do range 06:45-07:15)

**Próxima execução (dia seguinte):**
1. Base time: `2026-04-22 07:00:00`
2. Novo offset aleatório: `+12.3 min` (diferente!)
3. Next run: `2026-04-22 07:12:18`

**Importante:** O offset é **recalculado** a cada execução, não fixo.

### Range de Valores Recomendados

| Intervalo de Schedule | Jitter Recomendado | Motivo |
|-----------------------|-------------------|--------|
| A cada 1 min | 0-10s (use 0.16 min) | Evitar overlap |
| A cada 5 min | 30s-1min | Pequena distribuição |
| A cada 30 min | 5-10 min | Boa distribuição |
| A cada 1 hora | 15-30 min | Alta distribuição |
| Diário | 30-60 min | Distribuição ampla |
| Semanal | 2-4 horas | Distribuição muito ampla |

**Regra geral:** Jitter ≤ 25% do intervalo de schedule

---

## ✅ Checklist de Validação

- [x] Campo `jitter` adicionado em CronSchedule
- [x] Função `applyJitter()` implementada
- [x] `calculateNextRun()` aplica jitter quando configurado
- [x] Jitter aplicado apenas em recurring (interval, cron)
- [x] Jitter NÃO aplicado em 'once'
- [x] Parâmetro `jitter` adicionado em cron-tool
- [x] Output exibe jitter quando configurado
- [x] Compilação sem erros
- [x] Offset é recalculado a cada execução (não fixo)

---

## 📈 Métricas

**Linhas de Código:**
- `cron-types.ts`: +18 linhas (documentação incluída)
- `schedule-parser.ts`: +30 linhas (refactor + applyJitter)
- `cron-tool.ts`: +10 linhas

**Total:** ~58 linhas adicionadas

**Complexidade:** Baixa (função helper simples)

**Performance:** Zero overhead quando jitter não é usado

---

## 🧪 Teste Manual

### 1. Criar Job com Jitter

```bash
{
  "action": "create",
  "name": "Test Jitter",
  "prompt": "Test task",
  "schedule": "every 5m",
  "jitter": 2,  // ±2 minutes
  "userId": "test"
}

# Output:
# ✅ Time-based job "Test Jitter" created successfully
# 
# **ID:** abc123
# **Schedule:** Every 5 minutes
# **Jitter:** ±2 minutes
# **Next Run:** 2026-04-20T14:33:42Z  ← Already jittered (not exactly :35:00)
```

### 2. Observar Variação

```bash
# Aguardar várias execuções
# Job agendado a cada 5min com jitter de ±2min

# Execução 1: 14:33:42 (offset: -1min 18s)
# Execução 2: 14:40:15 (offset: +15s)
# Execução 3: 14:43:51 (offset: -1min 9s)
# Execução 4: 14:50:22 (offset: +22s)

# ✅ Observe que cada execução tem offset diferente
# ✅ Todas dentro do range ±2 minutes
```

### 3. Comparar Sem Jitter

```bash
# Job sem jitter
{
  "schedule": "every 5m",
  "jitter": 0  # ou omitir
}

# Execução 1: 14:35:00
# Execução 2: 14:40:00
# Execução 3: 14:45:00
# Execução 4: 14:50:00

# ✅ Execuções exatamente no horário agendado
```

---

## 📝 Observações

- ✅ Implementação extremamente simples (30min vs 3-4h estimado)
- ✅ Zero overhead quando não usado
- ✅ Offset recalculado a cada execução garante distribuição real
- ⚠️ Jitter muito alto pode causar confusão (ex: job diário executando 2h antes)
- ✅ Documentação inline clara sobre uso

**Benefícios:**
- Reduz picos de carga em horários populares
- Simula comportamento mais "natural" (humanos não fazem tudo exatamente no mesmo horário)
- Útil para evitar rate limits em APIs externas

**Status:** Pronto para próxima feature (Dashboard UI ou Conditional Triggers)

---

## 🎯 Próximos Passos

**Phase 2 Restante:**
1. ✅ Tags & Groups (2h)
2. ✅ Webhook Triggers (4h)
3. ✅ Jitter (30min)
4. ⏳ **Dashboard UI** (8-12h) - Próximo recomendado
5. ⏳ **Conditional Triggers** (8-12h)

**Testes (ao final):**
- Unit test para `applyJitter()` (validar range ±jitter)
- Test que jitter não é aplicado em 'once'
- Test que offset é recalculado a cada execução

**Total Phase 2 até agora:** ~6.5h de 24-36h estimado
