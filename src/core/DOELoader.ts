import * as fs from 'fs';
import * as path from 'path';

export interface DOEContext {
  directives: string;
  orchestration: string;
  executions: string;
  agentInstructions: string;
  loaded: boolean;
}

/**
 * Carrega o framework DOE da pasta DOE/ e monta o system prompt base.
 * Os arquivos definem as regras de comportamento, fluxo de trabalho e execução do agente.
 */
export class DOELoader {
  private static doeDir = path.resolve('DOE');
  private static cache: string | null = null;

  /**
   * Lê um arquivo DOE de forma segura, retornando string vazia se não encontrado.
   */
  private static readFile(filename: string): string {
    const filePath = path.join(this.doeDir, filename);
    try {
      if (fs.existsSync(filePath)) {
        return fs.readFileSync(filePath, 'utf-8').trim();
      }
    } catch {
      // silencia erros de leitura
    }
    return '';
  }

  /**
   * Monta o system prompt completo com todo o framework DOE.
   * Usa cache para não reler os arquivos em cada requisição.
   */
  public static buildSystemPrompt(): string {
    if (this.cache) return this.cache;

    const directives    = this.readFile('Directives.md');
    const orchestration = this.readFile('Orchestration.md');
    const executions    = this.readFile('Executions.md');
    const agentInstr    = this.readFile('agents.md');

    // Verifica se algum arquivo foi encontrado
    const hasDOE = [directives, orchestration, executions, agentInstr].some(f => f.length > 0);

    if (!hasDOE) {
      console.warn('[DOELoader] Nenhum arquivo DOE encontrado em DOE/. Usando prompt padrão.');
      this.cache = this.defaultPrompt();
      return this.cache;
    }

    console.log('[DOELoader] Framework DOE carregado com sucesso.');

    this.cache = `# FRAMEWORK DOE — REGRAS OPERACIONAIS DO AGENTE

Você é GueClaw, um agente de IA operando sob o **Framework DOE (Directive, Orchestration, Execution)**.
Fale **sempre em Português-BR**.

---

${directives ? `## 📋 DIRETIVAS (O QUE FAZER)\n${directives}\n\n---\n` : ''}
${orchestration ? `## 🔄 ORQUESTRAÇÃO (COMO DECIDIR)\n${orchestration}\n\n---\n` : ''}
${executions ? `## ⚙️ EXECUÇÃO (COMO FAZER)\n${executions}\n\n---\n` : ''}
${agentInstr ? `## 🤖 INSTRUÇÕES DO AGENTE\n${agentInstr}\n\n---\n` : ''}

## 🛡️ REGRAS INVIOLÁVEIS
1. Nunca comitar código que quebre o build
2. Sempre ler arquivos relacionados ANTES de codar
3. Empurre lógica complexa para scripts Python em \`execution/\`
4. Você é o orquestrador — decida, não execute manualmente
5. Use a tool \`execute_shell_command\` para ações no servidor
6. Use a tool \`execute_python\` para lógica de negócio complexa

## 🔁 LOOP SELF-ANNEALING
Quando algo falhar:
1. Analise o erro
2. Corrija e teste
3. Atualize a diretiva com o aprendizado
4. Siga em frente — nunca apenas peça desculpas`;

    return this.cache;
  }

  /**
   * Invalida o cache (útil se os arquivos DOE forem editados em runtime).
   */
  public static invalidateCache(): void {
    this.cache = null;
  }

  private static defaultPrompt(): string {
    return 'Você é GueClaw, assistente de engenharia de software. Responda em Português-BR. Use tools disponíveis para executar ações no servidor.';
  }
}
