import { Tool } from '../engine/ToolRegistry';
import { buildSshConfig, executeRemoteCommand } from './SshClient';

/**
 * Tool de execução de comandos SSH na VPS.
 * O LLM chama esta tool quando o usuário pede ações na VPS.
 * 
 * SEGURANÇA: Só pode ser acionada por usuários na whitelist (TELEGRAM_ALLOWED_USER_IDS).
 */
export const SshExecutorTool: Tool = {
  name: 'execute_vps_command',
  description: `Executa um comando shell diretamente na VPS via SSH e retorna o resultado.
Use quando o usuário pedir para:
- Listar arquivos/diretórios na VPS
- Ver logs de aplicações (pm2, docker, etc.)
- Resetar ou iniciar serviços
- Verificar uso de CPU, RAM, disco
- Executar qualquer operação no servidor remoto
- Buscar projetos/arquivos/configurações na VPS

IMPORTANTE: Prefira comandos não-interativos. Para comandos longos, adicione 'head -50' ou similar para limitar o output.`,
  parameters: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'Comando shell a executar na VPS. Ex: "ls /opt", "pm2 status", "df -h", "cat /var/log/syslog | tail -20"'
      },
      timeout: {
        type: 'number',
        description: 'Timeout em segundos (padrão: 30). Use valores maiores para operações demoradas como find ou npm install.'
      }
    },
    required: ['command']
  },

  async execute(args: { command: string; timeout?: number }): Promise<string> {
    const { command, timeout = 30 } = args;

    // Sanitiza: bloqueia comandos destrutivos irreversíveis para evitar acidentes
    const BLOCKED = ['rm -rf /', 'mkfs', ':(){:|:&};:', 'dd if=/dev/zero', '> .env', 'nano .env', 'vim .env'];
    for (const blocked of BLOCKED) {
      if (command.includes(blocked)) {
        return `[BLOQUEADO] Comando bloqueado por segurança: "${blocked}"`;
      }
    }

    console.log(`[SSH Tool] Executando: ${command.substring(0, 80)}${command.length > 80 ? '...' : ''}`);

    try {
      const config = buildSshConfig();
      const result = await executeRemoteCommand(config, command, timeout * 1000);

      // Monta resposta limpa
      let output = '';

      if (result.stdout) {
        output += result.stdout;
      }

      if (result.stderr) {
        output += result.stdout ? `\n\n[stderr]: ${result.stderr}` : `[stderr]: ${result.stderr}`;
      }

      if (result.exitCode !== 0) {
        output += `\n\n[Exit code: ${result.exitCode}]`;
      }

      // Limita output para não explodir o contexto do LLM
      if (output.length > 4000) {
        output = output.substring(0, 4000) + '\n\n[... output truncado após 4000 chars]';
      }

      return output || '[Comando executado sem output]';

    } catch (err: any) {
      return `[SSH Error]: ${err.message}`;
    }
  }
};
