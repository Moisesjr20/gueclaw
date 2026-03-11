import { Tool } from '../engine/ToolRegistry';
import { exec } from 'child_process';
import * as path from 'path';

export class PythonExecutorTool implements Tool {
  name = "execute_python";
  description = "Executa um script Python na pasta 'execution/' OU um script de uma skill em '.agents/skills/'. Retorna o stdout. ATENÇÃO: se for um arquivo de uma skill, passe o caminho relativo EXATO ex: '.agents/skills/advocacia-ce-scraper/scripts/pipeline_completo.py'";
  
  parameters = {
    type: "object" as const,
    properties: {
      scriptName: {
        type: "string",
        description: "Nome do script python a rodar. Para skills, DEVE começar com '.agents/skills/'. (ex: '.agents/skills/nome-skill/scripts/arquivo.py')"
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
        // Remove diretórios perigosos de travessia absoluta
        const sanitizedScript = scriptName.replace(/^\/+/, '').replace(/\.\.\//g, '');
        
        let scriptPath = '';
        if (sanitizedScript.startsWith('.agents/skills/')) {
           // Permite rodar código de skills customizadas
           scriptPath = path.resolve(process.cwd(), sanitizedScript);
        } else {
           // Fallback seguro nativo DO FLuxohub
           scriptPath = path.resolve(process.cwd(), 'execution', sanitizedScript);
        }

        const argsStr = args.map((a: string) => `"${a}"`).join(' ');
        
        // Cuidado de Segurança Básico aqui: Não permite && ou ;
        if (scriptPath.includes(';') || scriptPath.includes('&')) {
            return reject(new Error("Path injection detectado. Execução Rejeitada."));
        }

        const cmd = `python3 "${scriptPath}" ${argsStr}`;
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
