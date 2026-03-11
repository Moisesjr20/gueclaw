import { LocalShellTool } from '../tools/LocalShellTool';

export interface CodeBlock {
  language: string;
  code: string;
  fullMatch: string;
}

export interface ExecutionResult {
  command: string;
  output: string;
}

// Linguagens que serão executadas como shell
const SHELL_LANGS = new Set(['bash', 'sh', 'shell', 'zsh']);

/**
 * Extrai todos os blocos de código fenced (``` ... ```) de um texto markdown.
 */
export function extractCodeBlocks(text: string): CodeBlock[] {
  const blocks: CodeBlock[] = [];
  // Regex que captura ```lang\n...código...\n```
  const regex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    blocks.push({
      language: match[1].toLowerCase().trim(),
      code: match[2].trim(),
      fullMatch: match[0],
    });
  }
  return blocks;
}

/**
 * Filtra apenas blocos que são comandos de shell executáveis.
 */
export function filterShellBlocks(blocks: CodeBlock[]): CodeBlock[] {
  return blocks.filter(b => SHELL_LANGS.has(b.language));
}

/**
 * Executa cada bloco shell e retorna os resultados.
 * Pula blocos que parecem ser "exemplos" (começam com # comentário ou têm $VPS_).
 */
export async function executeShellBlocks(blocks: CodeBlock[]): Promise<ExecutionResult[]> {
  const results: ExecutionResult[] = [];

  for (const block of blocks) {
    const lines = block.code
      .split('\n')
      .map(l => l.trim())
      .filter(l => l && !l.startsWith('#'));

    if (lines.length === 0) continue;

    // Pula blocos que contêm placeholder de variáveis não resolvidas
    const hasPlaceholder = lines.some(l =>
      l.includes('$VPS_') || l.includes('YOUR_') || l.includes('<seu') || l.includes('SEU_')
    );
    if (hasPlaceholder) continue;

    // Executa as linhas do bloco como um único script
    const command = lines.join(' && ');
    console.log(`[CodeBlockExecutor] Executando: ${command.substring(0, 80)}`);

    try {
      const output = await LocalShellTool.execute({ command, timeout: 30 });
      results.push({ command, output });
    } catch (err: any) {
      results.push({ command, output: `[Erro]: ${err.message}` });
    }
  }

  return results;
}

/**
 * Ponto de entrada principal: analisa o texto, executa blocos shell e
 * retorna o texto enriquecido com os resultados da execução.
 */
export async function processAndExecuteCodeBlocks(text: string): Promise<string> {
  const blocks = filterShellBlocks(extractCodeBlocks(text));

  if (blocks.length === 0) {
    return text; // Nada a executar
  }

  console.log(`[CodeBlockExecutor] ${blocks.length} bloco(s) shell detectado(s).`);
  const results = await executeShellBlocks(blocks);

  if (results.length === 0) {
    return text; // Blocos eram apenas exemplos/placeholders
  }

  // Monta o output final: resposta original + resultados de execução
  let enriched = text;
  enriched += '\n\n---\n## 📊 Resultados da Execução\n';

  for (const r of results) {
    enriched += `\n**Comando:** \`${r.command.substring(0, 120)}\`\n`;
    enriched += `\`\`\`\n${r.output.substring(0, 2000)}\n\`\`\`\n`;
  }

  return enriched;
}
