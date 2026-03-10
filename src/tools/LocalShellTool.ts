import { exec } from 'child_process';
import { Tool } from '../engine/ToolRegistry';

/**
 * Executa comandos diretamente no sistema local via child_process.
 * Ideal para quando o bot roda NA PRÓPRIA VPS — sem overhead de SSH.
 */
export const LocalShellTool: Tool = {
  name: 'execute_shell_command',
  description: `Executa um comando shell diretamente no servidor onde o bot está rodando e retorna o resultado.
Use quando o usuário pedir para:
- Listar arquivos/diretórios no servidor
- Ver logs de aplicações (pm2, docker, nginx, etc.)
- Verificar containers Docker (docker ps, docker logs, etc.)
- Checar uso de CPU, RAM, disco (df -h, free -h, top, etc.)
- Buscar arquivos ou projetos
- Gerenciar serviços e processos
- Qualquer operação de shell no servidor

IMPORTANT: Prefira comandos não-interativos. Para outputs longos adicione | head -50 para limitar.`,
  parameters: {
    type: 'object' as const,
    properties: {
      command: {
        type: 'string',
        description: 'Comando shell a executar. Ex: "docker ps -a", "df -h", "ls /opt", "pm2 status"'
      },
      timeout: {
        type: 'number',
        description: 'Timeout em segundos (padrão: 30)'
      }
    },
    required: ['command']
  },

  async execute(args: { command: string; timeout?: number }): Promise<string> {
    const { command, timeout = 30 } = args;

    // Proteção contra comandos destrutivos irreversíveis
    const BLOCKED = ['rm -rf /', 'mkfs', ':(){:|:&};:', 'dd if=/dev/zero of=/dev/'];
    for (const blocked of BLOCKED) {
      if (command.includes(blocked)) {
        return `[BLOQUEADO] Comando bloqueado por segurança: "${blocked}"`;
      }
    }

    console.log(`[Shell Tool] Executando: ${command.substring(0, 80)}${command.length > 80 ? '...' : ''}`);

    return new Promise((resolve) => {
      exec(command, { timeout: timeout * 1000, shell: '/bin/bash' }, (error, stdout, stderr) => {
        let output = '';

        if (stdout) output += stdout.trim();
        if (stderr) output += (stdout ? '\n\n[stderr]: ' : '[stderr]: ') + stderr.trim();
        if (error && !stdout && !stderr) output = `[Erro]: ${error.message}`;

        // Limita output para não sobrecarregar o contexto do LLM
        if (output.length > 4000) {
          output = output.substring(0, 4000) + '\n\n[... output truncado após 4000 chars]';
        }

        resolve(output || '[Comando executado sem output]');
      });
    });
  }
};
