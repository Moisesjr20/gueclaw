import { Client } from 'ssh2';

export interface SshConfig {
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
}

export interface SshResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Executa um comando remoto na VPS via SSH.
 * Suporta autenticação por senha ou chave privada.
 */
export function executeRemoteCommand(config: SshConfig, command: string, timeoutMs = 30000): Promise<SshResult> {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    let stdout = '';
    let stderr = '';

    const timer = setTimeout(() => {
      conn.end();
      reject(new Error(`SSH timeout após ${timeoutMs / 1000}s executando: ${command.substring(0, 60)}`));
    }, timeoutMs);

    conn.on('ready', () => {
      conn.exec(command, (err, stream) => {
        if (err) {
          clearTimeout(timer);
          conn.end();
          return reject(err);
        }

        stream
          .on('close', (code: number) => {
            clearTimeout(timer);
            conn.end();
            resolve({ stdout: stdout.trim(), stderr: stderr.trim(), exitCode: code ?? 0 });
          })
          .on('data', (data: Buffer) => { stdout += data.toString(); })
          .stderr.on('data', (data: Buffer) => { stderr += data.toString(); });
      });
    });

    conn.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(`SSH Conexão falhou: ${err.message}`));
    });

    const connectOptions: any = {
      host: config.host,
      port: config.port,
      username: config.username,
      readyTimeout: 10000,
    };

    if (config.privateKey) {
      connectOptions.privateKey = config.privateKey;
    } else if (config.password) {
      connectOptions.password = config.password;
    }

    conn.connect(connectOptions);
  });
}

/**
 * Constrói a configuração SSH a partir das variáveis de ambiente.
 */
export function buildSshConfig(): SshConfig {
  const host = process.env.VPS_HOST || '';
  const port = parseInt(process.env.VPS_PORT || '22', 10);
  const username = process.env.VPS_USER || 'root';
  const password = process.env.VPS_PASSWORD || undefined;

  // Suporta chave privada inline (com \n escapados no .env)
  const privateKeyRaw = process.env.VPS_PRIVATE_KEY || '';
  const privateKey = privateKeyRaw ? privateKeyRaw.replace(/\\n/g, '\n') : undefined;

  if (!host) {
    throw new Error('VPS_HOST não configurado no .env');
  }

  if (!password && !privateKey) {
    throw new Error('Configure VPS_PASSWORD ou VPS_PRIVATE_KEY no .env');
  }

  return { host, port, username, password, privateKey };
}
