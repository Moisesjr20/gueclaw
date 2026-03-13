#!/usr/bin/env ts-node
/**
 * GitHub Copilot OAuth Authentication Script
 * 
 * Usage:
 *   npm run copilot:auth
 */

import 'dotenv/config';
import { GitHubCopilotOAuthProvider } from '../src/core/providers/github-copilot-oauth-provider';

async function authenticateCopilot() {
  console.log('\n🚀 Iniciando autenticação GitHub Copilot...\n');

  const model = process.env.GITHUB_COPILOT_MODEL || 'claude-sonnet-4.5';
  const provider = new GitHubCopilotOAuthProvider(model);

  if (provider.isAuthenticated()) {
    console.log('✅ Você já está autenticado!\n');
    console.log('Para re-autenticar, delete o arquivo: data/github-token.json\n');
    process.exit(0);
  }

  try {
    await provider.authenticate();
    
    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║     ✅ Autenticação Concluída!                   ║');
    console.log('╚══════════════════════════════════════════════════╝\n');
    console.log('Agora você pode usar o GueClaw Agent:\n');
    console.log('  npm run dev\n');

    process.exit(0);

  } catch (error: any) {
    console.error('\n❌ Erro na autenticação:', error.message);
    console.log('\n💡 Tente novamente com:\n');
    console.log('  npm run copilot:auth\n');
    process.exit(1);
  }
}

// Run authentication
authenticateCopilot().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
