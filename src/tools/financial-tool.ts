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

Operações disponíveis:
- "create": Criar transação (entrada/saída)
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
  "data": {
    "transactionDate": "2026-03-31",
    "amount": 5000,
    "description": "Salário março",
    "costCenter": "Renda",
    "transactionType": "entrada",
    "movementType": "unico",
    "status": "realizado"
  }
}

{
  "action": "create",
  "userId": "123456789",
  "data": {
    "transactionDate": "2026-03-15",
    "amount": 3000,
    "description": "Notebook Dell",
    "costCenter": "Eletrônicos",
    "transactionType": "saida",
    "movementType": "parcela",
    "installmentInfo": "1/12",
    "status": "realizado"
  }
}

{
  "action": "balance",
  "userId": "123456789",
  "filters": {
    "startDate": "2026-03-01",
    "endDate": "2026-03-31"
  }
}

{
  "action": "list",
  "userId": "123456789",
  "filters": {
    "transactionType": "saida",
    "status": "realizado"
  },
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
            enum: ['create', 'list', 'balance', 'report_by_cost_center', 'update_status', 'update', 'delete'],
            description: 'Operação a realizar',
          },
          userId: {
            type: 'string',
            description: 'ID do usuário (Telegram user ID)',
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

        default:
          return this.error(`Ação desconhecida: ${action}`);
      }
    } catch (error: any) {
      console.error('❌ Erro no financial_operation:', error);
      return this.error(`Erro ao executar operação financeira: ${error.message}`);
    }
  }
}
