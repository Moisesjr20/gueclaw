#!/usr/bin/env node
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, '..', 'data', 'gueclaw.db');

const db = new Database(DB_PATH);
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('📊 Tables in database:');
tables.forEach(t => console.log(`  - ${t.name}`));
db.close();
