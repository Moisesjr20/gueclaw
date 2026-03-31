// Check financial data in database
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(process.cwd(), 'data', 'gueclaw.db');
const db = new Database(dbPath, { readonly: true });

console.log('\n📊 Financial Transactions Overview\n');

// Total count
const total = db.prepare('SELECT COUNT(*) as count FROM financial_transactions').get();
console.log(`Total transactions: ${total.count}`);

if (total.count > 0) {
  // By user
  const byUser = db.prepare(`
    SELECT user_id, COUNT(*) as count, 
           SUM(CASE WHEN movement_type = 'entrada' THEN amount ELSE 0 END) as entradas,
           SUM(CASE WHEN movement_type = 'saida' THEN amount ELSE 0 END) as saidas
    FROM financial_transactions 
    GROUP BY user_id
  `).all();
  
  console.log('\nBy User:');
  byUser.forEach(u => {
    console.log(`  User ${u.user_id}: ${u.count} transactions (Entradas: R$ ${u.entradas.toFixed(2)}, Saídas: R$ ${u.saidas.toFixed(2)})`);
  });
  
  // Date range
  const dateRange = db.prepare(`
    SELECT MIN(transaction_date) as min, MAX(transaction_date) as max
    FROM financial_transactions
  `).get();
  console.log(`\nDate range: ${dateRange.min} → ${dateRange.max}`);
  
  // Sample records
  const samples = db.prepare('SELECT * FROM financial_transactions LIMIT 5').all();
  console.log('\nSample records:');
  samples.forEach(s => {
    console.log(`  [${s.transaction_date}] ${s.description} - R$ ${s.amount} (${s.movement_type})`);
  });
}

db.close();
