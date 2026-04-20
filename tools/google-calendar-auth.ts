#!/usr/bin/env node
/**
 * Google Calendar OAuth Authentication Tool
 * Gera refresh token para acesso ao Google Calendar API
 */

import { google } from 'googleapis';
import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Carregar .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
];

interface CalendarConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  envPrefix: string;
}

const CONFIGS: Record<string, CalendarConfig> = {
  personal: {
    clientId: process.env.GOOGLE_PERSONAL_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_PERSONAL_CLIENT_SECRET || '',
    redirectUri: process.env.GOOGLE_PERSONAL_REDIRECT_URI || 'http://localhost:3000/oauth/callback',
    envPrefix: 'GOOGLE_PERSONAL',
  },
  work: {
    clientId: process.env.GOOGLE_WORK_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_WORK_CLIENT_SECRET || '',
    redirectUri: process.env.GOOGLE_WORK_REDIRECT_URI || 'http://localhost:3000/oauth/callback',
    envPrefix: 'GOOGLE_WORK',
  },
};

async function getRefreshToken(accountType: 'personal' | 'work'): Promise<void> {
  const config = CONFIGS[accountType];

  if (!config.clientId || !config.clientSecret) {
    console.error(`❌ Erro: CLIENT_ID ou CLIENT_SECRET não configurados para conta ${accountType}`);
    console.error(`Configure no .env:`);
    console.error(`  ${config.envPrefix}_CLIENT_ID=...`);
    console.error(`  ${config.envPrefix}_CLIENT_SECRET=...`);
    process.exit(1);
  }

  const oauth2Client = new google.auth.OAuth2(
    config.clientId,
    config.clientSecret,
    config.redirectUri
  );

  // Gerar URL de autorização
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent', // Force para obter refresh token
  });

  console.log('\n=================================================');
  console.log(`🔐 Autenticação Google Calendar - Conta ${accountType.toUpperCase()}`);
  console.log('=================================================\n');
  console.log('📋 Passos:\n');
  console.log('1. Acesse esta URL no navegador:\n');
  console.log(`   ${authUrl}\n`);
  console.log('2. Faça login com sua conta Google');
  console.log('3. Autorize o acesso (pode aparecer "Google hasn\'t verified this app" - clique Continue)');
  console.log('4. Copie o código de autorização da URL de redirecionamento');
  console.log('5. Cole o código abaixo\n');
  console.log('=================================================\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question('Digite o código de autorização: ', async (code) => {
    rl.close();

    try {
      const { tokens } = await oauth2Client.getToken(code);
      
      if (!tokens.refresh_token) {
        console.error('\n❌ Erro: Refresh token não foi retornado.');
        console.error('Isso pode acontecer se você já autorizou antes.');
        console.error('\nSolução:');
        console.error('1. Vá em: https://myaccount.google.com/permissions');
        console.error('2. Remova o acesso do app "GueClaw Calendar Bot"');
        console.error('3. Execute este script novamente');
        process.exit(1);
      }

      console.log('\n✅ Refresh token obtido com sucesso!');
      console.log(`\nRefresh Token: ${tokens.refresh_token}\n`);

      // Atualizar .env
      const envPath = path.resolve(__dirname, '../.env');
      let envContent = fs.readFileSync(envPath, 'utf-8');

      const tokenVar = `${config.envPrefix}_REFRESH_TOKEN`;
      const regex = new RegExp(`${tokenVar}=.*`, 'g');

      if (regex.test(envContent)) {
        envContent = envContent.replace(regex, `${tokenVar}=${tokens.refresh_token}`);
        console.log(`✅ Variável ${tokenVar} atualizada no .env`);
      } else {
        envContent += `\n${tokenVar}=${tokens.refresh_token}\n`;
        console.log(`✅ Variável ${tokenVar} adicionada ao .env`);
      }

      fs.writeFileSync(envPath, envContent, 'utf-8');

      console.log('\n=================================================');
      console.log('🎉 Autenticação concluída!');
      console.log('=================================================\n');
      console.log('Próximos passos:');
      console.log('1. Reinicie o agente GueClaw (pm2 restart gueclaw-agent)');
      console.log('2. Teste: Peça para listar eventos do calendário\n');

    } catch (error: any) {
      console.error('\n❌ Erro ao obter tokens:', error.message);
      if (error.response) {
        console.error('Detalhes:', error.response.data);
      }
      process.exit(1);
    }
  });
}

// Main
const accountType = process.argv[2] as 'personal' | 'work' | undefined;

if (!accountType || !['personal', 'work'].includes(accountType)) {
  console.error('❌ Uso: node google-calendar-auth.js [personal|work]');
  console.error('\nExemplos:');
  console.error('  node google-calendar-auth.js personal   # Para juniormoises335@gmail.com');
  console.error('  node google-calendar-auth.js work       # Para contato@kyrius.info');
  process.exit(1);
}

getRefreshToken(accountType);
