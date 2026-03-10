import { Bot } from 'grammy';
import * as dotenv from 'dotenv';
import { AgentController } from './core/AgentController';
import { TelegramInputHandler } from './core/TelegramInputHandler';

// Carrega variáveis do arquivo .env
dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token || token === 'INSERIR_TOKEN_AQUI') {
  console.error('[FATAL] Token do Telegram ausente no .env');
  process.exit(1);
}

const bot = new Bot(token);
const agentController = new AgentController();
const inputHandler = new TelegramInputHandler(bot, agentController);

async function start() {
  console.log('[GueClaw] Iniciando bot...');
  
  // Registrar listeners básicos
  inputHandler.register();
  
  // Tratamento de shutdown limpo
  process.once('SIGINT', () => bot.stop());
  process.once('SIGTERM', () => bot.stop());

  await bot.start({
    onStart: (botInfo) => {
      console.log(`[GueClaw] Bot @${botInfo.username} online e pronto para receber comandos!`);
    }
  });
}

start().catch(err => {
  console.error('[GueClaw] Erro fatal:', err);
});
