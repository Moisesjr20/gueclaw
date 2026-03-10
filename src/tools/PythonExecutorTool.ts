import { Tool } from '../engine/ToolRegistry';
import { exec } from 'child_process';
import * as path from 'path';

export class PythonExecutorTool implements Tool {
  name = "execute_python";
  description = "Executa um script Python determinístico da pasta 'execution/' e retorna o stdout.";
  
  parameters = {
    type: "object" as const,
    properties: {
      scriptName: {
        type: "string",
        description: "Nome do script python a rodar (ex: 'hello.py')"
      },
      args: {
        type: "array",
        items: { type: "string" },
        description: "Argumentos de linha de comando opcionais passados pro script."
      }
    },
    required: ["scriptName"]
  };

  public async execute(params: any): Promise<string> {
     const { scriptName, args = [] } = params;
     
     return new Promise((resolve, reject) => {
        const scriptPath = path.resolve(process.cwd(), 'execution', scriptName);
        const argsStr = args.map((a: string) => `"${a}"`).join(' ');
        
        // Cuidado de Segurança Básico aqui: Não permite && ou ;
        if (scriptPath.includes(';') || scriptPath.includes('&')) {
            return reject(new Error("Path injection detectado. Execução Rejeitada."));
        }

        const cmd = `python "${scriptPath}" ${argsStr}`;
        console.log(`[Tool] Rodando Python: ${cmd}`);

        exec(cmd, (error, stdout, stderr) => {
           if (error) {
              return resolve(`Falha de Execução. Erro: ${error.message}\nStderr: ${stderr}`);
           }
           resolve(stdout.trim());
        });
     });
  }
}
