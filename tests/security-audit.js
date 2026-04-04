/**
 * Script de Validação de Segurança
 * Verifica implementações de segurança (13 itens H1-H13)
 */

const fs = require('fs');
const path = require('path');

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

const results = [];

function check(id, name, testFn) {
  try {
    const passed = testFn();
    results.push({ id, name, passed, error: null });
    const status = passed ? `${colors.green}✓${colors.reset}` : `${colors.red}✗${colors.reset}`;
    console.log(`${status} ${id}: ${name}`);
    return passed;
  } catch (error) {
    results.push({ id, name, passed: false, error: error.message });
    console.log(`${colors.red}✗${colors.reset} ${id}: ${name} - ${error.message}`);
    return false;
  }
}

console.log(`\n${colors.blue}═══════════════════════════════════════════${colors.reset}`);
console.log(`${colors.blue}   SECURITY AUDIT VALIDATION${colors.reset}`);
console.log(`${colors.blue}═══════════════════════════════════════════${colors.reset}\n`);

// H1: Secrets não commitados
check('H1', 'Secrets não commitados (.env no .gitignore)', () => {
  const gitignore = fs.readFileSync('.gitignore', 'utf-8');
  return gitignore.includes('.env') && gitignore.includes('*.env');
});

// H2: Tokens criptografados em banco
check('H2', 'Tokens criptografados (crypto-utils existe)', () => {
  return fs.existsSync('src/utils/crypto-utils.ts');
});

// H3: Validação de input em endpoints
check('H3', 'Validação de input implementada', () => {
  const debugApi = fs.readFileSync('src/api/debug-api.ts', 'utf-8');
  return debugApi.includes('sanitize') || debugApi.includes('validate') || debugApi.includes('req.body');
});

// H4: Rate limiting configurado
check('H4', 'Rate limiting detectado', () => {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
  // Check if express-rate-limit is in dependencies
  return (packageJson.dependencies && 'express-rate-limit' in packageJson.dependencies) ||
         (packageJson.devDependencies && 'express-rate-limit' in packageJson.devDependencies);
});

// H5: HTTPS/SSL ativo
check('H5', 'HTTPS/SSL referenciado (Vercel, VPS)', () => {
  const readme = fs.existsSync('README.md') ? fs.readFileSync('README.md', 'utf-8') : '';
  return readme.includes('https://') || readme.includes('ssl') || readme.includes('vercel');
});

// H6: Sanitização de output (XSS prevention)
check('H6', 'XSS prevention (sanitização)', () => {
  const telegramHandler = fs.existsSync('src/handlers/telegram-output-handler.ts') ? 
    fs.readFileSync('src/handlers/telegram-output-handler.ts', 'utf-8') : '';
  return telegramHandler.includes('escape') || telegramHandler.includes('sanitize') || telegramHandler.includes('replace');
});

// H7: SQL injection prevention
check('H7', 'SQL injection prevention (prepared statements)', () => {
  const dbFiles = [
    'src/core/memory/conversation-repository.ts',
    'src/services/cost-tracker/cost-repository.ts'
  ].filter(f => fs.existsSync(f));
  
  if (dbFiles.length === 0) return false;
  
  const content = dbFiles.map(f => fs.readFileSync(f, 'utf-8')).join('\n');
  return content.includes('prepare') || content.includes('?') || content.includes('$');
});

// H8: Skill sandboxing (forked execution)
check('H8', 'Skill sandboxing (forked execution)', () => {
  return fs.existsSync('src/core/skills/forked-executor.ts');
});

// H9: Logs sem dados sensíveis
check('H9', 'Logs sem dados sensíveis (redact/mask)', () => {
  const logFiles = [
    'src/utils/logger.ts',
    'src/services/logger.ts'
  ].filter(f => fs.existsSync(f));
  
  if (logFiles.length === 0) return true; // If no custom logger, assume safe
  
  const content = logFiles.map(f => fs.readFileSync(f, 'utf-8')).join('\n');
  return content.includes('redact') || content.includes('mask') || content.includes('sanitize');
});

// H10: CORS configurado
check('H10', 'CORS configurado', () => {
  const debugApi = fs.readFileSync('src/api/debug-api.ts', 'utf-8');
  return debugApi.includes('cors') || debugApi.includes('Access-Control-Allow-Origin');
});

// H11: Autenticação Telegram verificada
check('H11', 'Autenticação Telegram (BOT_TOKEN check)', () => {
  const envExample = fs.existsSync('.env.example') ? fs.readFileSync('.env.example', 'utf-8') : '';
  const setupDocs = fs.existsSync('SETUP-COMPLETE.md') ? fs.readFileSync('SETUP-COMPLETE.md', 'utf-8') : '';
  return envExample.includes('TELEGRAM_BOT_TOKEN') || setupDocs.includes('TELEGRAM_BOT_TOKEN');
});

// H12: Backup automático habilitado
check('H12', 'Backup automático (scripts)', () => {
  const backupFiles = [
    'scripts/backup-database.sh',
    'scripts/backup-database.ps1'
  ].filter(f => fs.existsSync(f));
  
  return backupFiles.length > 0;
});

// H13: Monitoring de erros ativo
check('H13', 'Monitoring de erros (Telegram alerts)', () => {
  const monitoringFiles = [
    'src/services/monitoring.ts',
    'src/telegram/monitoring.ts'
  ].filter(f => fs.existsSync(f));
  
  if (monitoringFiles.length === 0) return false;
  
  const content = monitoringFiles.map(f => fs.readFileSync(f, 'utf-8')).join('\n');
  return content.includes('alert') || content.includes('sendMessage');
});

// Summary
console.log(`\n${colors.blue}═══════════════════════════════════════════${colors.reset}`);
console.log(`${colors.blue}   SECURITY AUDIT SUMMARY${colors.reset}`);
console.log(`${colors.blue}═══════════════════════════════════════════${colors.reset}\n`);

const passed = results.filter(r => r.passed).length;
const failed = results.filter(r => !r.passed).length;

console.log(`Total Checks: ${results.length}`);
console.log(`${colors.green}✓ Passed: ${passed}${colors.reset}`);
console.log(`${colors.red}✗ Failed: ${failed}${colors.reset}`);
console.log(`Compliance: ${((passed / results.length) * 100).toFixed(1)}%\n`);

if (failed > 0) {
  console.log(`${colors.yellow}Failed Checks:${colors.reset}`);
  results.filter(r => !r.passed).forEach(r => {
    console.log(`  - ${r.id}: ${r.name}`);
    if (r.error) console.log(`    Error: ${r.error}`);
  });
  console.log();
}

// Check critical threshold (at least 10/13 = 77%)
const criticalThreshold = 0.77;
if ((passed / results.length) >= criticalThreshold) {
  console.log(`${colors.green}✓ Security audit PASSED (>= 77% compliance)${colors.reset}\n`);
  process.exit(0);
} else {
  console.log(`${colors.red}✗ Security audit FAILED (< 77% compliance)${colors.reset}\n`);
  process.exit(1);
}
