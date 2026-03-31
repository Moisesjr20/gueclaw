import { BaseTool } from './base-tool';
import { ToolDefinition } from '../core/providers/base-provider';
import { ToolResult } from '../types';
import { FinancialRepository, CreateFinancialTransactionInput } from '../core/memory/financial-repository';

/**
 * Tool para operações financeiras (Controle de Finanças Pessoais)
 * Usa criptografia AES-256-GCM para proteger dados sensíveis
 */
export class FinancialTool extends BaseTool {
  public readonly name = 'financial_operation';
  public readonly description = `Gerencia finanças pessoais com criptografia de dados sensíveis.

⚠️ IMPORTANTE: Para CSV com 2+ linhas, SEMPRE use 'import_csv' (1 chamada) ao invés de loop com 'create'.

Operações disponíveis:
- "create": Criar transação (entrada/saída)
- "import_csv": Importar múltiplas transações de um CSV
- "export_csv": Exportar transações para formato CSV
- "list": Listar transações com filtros
- "balance": Consultar saldo e resumo
- "report_by_cost_center": Relatório de gastos por categoria
- "update_status": Atualizar status (realizado/não_realizado)
- "update": Atualizar transação completa
- "delete": Deletar transação

Exemplos de uso:
{
  "action": "create",
  "userId": "123456789",
  "transactionDate": "2026-03-31",
  "amount": 5000,
  "description": "Salário março",
  "costCenter": "Renda",
  "transactionType": "entrada",
  "movementType": "unico",
  "status": "realizado"
}

{
  "action": "import_csv",
  "userId": "123456789",
  "csvData": "[{\"data\":\"2026-03-31\",\"valor\":\"5000\",\"descricao\":\"Salário\",\"categoria\":\"Renda\",\"tipo\":\"entrada\"}]"
}

{
  "action": "export_csv",
  "userId": "123456789",
  "startDate": "2026-03-01",
  "endDate": "2026-03-31"
}

{
  "action": "balance",
  "userId": "123456789",
  "startDate": "2026-03-01",
  "endDate": "2026-03-31"
}

{
  "action": "list",
  "userId": "123456789",
  "transactionType": "saida",
  "status": "realizado",
  "limit": 10
}`;

  public getDefinition(): ToolDefinition {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['create', 'import_csv', 'export_csv', 'list', 'balance', 'report_by_cost_center', 'update_status', 'update', 'delete'],
            description: 'Operação a realizar',
          },
          userId: {
            type: 'string',
            description: 'ID do usuário (Telegram user ID)',
          },
          csvData: {
            type: 'string',
            description: 'Dados CSV parseados (JSON array de objetos) para importação em lote',
          },
          transactionId: {
            type: 'string',
            description: 'ID da transação (para update_status, update, delete)',
          },
          // Campos para create
          transactionDate: {
            type: 'string',
            description: 'Data da transação (formato: YYYY-MM-DD)',
          },
          amount: {
            type: 'number',
            description: 'Valor da transação',
          },
          description: {
            type: 'string',
            description: 'Descrição da transação',
          },
          costCenter: {
            type: 'string',
            description: 'Centro de custo / Categoria',
          },
          transactionType: {
            type: 'string',
            enum: ['entrada', 'saida'],
            description: 'Tipo: entrada (receita) ou saida (despesa)',
          },
          movementType: {
            type: 'string',
            enum: ['parcela', 'unico', 'mensal'],
            description: 'Tipo de movimento: parcela, unico, ou mensal',
          },
          installmentInfo: {
            type: 'string',
            description: 'Info da parcela (formato: "1/12" = parcela 1 de 12)',
          },
          status: {
            type: 'string',
            enum: ['realizado', 'nao_realizado'],
            description: 'Status do pagamento',
          },
          // Filtros para list/balance/report
          startDate: {
            type: 'string',
            description: 'Data inicial (YYYY-MM-DD)',
          },
          endDate: {
            type: 'string',
            description: 'Data final (YYYY-MM-DD)',
          },
          limit: {
            type: 'number',
            description: 'Limite de resultados (padrão: 50)',
          },
          newStatus: {
            type: 'string',
            enum: ['realizado', 'nao_realizado'],
            description: 'Novo status (para update_status)',
          },
        },
        required: ['action', 'userId'],
      },
    };
  }

  public async execute(args: Record<string, any>): Promise<ToolResult> {
    try {
      const repo = new FinancialRepository();
      const { 
        action, 
        userId, 
        transactionId, 
        transactionDate,
        amount,
        description,
        costCenter,
        transactionType,
        movementType,
        installmentInfo,
        status,
        startDate, 
        endDate, 
        limit, 
        newStatus 
      } = args;

      switch (action) {
        case 'create': {
          if (!transactionDate || !amount || !description || !costCenter || !transactionType || !movementType) {
            return this.error('Erro: campos obrigatórios para criar transação: transactionDate, amount, description, costCenter, transactionType, movementType');
          }

          const input: CreateFinancialTransactionInput = {
            userId,
            transactionDate: new Date(transactionDate),
            amount,
            description,
            costCenter,
            transactionType,
            movementType,
            installmentInfo,
            status: status || 'nao_realizado',
          };

          const transaction = repo.create(input);

          const emoji = transaction.transactionType === 'entrada' ? '📈' : '📉';
          const installmentStr = transaction.installmentInfo
            ? ` (${transaction.installmentInfo})`
            : '';

          return this.success(`✅ Transação registrada com sucesso!

${emoji} ${transaction.transactionType.toUpperCase()}
💰 Valor: R$ ${transaction.amount.toFixed(2)}
📝 Descrição: ${transaction.description}
📂 Centro de Custo: ${transaction.costCenter}
📅 Data: ${transaction.transactionDate.toLocaleDateString('pt-BR')}
🔄 Tipo: ${transaction.movementType}${installmentStr}
✓ Status: ${transaction.status}

ID: ${transaction.id}`);
        }

        case 'import_csv': {
          const { csvData } = args;
          
          if (!csvData) {
            return this.error('Erro: csvData é obrigatório para importação');
          }

          let rows: any[];
          try {
            rows = typeof csvData === 'string' ? JSON.parse(csvData) : csvData;
          } catch (e) {
            return this.error('Erro: csvData inválido - deve ser um JSON array');
          }

          if (!Array.isArray(rows) || rows.length === 0) {
            return this.error('Erro: CSV vazio ou formato inválido');
          }

          // Normalizar strings: remove acentos, lowercase, underscores
          const normalize = (str: string): string => {
            return str
              .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove acentos
              .toLowerCase()
              .replace(/\s+/g, '_'); // Espaços -> underscores
          };

          // Mapear colunas (pt-BR e en, case-insensitive)
          const mapColumn = (row: any, ...names: string[]): any => {
            for (const name of names) {
              const normalized = normalize(name);
              const key = Object.keys(row).find(k => normalize(k) === normalized);
              if (key && row[key]) return row[key];
            }
            return undefined;
          };

          const results = {
            success: 0,
            failed: 0,
            errors: [] as string[],
          };

          for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const lineNum = i + 2; // +2 porque CSV tem header (linha 1) e começa em 1

            try {
              // Extrair campos
              const dateStr = mapColumn(row, 'data', 'date', 'Data', 'Date');
              const amountStr = mapColumn(row, 'valor', 'amount', 'Valor', 'Amount');
              const description = mapColumn(row, 'descricao', 'description', 'Descrição', 'Description');
              const costCenter = mapColumn(row, 'categoria', 'cost_center', 'costCenter', 'Categoria', 'Centro de Custo', 'centro de custo');
              
              // Normalizar valores de texto
              const tipoRaw = mapColumn(row, 'tipo', 'type', 'Tipo', 'Type');
              const transactionType = tipoRaw ? normalize(tipoRaw) : undefined;
              
              const movimentoRaw = mapColumn(row, 'movimento', 'movement', 'Movimento', 'Movement', 'tipo de movimentação', 'tipo_de_movimentacao');
              let movementType = movimentoRaw ? normalize(movimentoRaw) : 'unico';
              
              // Se tipo de movimentação tem formato de parcela (ex: 6/10), extrair para installmentInfo
              let installmentInfo = mapColumn(row, 'parcela', 'installment', 'Parcela', 'Installment');
              if (movementType.includes('/') && !installmentInfo) {
                installmentInfo = movementType;
                movementType = 'parcela';
              }
              
              const statusRaw = mapColumn(row, 'status', 'Status');
              const status = statusRaw ? normalize(statusRaw) : 'realizado';

              // Validar campos obrigatórios
              if (!dateStr) {
                results.errors.push(`Linha ${lineNum}: campo 'data' obrigatório`);
                results.failed++;
                continue;
              }
              if (!amountStr) {
                results.errors.push(`Linha ${lineNum}: campo 'valor' obrigatório`);
                results.failed++;
                continue;
              }
              if (!description) {
                results.errors.push(`Linha ${lineNum}: campo 'descricao' obrigatório`);
                results.failed++;
                continue;
              }
              if (!costCenter) {
                results.errors.push(`Linha ${lineNum}: campo 'categoria' obrigatório`);
                results.failed++;
                continue;
              }
              if (!transactionType || !['entrada', 'saida'].includes(transactionType)) {
                results.errors.push(`Linha ${lineNum}: 'tipo' deve ser 'entrada' ou 'saida'`);
                results.failed++;
                continue;
              }

              // Parsear valor (aceita vírgula e ponto)
              const amount = parseFloat(amountStr.toString().replace(',', '.'));
              if (isNaN(amount) || amount <= 0) {
                results.errors.push(`Linha ${lineNum}: valor '${amountStr}' inválido`);
                results.failed++;
                continue;
              }

              // Parsear data (aceita DD/MM/YYYY e YYYY-MM-DD)
              let transactionDate: Date;
              if (dateStr.includes('/')) {
                const parts = dateStr.split('/');
                if (parts.length === 3) {
                  // DD/MM/YYYY
                  const [day, month, year] = parts;
                  transactionDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                } else {
                  throw new Error('Formato de data inválido');
                }
              } else {
                transactionDate = new Date(dateStr);
              }

              if (isNaN(transactionDate.getTime())) {
                results.errors.push(`Linha ${lineNum}: data '${dateStr}' inválida`);
                results.failed++;
                continue;
              }

              // Criar transação
              const input: CreateFinancialTransactionInput = {
                userId,
                transactionDate,
                amount,
                description: description.toString(),
                costCenter: costCenter.toString(),
                transactionType: transactionType as 'entrada' | 'saida',
                movementType: movementType as 'unico' | 'parcela' | 'mensal',
                installmentInfo: installmentInfo?.toString(),
                status: status === 'nao_realizado' ? 'nao_realizado' : 'realizado',
              };

              repo.create(input);
              results.success++;

            } catch (error: any) {
              results.errors.push(`Linha ${lineNum}: ${error.message}`);
              results.failed++;
            }
          }

          // Montar resposta
          let output = `📊 Importação CSV Concluída\n\n`;
          output += `✅ Sucesso: ${results.success} transações\n`;
          
          if (results.failed > 0) {
            output += `❌ Falhas: ${results.failed} linhas\n\n`;
            output += `Erros encontrados:\n`;
            results.errors.slice(0, 10).forEach(err => {
              output += `• ${err}\n`;
            });
            if (results.errors.length > 10) {
              output += `\n... e mais ${results.errors.length - 10} erros.`;
            }
          }

          if (results.success > 0) {
            const balance = repo.getBalance(userId);
            output += `\n━━━━━━━━━━━━━━━━━━━━━━━\n`;
            output += `📈 Total entradas: R$ ${balance.entradas.toFixed(2)}\n`;
            output += `📉 Total saídas: R$ ${balance.saidas.toFixed(2)}\n`;
            output += `💵 Saldo: R$ ${balance.saldo.toFixed(2)}`;
          }

          return this.success(output);
        }

        case 'list': {
          const filters: any = { userId };
          if (startDate) filters.startDate = startDate;
          if (endDate) filters.endDate = endDate;
          if (transactionType) filters.transactionType = transactionType;
          if (movementType) filters.movementType = movementType;
          if (costCenter) filters.costCenter = costCenter;
          if (status) filters.status = status;

          const transactions = repo.findMany(filters, limit || 50);

          if (transactions.length === 0) {
            return this.success('📋 Nenhuma transação encontrada com os filtros especificados.');
          }

          let output = `📋 Lista de Transações (${transactions.length})\n\n`;

          transactions.forEach((t, idx) => {
            const emoji = t.transactionType === 'entrada' ? '📈' : '📉';
            const statusEmoji = t.status === 'realizado' ? '✅' : '⏳';
            const installmentStr = t.installmentInfo ? ` ${t.installmentInfo}` : '';

            output += `${idx + 1}. ${statusEmoji} ${emoji} ${t.description}\n`;
            output += `   R$ ${t.amount.toFixed(2)} | ${t.costCenter}${installmentStr}\n`;
            output += `   ${t.transactionDate.toLocaleDateString('pt-BR')}\n`;
            output += `   ID: ${t.id}\n\n`;
          });

          return this.success(output);
        }

        case 'balance': {
          const start = startDate ? new Date(startDate) : undefined;
          const end = endDate ? new Date(endDate) : undefined;

          const balance = repo.getBalance(userId, start, end);

          const period = start && end
            ? `${start.toLocaleDateString('pt-BR')} a ${end.toLocaleDateString('pt-BR')}`
            : start
            ? `a partir de ${start.toLocaleDateString('pt-BR')}`
            : 'Geral';

          return this.success(`💰 Saldo Financeiro

Período: ${period}

📈 Entradas: R$ ${balance.entradas.toFixed(2)}
📉 Saídas: R$ ${balance.saidas.toFixed(2)}
━━━━━━━━━━━━━━━━━━━━━━━
💵 Saldo: R$ ${balance.saldo.toFixed(2)}

${balance.saldo >= 0 ? '✅ Saldo positivo' : '⚠️ Saldo negativo'}
(Apenas transações realizadas)`);
        }

        case 'report_by_cost_center': {
          const start = startDate ? new Date(startDate) : undefined;
          const end = endDate ? new Date(endDate) : undefined;

          const report = repo.getExpensesByCostCenter(userId, start, end);

          if (report.length === 0) {
            return this.success('📊 Nenhum gasto registrado no período.');
          }

          const total = report.reduce((sum, item) => sum + item.total, 0);

          let output = `📊 Gastos por Centro de Custo\n\n`;

          report.forEach((item, idx) => {
            const percentage = ((item.total / total) * 100).toFixed(1);
            output += `${idx + 1}. ${item.costCenter}\n`;
            output += `   R$ ${item.total.toFixed(2)} (${percentage}%)\n\n`;
          });

          output += `━━━━━━━━━━━━━━━━━━━━━━━\n`;
          output += `Total: R$ ${total.toFixed(2)}`;

          return this.success(output);
        }

        case 'update_status': {
          if (!transactionId || !newStatus) {
            return this.error('Erro: transactionId e newStatus são obrigatórios');
          }

          const updated = repo.updateStatus(transactionId, newStatus);

          if (!updated) {
            return this.error('Transação não encontrada');
          }

          return this.success(`✅ Status atualizado para: ${newStatus}`);
        }

        case 'update': {
          if (!transactionId) {
            return this.error('Erro: transactionId é obrigatório');
          }

          const updates: any = {};
          if (transactionDate) updates.transactionDate = new Date(transactionDate);
          if (amount) updates.amount = amount;
          if (description) updates.description = description;
          if (costCenter) updates.costCenter = costCenter;
          if (transactionType) updates.transactionType = transactionType;
          if (movementType) updates.movementType = movementType;
          if (installmentInfo) updates.installmentInfo = installmentInfo;
          if (status) updates.status = status;

          if (Object.keys(updates).length === 0) {
            return this.error('Erro: nenhum campo fornecido para atualizar');
          }

          const updated = repo.update(transactionId, updates);

          if (!updated) {
            return this.error('Transação não encontrada ou nenhum campo foi alterado');
          }

          return this.success('✅ Transação atualizada com sucesso');
        }

        case 'delete': {
          if (!transactionId) {
            return this.error('Erro: transactionId é obrigatório');
          }

          const deleted = repo.delete(transactionId);

          if (!deleted) {
            return this.error('Transação não encontrada');
          }

          return this.success('✅ Transação deletada com sucesso');
        }

        case 'export_csv': {
          const filters: any = { userId };
          if (startDate) filters.startDate = startDate;
          if (endDate) filters.endDate = endDate;
          if (transactionType) filters.transactionType = transactionType;
          if (movementType) filters.movementType = movementType;
          if (costCenter) filters.costCenter = costCenter;
          if (status) filters.status = status;

          const transactions = repo.findMany(filters, limit || 1000);

          if (transactions.length === 0) {
            return this.error('Nenhuma transação encontrada para exportar');
          }

          // Gerar CSV
          let csv = 'data,valor,descricao,categoria,tipo,movimento,parcela,status\n';

          transactions.forEach(t => {
            const date = t.transactionDate.toISOString().split('T')[0]; // YYYY-MM-DD
            const installment = t.installmentInfo || '';
            
            csv += `${date},${t.amount},${t.description},${t.costCenter},${t.transactionType},${t.movementType},${installment},${t.status}\n`;
          });

          return this.success(`📤 CSV gerado com sucesso!\n\n${transactions.length} transações exportadas.\n\n${csv}`);
        }

        default:
          return this.error(`Ação desconhecida: ${action}`);
      }
    } catch (error: any) {
      console.error('❌ Erro no financial_operation:', error);
      return this.error(`Erro ao executar operação financeira: ${error.message}`);
    }
  }
}
