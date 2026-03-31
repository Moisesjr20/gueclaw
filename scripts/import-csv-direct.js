// Import CSV directly into database
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');

// Load .env
require('dotenv').config();

const ENCRYPTION_KEY = process.env.DATABASE_ENCRYPTION_KEY;
if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 64) {
  console.error('❌ DATABASE_ENCRYPTION_KEY não configurada ou inválida');
  process.exit(1);
}

const KEY_BUFFER = Buffer.from(ENCRYPTION_KEY, 'hex');

// AES-256-GCM encryption - returns Buffer (not base64)
function encrypt(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY_BUFFER, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Return: IV (12) + AuthTag (16) + Encrypted
  return Buffer.concat([iv, authTag, encrypted]);
}

// Parse CSV line
function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim());
  const header = lines[0].split(';').map(h => h.trim().toLowerCase());
  
  const transactions = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(';').map(v => v.trim());
    if (values.length < header.length) continue;
    
    const row = {};
    header.forEach((h, idx) => {
      row[h] = values[idx];
    });
    transactions.push(row);
  }
  return transactions;
}

// Convert to DB format
function convertTransaction(row, userId) {
  const date = row['data'];
  const [day, month, year] = date.split('/');
  const timestamp = Math.floor(new Date(`${year}-${month}-${day}`).getTime() / 1000); // Unix timestamp in SECONDS
  
  const valor = parseFloat(row['valor'].replace(',', '.'));
  const tipo = row['tipo']?.toLowerCase() || 'saida';
  const transactionType = tipo === 'entrada' ? 'entrada' : 'saida';
  
  let movementType = (row['tipo de movimentação'] || row['tipo de movimentacao'] || 'único').toLowerCase();
  // Normalize to match DB constraint (parcela, unico, mensal)
  if (movementType === 'único') movementType = 'unico';
  if (!['parcela', 'unico', 'mensal'].includes(movementType)) movementType = 'unico';
  
  // Importar todas como não realizadas (transações planejadas/futuras)
  const status = 'nao_realizado';
  const parcela = row['parcela'] || null;
  
  return {
    id: crypto.randomUUID(),
    userId,
    transactionDate: timestamp,
    amount: encrypt(valor.toFixed(2)),
    description: encrypt(row['descrição'] || row['descricao'] || 'Sem descrição'),
    costCenter: row['centro de custo'] || 'Geral',
    transactionType,
    movementType,
    installmentInfo: parcela,
    status,
    createdAt: Math.floor(Date.now() / 1000), // Unix timestamp in seconds
    updatedAt: Math.floor(Date.now() / 1000)  // Unix timestamp in seconds
  };
}

// Main
const dbPath = path.join(__dirname, '..', 'data', 'gueclaw.db');
const db = new Database(dbPath);

const csvPath = path.join(__dirname, '..', 'tmp', 'fin.csv');
const userId = '8227546813';

console.log('📂 Lendo CSV:', csvPath);
const rawData = parseCSV(csvPath);
console.log(`📊 Found ${rawData.length} transactions`);

const stmt = db.prepare(`
  INSERT INTO financial_transactions 
  (id, user_id, transaction_date, amount_encrypted, description_encrypted, cost_center, transaction_type, movement_type, installment_info, status, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertMany = db.transaction((transactions) => {
  for (const t of transactions) {
    stmt.run(t.id, t.userId, t.transactionDate, t.amount, t.description, t.costCenter, t.transactionType, t.movementType, t.installmentInfo, t.status, t.createdAt, t.updatedAt);
  }
});

const transactions = rawData.map(r => convertTransaction(r, userId));

console.log('\n💾 Inserting into database...');
insertMany(transactions);

const count = db.prepare('SELECT COUNT(*) as count FROM financial_transactions').get();
console.log(`✅ Total transactions now: ${count.count}`);

db.close();
console.log('✅ Import completed!');
