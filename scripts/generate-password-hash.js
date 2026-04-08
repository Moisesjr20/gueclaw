#!/usr/bin/env node
/**
 * 🔐 Gerador de Hash de Senha para Dashboard
 * 
 * Uso:
 *   node scripts/generate-password-hash.js
 *   node scripts/generate-password-hash.js "MinhaSenhaSegura"
 */

const senha = process.argv[2];

if (!senha) {
  console.log('\n🔐 Gerador de Hash de Senha para Dashboard\n');
  console.log('Uso:');
  console.log('  node scripts/generate-password-hash.js "SuaSenhaAqui"\n');
  console.log('Exemplo:');
  console.log('  node scripts/generate-password-hash.js "GueClaw2026@Secure"\n');
  process.exit(1);
}

// Gera hash base64
const hash = Buffer.from(senha).toString('base64');

console.log('\n✅ Hash gerado com sucesso!\n');
console.log('─────────────────────────────────────────');
console.log('📝 Senha original:', senha);
console.log('🔒 Hash (base64):', hash);
console.log('─────────────────────────────────────────\n');

console.log('📋 Copie o hash e configure no .env:\n');
console.log(`DASHBOARD_PASSWORD_HASH=${hash}\n`);

console.log('⚠️  IMPORTANTE:');
console.log('1. Adicione no .env local');
console.log('2. Configure no Vercel (variável de ambiente)');
console.log('3. Faça redeploy: cd dashboard && vercel --prod\n');

// Gera comando para testar
console.log('🧪 Para testar localmente:');
console.log(`   echo "${hash}" | base64 -d\n`);
console.log('   (Deve retornar a senha original)\n');
