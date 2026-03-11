import { Tool } from '../engine/ToolRegistry';

export const SendFileTool: Tool = {
  name: 'send_file_to_user',
  description: `Envia um arquivo existente no servidor diretamente para o usuário no Telegram (upload do arquivo).
Use esta ferramenta SEMPRE que o usuário pedir para enviar, baixar, transferir ou retornar um arquivo (ex: planilhas, PDFs, CSVs, imagens, vídeos, zips).
Passe o caminho ABSOLUTO do arquivo que deseja enviar.
Não use para arquivos muito grandes (maiores que 50MB) devido aos limites padrão da API do Telegram.`,
  parameters: {
    type: 'object' as const,
    properties: {
      file_path: {
        type: 'string',
        description: 'Caminho absoluto do arquivo no servidor. Ex: "/opt/gueclaw/data/relatorio.csv"'
      },
      caption: {
        type: 'string',
        description: 'Mensagem legenda opcional para acompanhar o arquivo enviado.'
      }
    },
    required: ['file_path']
  },

  async execute(args: { file_path: string; caption?: string }): Promise<string> {
    const fs = require('fs');
    if (!fs.existsSync(args.file_path)) {
      return `[Erro] O arquivo não existe: ${args.file_path}`;
    }

    const stats = fs.statSync(args.file_path);
    if (!stats.isFile()) {
      return `[Erro] O caminho informado não é um arquivo: ${args.file_path}`;
    }

    if (stats.size > 50 * 1024 * 1024) { // 50MB limit
      return `[Erro] Arquivo muito grande para enviar via Telegram (${(stats.size / 1024 / 1024).toFixed(2)} MB). Limite é 50MB. Sugira enviar um link para download no lugar.`;
    }

    // Retornamos uma flag especial que o AgentLoop vai interceptar
    // para disparar a ação de Envio de Arquivo real usando o contexto grammy
    return `[INTERNAL_ACTION:SEND_DOCUMENT] {"file_path": "${args.file_path}", "caption": "${args.caption || ''}"}`;
  }
};
