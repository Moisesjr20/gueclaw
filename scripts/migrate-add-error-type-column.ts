#!/usr/bin/env tsx

import Database from 'better-sqlite3';
import * as path from 'path';

/**
 * Migration Script: Add missing columns to skill_executions table
 * 
 * This migration adds the missing 'error_type' and 'context' columns to the skill_executions table
 * in the production database to fix the "column not found" errors.
 * 
 * Usage (on VPS):
 *   cd /opt/gueclaw-agent
 *   npx tsx scripts/migrate-add-error-type-column.ts
 */

const DATABASE_PATH = process.env.DATABASE_PATH || './data/gueclaw.db';

console.log('🔧 Starting database migration: Add missing columns to skill_executions');
console.log(`📂 Database path: ${DATABASE_PATH}`);

try {
  const db = new Database(DATABASE_PATH);
  
  // Check which columns are missing
  const tableInfo = db.prepare("PRAGMA table_info(skill_executions)").all();
  const hasErrorTypeColumn = tableInfo.some((col: any) => col.name === 'error_type');
  const hasContextColumn = tableInfo.some((col: any) => col.name === 'context');
  
  let changesMade = false;
  
  if (!hasErrorTypeColumn) {
    console.log('🔄 Adding error_type column to skill_executions table...');
    db.exec(`
      ALTER TABLE skill_executions 
      ADD COLUMN error_type TEXT;
    `);
    console.log('✅ Added error_type column');
    changesMade = true;
  } else {
    console.log('✅ Column error_type already exists');
  }
  
  if (!hasContextColumn) {
    console.log('🔄 Adding context column to skill_executions table...');
    db.exec(`
      ALTER TABLE skill_executions 
      ADD COLUMN context TEXT;
    `);
    console.log('✅ Added context column');
    changesMade = true;
  } else {
    console.log('✅ Column context already exists');
  }
  
  if (!changesMade) {
    console.log('✅ All columns already exist, no migration needed');
    process.exit(0);
  }
  
  console.log('\n✅ Migration completed successfully!');
  console.log('📊 Updated table schema:');
  
  const updatedTableInfo = db.prepare("PRAGMA table_info(skill_executions)").all();
  console.table(updatedTableInfo);
  
  db.close();
  
  console.log('\n✅ Database migration completed. You can now restart the GueClaw agent.');
  
} catch (error: any) {
  console.error('❌ Migration failed:', error.message);
  console.error(error);
  process.exit(1);
}
