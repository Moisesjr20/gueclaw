#!/usr/bin/env node
/**
 * Error Log Mapper
 * 
 * Mapeia e analisa logs de erro do GueClaw Agent
 * Identifica padrões de erro e gera relatório estruturado
 */

import * as fs from 'fs';
import * as path from 'path';
import { ErrorRecoveryManager } from '../services/error-recovery-manager';

interface ErrorEntry {
  timestamp: string;
  type: 'MAX_ITERATIONS' | 'UNEXPECTED_ERROR' | 'TOOL_ERROR' | 'UNKNOWN';
  message: string;
  source: string;
  stack?: string;
}

class ErrorLogMapper {
  private logDir: string;
  private dataDir: string;
  private errors: ErrorEntry[] = [];

  constructor() {
    this.logDir = path.join(process.cwd(), 'logs');
    this.dataDir = path.join(process.cwd(), 'data', 'recovery');
  }

  /**
   * Analisa todos os logs disponíveis
   */
  public async analyzeLogs(): Promise<void> {
    console.log('🔍 Analisando logs de erro...\n');

    // 1. Analisa logs de arquivo (se existirem)
    await this.scanLogFiles();

    // 2. Analisa tarefas interrompidas salvas
    await this.scanInterruptedTasks();

    // 3. Gera relatório
    this.generateReport();
  }

  /**
   * Escaneia arquivos de log
   */
  private async scanLogFiles(): Promise<void> {
    if (!fs.existsSync(this.logDir)) {
      console.log('⚠️  Diretório de logs não encontrado');
      return;
    }

    const files = fs.readdirSync(this.logDir);
    const logFiles = files.filter(f => f.endsWith('.log'));

    for (const file of logFiles) {
      const filePath = path.join(this.logDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      this.parseLogContent(content, file);
    }

    console.log(`✅ Analisados ${logFiles.length} arquivos de log`);
  }

  /**
   * Parse conteúdo de log
   */
  private parseLogContent(content: string, source: string): void {
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Detecta erro de MAX_ITERATIONS
      if (line.includes('Max iterations') || line.includes('maximum number of reasoning steps')) {
        this.errors.push({
          timestamp: this.extractTimestamp(line) || new Date().toISOString(),
          type: 'MAX_ITERATIONS',
          message: line.trim(),
          source,
        });
      }

      // Detecta erro genérico
      if (line.includes('❌ Error') || line.includes('ERROR')) {
        // Tenta capturar stack trace (próximas linhas)
        let stack = '';
        let j = i + 1;
        while (j < lines.length && j < i + 10 && lines[j].trim().startsWith('at ')) {
          stack += lines[j] + '\n';
          j++;
        }

        this.errors.push({
          timestamp: this.extractTimestamp(line) || new Date().toISOString(),
          type: this.classifyError(line),
          message: line.trim(),
          source,
          stack: stack || undefined,
        });
      }

      // Detecta erro de tool
      if (line.includes('Tool execution failed') || line.includes('Tool error')) {
        this.errors.push({
          timestamp: this.extractTimestamp(line) || new Date().toISOString(),
          type: 'TOOL_ERROR',
          message: line.trim(),
          source,
        });
      }
    }
  }

  /**
   * Escaneia tarefas interrompidas salvas
   */
  private async scanInterruptedTasks(): Promise<void> {
    const recoveryManager = ErrorRecoveryManager.getInstance();
    const stats = recoveryManager.getStats();

    console.log(`\n📊 Tarefas Interrompidas:`);
    console.log(`   Total: ${stats.total}`);
    console.log(`   Por tipo:`, stats.byType);
    console.log(`   Média de retries: ${stats.avgRetries.toFixed(2)}`);
  }

  /**
   * Extrai timestamp de linha de log
   */
  private extractTimestamp(line: string): string | null {
    // Formato ISO: 2026-04-22T12:40:00.000Z
    const isoMatch = line.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/);
    if (isoMatch) return isoMatch[0];

    // Formato comum: [2026-04-22 12:40:00]
    const bracketMatch = line.match(/\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\]/);
    if (bracketMatch) return new Date(bracketMatch[1]).toISOString();

    return null;
  }

  /**
   * Classifica tipo de erro baseado na mensagem
   */
  private classifyError(message: string): ErrorEntry['type'] {
    if (message.includes('Max iterations') || message.includes('maximum number of reasoning')) {
      return 'MAX_ITERATIONS';
    }
    if (message.includes('Tool') || message.includes('tool')) {
      return 'TOOL_ERROR';
    }
    if (message.includes('unexpected') || message.includes('Unexpected')) {
      return 'UNEXPECTED_ERROR';
    }
    return 'UNKNOWN';
  }

  /**
   * Gera relatório de erros
   */
  private generateReport(): void {
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('📊 RELATÓRIO DE ERROS');
    console.log('═══════════════════════════════════════════════════════\n');

    if (this.errors.length === 0) {
      console.log('✅ Nenhum erro encontrado nos logs!');
      return;
    }

    // Agrupa por tipo
    const byType: Record<string, ErrorEntry[]> = {};
    this.errors.forEach(err => {
      if (!byType[err.type]) byType[err.type] = [];
      byType[err.type].push(err);
    });

    // Exibe estatísticas
    console.log(`Total de erros encontrados: ${this.errors.length}\n`);

    Object.entries(byType).forEach(([type, errors]) => {
      console.log(`\n🔴 ${type}: ${errors.length} ocorrências`);
      console.log('─────────────────────────────────────────────────────');
      
      // Mostra os 5 mais recentes
      const recent = errors
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 5);

      recent.forEach((err, idx) => {
        console.log(`\n  ${idx + 1}. [${err.timestamp}] ${err.source}`);
        console.log(`     ${err.message.substring(0, 100)}${err.message.length > 100 ? '...' : ''}`);
        if (err.stack) {
          console.log(`     Stack: ${err.stack.split('\n')[0]}`);
        }
      });

      if (errors.length > 5) {
        console.log(`\n  ... e mais ${errors.length - 5} ocorrências`);
      }
    });

    // Recomendações
    console.log('\n\n💡 RECOMENDAÇÕES');
    console.log('═══════════════════════════════════════════════════════');
    
    if (byType['MAX_ITERATIONS'] && byType['MAX_ITERATIONS'].length > 10) {
      console.log('\n⚠️  Alto número de erros MAX_ITERATIONS detectado!');
      console.log('   • Considere aumentar o limite de iterações');
      console.log('   • Revise as instruções do sistema para ser mais direto');
      console.log('   • Implemente cache de respostas intermediárias');
    }

    if (byType['TOOL_ERROR'] && byType['TOOL_ERROR'].length > 5) {
      console.log('\n⚠️  Múltiplos erros de ferramentas detectados!');
      console.log('   • Verifique permissões e configuração das ferramentas');
      console.log('   • Adicione validação de entrada mais robusta');
      console.log('   • Implemente retry automático para ferramentas críticas');
    }

    if (byType['UNEXPECTED_ERROR'] && byType['UNEXPECTED_ERROR'].length > 5) {
      console.log('\n⚠️  Erros inesperados frequentes!');
      console.log('   • Adicione mais tratamento de exceções');
      console.log('   • Revise logs detalhados para identificar causa raiz');
      console.log('   • Considere adicionar health checks');
    }

    console.log('\n═══════════════════════════════════════════════════════\n');
  }
}

// Executa se chamado diretamente
if (require.main === module) {
  const mapper = new ErrorLogMapper();
  mapper.analyzeLogs().catch(console.error);
}

export default ErrorLogMapper;
