'use client';
import useSWR from 'swr';
import { useState } from 'react';
import { apiFetch } from '@/lib/api';
import type { FinancialBalance, FinancialTransaction, CostCenterReport } from '@/lib/api';
import StatCard from '@/components/StatCard';
import PasswordProtection from '@/components/PasswordProtection';
import { TrendingUp, TrendingDown, Calendar } from 'lucide-react';

// Hardcoded user ID (you can make this dynamic later)
const USER_ID = '8227546813';

// Password from environment variable (configure in Vercel)
const FINANCIAL_PASSWORD = process.env.NEXT_PUBLIC_FINANCIAL_PASSWORD || 'financeiro2026';

export default function FinanceiroPage() {
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  
  const [startDate, setStartDate] = useState(firstDay.toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(today.toISOString().slice(0, 10));

  const { data: balance, isLoading: balanceLoading } = useSWR<FinancialBalance>(
    `financial/balance?userId=${USER_ID}&startDate=${startDate}&endDate=${endDate}`,
    () => apiFetch<FinancialBalance>(`financial/balance?userId=${USER_ID}&startDate=${startDate}&endDate=${endDate}`),
    { refreshInterval: 30_000 },
  );

  const { data: transactions, isLoading: txLoading } = useSWR<FinancialTransaction[]>(
    `financial/transactions?userId=${USER_ID}&startDate=${startDate}&endDate=${endDate}&limit=100`,
    () => apiFetch<FinancialTransaction[]>(`financial/transactions?userId=${USER_ID}&startDate=${startDate}&endDate=${endDate}&limit=100`),
    { refreshInterval: 30_000 },
  );

  const { data: report, isLoading: reportLoading } = useSWR<CostCenterReport[]>(
    `financial/report?userId=${USER_ID}&startDate=${startDate}&endDate=${endDate}`,
    () => apiFetch<CostCenterReport[]>(`financial/report?userId=${USER_ID}&startDate=${startDate}&endDate=${endDate}`),
    { refreshInterval: 30_000 },
  );

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
  };

  return (
    <PasswordProtection correctPassword={FINANCIAL_PASSWORD}>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-xl font-semibold text-[#e2eaf7]">Controle Financeiro</h1>
            <p className="text-sm text-[#5c7a9e] mt-0.5">Resumo de entradas, saídas e saldo</p>
          </div>

        {/* Date filters */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-[#5c7a9e]">
            <Calendar size={16} />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-[#0a0f1a] border border-[rgba(59,130,246,0.12)] rounded px-2 py-1 text-[#c5d5e8] text-sm focus:border-[#3b82f6] focus:outline-none"
            />
            <span className="text-[#3b5270]">até</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-[#0a0f1a] border border-[rgba(59,130,246,0.12)] rounded px-2 py-1 text-[#c5d5e8] text-sm focus:border-[#3b82f6] focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Summary cards */}
      {!balanceLoading && balance && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard
            label="Entradas"
            value={formatCurrency(balance.totalIncome)}
            accent="green"
          />
          <StatCard
            label="Saídas"
            value={formatCurrency(balance.totalExpense)}
            accent="red"
          />
          <StatCard
            label="Saldo"
            value={formatCurrency(balance.balance)}
            accent={balance.balance >= 0 ? 'green' : 'red'}
          />
        </div>
      )}

      {/* Cost center report */}
      {!reportLoading && report && report.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-[#8fa8c8] uppercase tracking-wider">
            Gastos por Centro de Custo
          </h2>
          <div className="glass overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[rgba(59,130,246,0.12)] text-xs text-[#5c7a9e] uppercase">
                  <th className="text-left px-4 py-3">Categoria</th>
                  <th className="text-right px-4 py-3">Total</th>
                  <th className="text-right px-4 py-3">%</th>
                  <th className="text-right px-4 py-3">Transações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(59,130,246,0.07)]">
                {report.map((item) => (
                  <tr key={item.costCenter} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-2.5 text-[#c5d5e8]">{item.costCenter}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-[#ef4444]">
                      {formatCurrency(item.totalExpense)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-[#5c7a9e]">
                      {item.percentage.toFixed(1)}%
                    </td>
                    <td className="px-4 py-2.5 text-right text-[#5c7a9e]">
                      {item.transactionCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Transactions table */}
      {!txLoading && transactions && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-[#8fa8c8] uppercase tracking-wider">
            Transações Recentes ({transactions.length})
          </h2>
          <div className="glass overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[rgba(59,130,246,0.12)] text-xs text-[#5c7a9e] uppercase">
                    <th className="text-left px-4 py-3">Data</th>
                    <th className="text-left px-4 py-3">Descrição</th>
                    <th className="text-left px-4 py-3">Categoria</th>
                    <th className="text-center px-4 py-3">Tipo</th>
                    <th className="text-right px-4 py-3">Valor</th>
                    <th className="text-center px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgba(59,130,246,0.07)]">
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-white/[0.02]">
                      <td className="px-4 py-2.5 text-[#5c7a9e] font-mono text-xs">
                        {formatDate(tx.transactionDate)}
                      </td>
                      <td className="px-4 py-2.5 text-[#c5d5e8]">
                        {tx.description}
                        {tx.installmentInfo && (
                          <span className="ml-2 text-xs text-[#3b82f6]">{tx.installmentInfo}</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-[#8fa8c8]">{tx.costCenter}</td>
                      <td className="px-4 py-2.5 text-center">
                        {tx.transactionType === 'entrada' ? (
                          <span className="inline-flex items-center gap-1 text-[#10b981]">
                            <TrendingUp size={14} />
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[#ef4444]">
                            <TrendingDown size={14} />
                          </span>
                        )}
                      </td>
                      <td className={`px-4 py-2.5 text-right font-mono ${
                        tx.transactionType === 'entrada' ? 'text-[#10b981]' : 'text-[#ef4444]'
                      }`}>
                        {formatCurrency(tx.amount)}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {tx.status === 'realizado' ? (
                          <span className="inline-block px-2 py-1 rounded text-xs bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/20">
                            Realizado
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-1 rounded text-xs bg-[#f59e0b]/15 text-[#f59e0b] border border-[#f59e0b]/20">
                            Pendente
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {balanceLoading && (
        <div className="text-sm text-[#5c7a9e]">Carregando dados financeiros...</div>
      )}
      </div>
    </PasswordProtection>
  );
}
