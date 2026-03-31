#!/usr/bin/env node
/**
 * Script para gerar uma chave de criptografia segura para o banco de dados
 * e configurar SQLCipher
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

console.log('🔐 Gerador de Chave de Criptografia do Banco de Dados\n');

// Gerar chave de 256-bit (64 caracteres hexadecimais)
const encryptionKey = crypto.randomBytes(32).toString('hex');

console.log('✅ Chave de criptografia gerada:');
console.log('');
console.log(`DATABASE_ENCRYPTION_KEY=${encryptionKey}`);
console.log('');
console.log('⚠️  IMPORTANTE:');
console.log('   1. Adicione esta linha ao seu arquivo .env');
console.log('   2. NUNCA commite esta chave no GitHub');
console.log('   3. Faça backup desta chave em local seguro (senha manager)');
console.log('   4. Se perder esta chave, NÃO conseguirá ler o banco de dados');
console.log('');

// Verificar se o .env existe
const envPath = path.join(__dirname, '..', '.env');

if (fs.existsSync(envPath)) {
    // Verificar se já existe DATABASE_ENCRYPTION_KEY
    const envContent = fs.readFileSync(envPath, 'utf-8');
    
    if (envContent.includes('DATABASE_ENCRYPTION_KEY=')) {
        console.log('⚠️  ATENÇÃO: DATABASE_ENCRYPTION_KEY já existe no .env');
        console.log('   Substituir a chave tornará o banco de dados atual ILEGÍVEL!');
        console.log('   Certifique-se de fazer backup do banco antes de trocar a chave.');
    } else {
        console.log('📝 Deseja adicionar automaticamente ao .env? (pressione Enter para SIM ou Ctrl+C para NÃO)');
        
        // Auto-adicionar (para automação, assumimos SIM)
        const newEnvContent = envContent + `\n# ===== Database Encryption =====\n# Chave de 256-bit para criptografia SQLCipher (NUNCA COMMITAR!)\nDATABASE_ENCRYPTION_KEY=${encryptionKey}\n`;
        fs.writeFileSync(envPath, newEnvContent, 'utf-8');
        console.log('✅ DATABASE_ENCRYPTION_KEY adicionada ao .env');
    }
} else {
    console.log('⚠️  Arquivo .env não encontrado');
    console.log('   Adicione manualmente a chave ao criar o .env');
}

console.log('');
console.log('🔧 Próximos passos:');
console.log('   1. Instalar SQLCipher: npm install @journeyapps/sqlcipher');
console.log('   2. Migrar banco existente (se houver)');
console.log('   3. Atualizar src/core/memory/database.ts para usar criptografia');
console.log('');
