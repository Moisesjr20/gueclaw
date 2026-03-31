// Show schema of financial_transactions table
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(process.cwd(), 'data', 'gueclaw.db');
const db = new Database(dbPath, { readonly: true });

const schema = db.prepare('PRAGMA table_info(financial_transactions)').all();
console.log('\n📋 Schema of financial_transactions:\n');
schema.forEach(col => {
  console.log(`${col.cid}. ${col.name} (${col.type}) ${col.notnull ? 'NOT NULL' : ''} ${col.pk ? 'PRIMARY KEY' : ''}`);
});

db.close();
