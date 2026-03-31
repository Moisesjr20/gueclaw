#!/usr/bin/env node
/**
 * Delete all financial transactions for a specific user
 * Usage: node scripts/delete-all-transactions.js <userId>
 */

const Database = require('better-sqlite3');
const path = require('path');

const userId = process.argv[2];

if (!userId) {
  console.error('❌ Usage: node scripts/delete-all-transactions.js <userId>');
  process.exit(1);
}

const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, '..', 'data', 'gueclaw.db');

try {
  const db = new Database(DB_PATH);
  
  // Count existing transactions
  const countStmt = db.prepare('SELECT COUNT(*) as count FROM financial_transactions WHERE userId = ?');
  const { count } = countStmt.get(userId);
  
  console.log(`📊 Found ${count} transactions for user ${userId}`);
  
  if (count === 0) {
    console.log('✅ No transactions to delete');
    process.exit(0);
  }
  
  // Delete all transactions
  const deleteStmt = db.prepare('DELETE FROM financial_transactions WHERE userId = ?');
  const result = deleteStmt.run(userId);
  
  console.log(`✅ Deleted ${result.changes} transactions`);
  
  // Verify deletion
  const { count: remaining } = countStmt.get(userId);
  console.log(`📊 Remaining transactions: ${remaining}`);
  
  db.close();
  
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
