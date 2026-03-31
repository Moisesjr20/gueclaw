import { DatabaseConnection } from './database';
import { v4 as uuidv4 } from 'uuid';

/**
 * Interface para Transação Financeira
 */
export interface FinancialTransaction {
  id: string;
  userId: string;
  transactionDate: Date;
  amount: number;
  description: string;
  costCenter: string;
  transactionType: 'entrada' | 'saida';
  movementType: 'parcela' | 'unico' | 'mensal';
  installmentInfo?: string; // Formato: "1/12" (parcela atual / total)
  status: 'realizado' | 'nao_realizado';
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Input para criar transação
 */
export interface CreateFinancialTransactionInput {
  userId: string;
  transactionDate: Date;
  amount: number;
  description: string;
  costCenter: string;
  transactionType: 'entrada' | 'saida';
  movementType: 'parcela' | 'unico' | 'mensal';
  installmentInfo?: string;
  status?: 'realizado' | 'nao_realizado';
}

/**
 * Filtros para consulta
 */
export interface FinancialTransactionFilter {
  userId: string;
  startDate?: Date;
  endDate?: Date;
  transactionType?: 'entrada' | 'saida';
  movementType?: 'parcela' | 'unico' | 'mensal';
  costCenter?: string;
  status?: 'realizado' | 'nao_realizado';
}

/**
 * Repository para Transações Financeiras
 * Usa criptografia AES-256-GCM para campos sensíveis (amount, description)
 */
export class FinancialRepository {
  private db = DatabaseConnection.getInstance();

  /**
   * Criar nova transação financeira (com criptografia)
   */
  create(input: CreateFinancialTransactionInput): FinancialTransaction {
    const id = uuidv4();
    const now = Math.floor(Date.now() / 1000);
    const transactionDateTs = Math.floor(input.transactionDate.getTime() / 1000);

    // 🔐 Criptografar campos sensíveis
    const amountEncrypted = DatabaseConnection.encryptField(input.amount.toString());
    const descriptionEncrypted = DatabaseConnection.encryptField(input.description);

    const stmt = this.db.prepare(`
      INSERT INTO financial_transactions (
        id, user_id, transaction_date, amount_encrypted, description_encrypted,
        cost_center, transaction_type, movement_type, installment_info, status,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      input.userId,
      transactionDateTs,
      amountEncrypted,
      descriptionEncrypted,
      input.costCenter,
      input.transactionType,
      input.movementType,
      input.installmentInfo || null,
      input.status || 'nao_realizado',
      now,
      now
    );

    return {
      id,
      userId: input.userId,
      transactionDate: input.transactionDate,
      amount: input.amount,
      description: input.description,
      costCenter: input.costCenter,
      transactionType: input.transactionType,
      movementType: input.movementType,
      installmentInfo: input.installmentInfo,
      status: input.status || 'nao_realizado',
      createdAt: new Date(now * 1000),
      updatedAt: new Date(now * 1000),
    };
  }

  /**
   * Buscar transação por ID (com descriptografia)
   */
  findById(id: string): FinancialTransaction | undefined {
    const stmt = this.db.prepare(`
      SELECT * FROM financial_transactions WHERE id = ?
    `);

    const row = stmt.get(id) as any;
    if (!row) return undefined;

    return this.decryptRow(row);
  }

  /**
   * Listar transações com filtros
   */
  findMany(filter: FinancialTransactionFilter, limit: number = 50): FinancialTransaction[] {
    let query = `SELECT * FROM financial_transactions WHERE user_id = ?`;
    const params: any[] = [filter.userId];

    if (filter.startDate) {
      query += ` AND transaction_date >= ?`;
      params.push(Math.floor(filter.startDate.getTime() / 1000));
    }

    if (filter.endDate) {
      query += ` AND transaction_date <= ?`;
      params.push(Math.floor(filter.endDate.getTime() / 1000));
    }

    if (filter.transactionType) {
      query += ` AND transaction_type = ?`;
      params.push(filter.transactionType);
    }

    if (filter.movementType) {
      query += ` AND movement_type = ?`;
      params.push(filter.movementType);
    }

    if (filter.costCenter) {
      query += ` AND cost_center = ?`;
      params.push(filter.costCenter);
    }

    if (filter.status) {
      query += ` AND status = ?`;
      params.push(filter.status);
    }

    query += ` ORDER BY transaction_date DESC LIMIT ?`;
    params.push(limit);

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];

    return rows.map((row) => this.decryptRow(row));
  }

  /**
   * Atualizar status de transação
   */
  updateStatus(id: string, status: 'realizado' | 'nao_realizado'): boolean {
    const now = Math.floor(Date.now() / 1000);

    const stmt = this.db.prepare(`
      UPDATE financial_transactions 
      SET status = ?, updated_at = ?
      WHERE id = ?
    `);

    const result = stmt.run(status, now, id);
    return result.changes > 0;
  }

  /**
   * Atualizar transação completa
   */
  update(
    id: string,
    updates: Partial<Omit<CreateFinancialTransactionInput, 'userId'>>
  ): boolean {
    const existing = this.findById(id);
    if (!existing) return false;

    const now = Math.floor(Date.now() / 1000);
    const fields: string[] = [];
    const params: any[] = [];

    if (updates.transactionDate !== undefined) {
      fields.push('transaction_date = ?');
      params.push(Math.floor(updates.transactionDate.getTime() / 1000));
    }

    if (updates.amount !== undefined) {
      fields.push('amount_encrypted = ?');
      params.push(DatabaseConnection.encryptField(updates.amount.toString()));
    }

    if (updates.description !== undefined) {
      fields.push('description_encrypted = ?');
      params.push(DatabaseConnection.encryptField(updates.description));
    }

    if (updates.costCenter !== undefined) {
      fields.push('cost_center = ?');
      params.push(updates.costCenter);
    }

    if (updates.transactionType !== undefined) {
      fields.push('transaction_type = ?');
      params.push(updates.transactionType);
    }

    if (updates.movementType !== undefined) {
      fields.push('movement_type = ?');
      params.push(updates.movementType);
    }

    if (updates.installmentInfo !== undefined) {
      fields.push('installment_info = ?');
      params.push(updates.installmentInfo || null);
    }

    if (updates.status !== undefined) {
      fields.push('status = ?');
      params.push(updates.status);
    }

    if (fields.length === 0) return false;

    fields.push('updated_at = ?');
    params.push(now);
    params.push(id);

    const query = `UPDATE financial_transactions SET ${fields.join(', ')} WHERE id = ?`;
    const stmt = this.db.prepare(query);
    const result = stmt.run(...params);

    return result.changes > 0;
  }

  /**
   * Deletar transação
   */
  delete(id: string): boolean {
    const stmt = this.db.prepare(`DELETE FROM financial_transactions WHERE id = ?`);
    const result = stmt.run(id);
    return result.changes > 0;
  }

  /**
   * Obter saldo total (entradas - saídas)
   */
  getBalance(
    userId: string,
    startDate?: Date,
    endDate?: Date,
    onlyRealized: boolean = true
  ): { entradas: number; saidas: number; saldo: number } {
    let query = `
      SELECT transaction_type, amount_encrypted
      FROM financial_transactions
      WHERE user_id = ?
    `;
    const params: any[] = [userId];

    if (onlyRealized) {
      query += ` AND status = 'realizado'`;
    }

    if (startDate) {
      query += ` AND transaction_date >= ?`;
      params.push(Math.floor(startDate.getTime() / 1000));
    }

    if (endDate) {
      query += ` AND transaction_date <= ?`;
      params.push(Math.floor(endDate.getTime() / 1000));
    }

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];

    let entradas = 0;
    let saidas = 0;

    for (const row of rows) {
      const amount = parseFloat(
        DatabaseConnection.decryptField(row.amount_encrypted as Buffer)
      );

      if (row.transaction_type === 'entrada') {
        entradas += amount;
      } else {
        saidas += amount;
      }
    }

    return {
      entradas,
      saidas,
      saldo: entradas - saidas,
    };
  }

  /**
   * Obter gastos por centro de custo
   */
  getExpensesByCostCenter(
    userId: string,
    startDate?: Date,
    endDate?: Date
  ): Array<{ costCenter: string; total: number }> {
    let query = `
      SELECT cost_center, amount_encrypted
      FROM financial_transactions
      WHERE user_id = ? AND transaction_type = 'saida' AND status = 'realizado'
    `;
    const params: any[] = [userId];

    if (startDate) {
      query += ` AND transaction_date >= ?`;
      params.push(Math.floor(startDate.getTime() / 1000));
    }

    if (endDate) {
      query += ` AND transaction_date <= ?`;
      params.push(Math.floor(endDate.getTime() / 1000));
    }

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];

    const costCenterMap = new Map<string, number>();

    for (const row of rows) {
      const amount = parseFloat(
        DatabaseConnection.decryptField(row.amount_encrypted as Buffer)
      );
      const current = costCenterMap.get(row.cost_center) || 0;
      costCenterMap.set(row.cost_center, current + amount);
    }

    return Array.from(costCenterMap.entries())
      .map(([costCenter, total]) => ({ costCenter, total }))
      .sort((a, b) => b.total - a.total);
  }

  /**
   * Descriptografar linha do banco
   */
  private decryptRow(row: any): FinancialTransaction {
    const amount = parseFloat(
      DatabaseConnection.decryptField(row.amount_encrypted as Buffer)
    );
    const description = DatabaseConnection.decryptField(
      row.description_encrypted as Buffer
    );

    return {
      id: row.id,
      userId: row.user_id,
      transactionDate: new Date(row.transaction_date * 1000),
      amount,
      description,
      costCenter: row.cost_center,
      transactionType: row.transaction_type,
      movementType: row.movement_type,
      installmentInfo: row.installment_info,
      status: row.status,
      createdAt: new Date(row.created_at * 1000),
      updatedAt: new Date(row.updated_at * 1000),
    };
  }
}
