'use strict';

/**
 * Jest manual mock for better-sqlite3.
 * Provides an in-memory relational store that supports the SQL patterns
 * used by DatabaseConnection, MessageRepository and ConversationRepository.
 *
 * Placed at <rootDir>/__mocks__/better-sqlite3.js — Jest picks it up
 * automatically for all tests that require('better-sqlite3').
 */

class MockStatement {
  constructor(db, sql) {
    this._db = db;
    this._sql = sql.trim();
  }

  run(...args) {
    const sql = this._sql;
    const db = this._db;

    // INSERT INTO <table> (<cols>) VALUES (...)
    if (/^INSERT/i.test(sql)) {
      const tableMatch = sql.match(/INSERT\s+(?:OR\s+\w+\s+)?INTO\s+(\w+)/i);
      if (!tableMatch) return { changes: 0, lastInsertRowid: 0 };
      const table = tableMatch[1].toLowerCase();
      if (!db._data[table]) db._data[table] = [];

      const colMatch = sql.match(/\(([^)]+)\)\s*VALUES/i);
      const cols = colMatch ? colMatch[1].split(',').map(c => c.trim()) : [];
      const row = {};
      cols.forEach((col, i) => { row[col] = args[i] !== undefined ? args[i] : null; });
      db._data[table].push(row);
      return { changes: 1, lastInsertRowid: db._data[table].length };
    }

    // UPDATE <table> SET <col> = ? WHERE <col> = ?
    if (/^UPDATE/i.test(sql)) {
      const tableMatch = sql.match(/UPDATE\s+(\w+)/i);
      if (!tableMatch) return { changes: 0 };
      const table = tableMatch[1].toLowerCase();
      const rows = db._data[table] || [];

      const setMatch = sql.match(/SET\s+([\w_]+)\s*=\s*\?/i);
      const whereMatch = sql.match(/WHERE\s+([\w_]+)\s*=\s*\?/i);
      if (!setMatch || !whereMatch) return { changes: 0 };

      const setCol = setMatch[1];
      const whereCol = whereMatch[1];
      let changes = 0;
      rows.forEach(row => {
        if (row[whereCol] == args[1]) {
          row[setCol] = args[0];
          changes++;
        }
      });
      return { changes };
    }

    // DELETE FROM <table> WHERE <col> = ?
    if (/^DELETE/i.test(sql)) {
      const tableMatch = sql.match(/DELETE\s+FROM\s+(\w+)/i);
      if (!tableMatch) return { changes: 0 };
      const table = tableMatch[1].toLowerCase();
      if (!db._data[table]) return { changes: 0 };

      const origLen = db._data[table].length;

      // WHERE id IN (?,?,...)
      const inMatch = sql.match(/WHERE\s+([\w_]+)\s+IN\s*\(([^)]+)\)/i);
      if (inMatch) {
        const col = inMatch[1];
        db._data[table] = db._data[table].filter(row => !args.includes(row[col]));
        return { changes: origLen - db._data[table].length };
      }

      // WHERE <col> = ?
      const whereMatch = sql.match(/WHERE\s+([\w_]+)\s*=\s*\?/i);
      if (whereMatch) {
        const col = whereMatch[1];
        db._data[table] = db._data[table].filter(row => row[col] != args[0]);
        return { changes: origLen - db._data[table].length };
      }

      return { changes: 0 };
    }

    return { changes: 0, lastInsertRowid: 0 };
  }

  get(...args) {
    const sql = this._sql;
    const db = this._db;
    const rows = this._queryRows(sql, args, db);

    // COUNT query
    if (/SELECT\s+COUNT\(\*\)/i.test(sql)) {
      return { count: rows.length };
    }

    return rows[0] || undefined;
  }

  all(...args) {
    const sql = this._sql;
    const db = this._db;
    return this._queryRows(sql, args, db);
  }

  _queryRows(sql, args, db) {
    const tableMatch = sql.match(/FROM\s+(\w+)/i);
    if (!tableMatch) return [];

    const table = tableMatch[1].toLowerCase();
    let rows = [...(db._data[table] || [])];

    // Pattern: LIMIT MAX(0, (SELECT COUNT(*) FROM <table> WHERE <col> = ?) - ?)
    // Used by getOldMessages — returns oldest (total - windowSize) rows
    const limitMaxMatch = sql.match(
      /LIMIT\s+MAX\s*\(\s*0\s*,\s*\(\s*SELECT\s+COUNT\(\*\)\s+FROM\s+(\w+)\s+WHERE\s+([\w_]+)\s*=\s*\?\s*\)\s*-\s*\?\s*\)/is
    );
    if (limitMaxMatch) {
      const subTable = limitMaxMatch[1].toLowerCase();
      const subCol = limitMaxMatch[2];
      // args[0] = outerWhere, args[1] = subqueryWhere, args[2] = windowSize
      const whereMatchSimple = sql.match(/WHERE\s+([\w_]+)\s*=\s*\?/i);
      if (whereMatchSimple) {
        rows = rows.filter(r => r[whereMatchSimple[1]] == args[0]);
      }
      // Sort ASC (ORDER BY timestamp ASC is the expected ordering)
      rows = rows.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      const subCount = (db._data[subTable] || []).filter(r => r[subCol] == args[1]).length;
      const windowSize = args[2];
      const limit = Math.max(0, subCount - windowSize);
      return rows.slice(0, limit);
    }

    // Simple WHERE clause: WHERE <col> = ?
    const whereMatch = sql.match(/WHERE\s+([\w_]+)\s*=\s*\?/i);
    if (whereMatch) {
      const col = whereMatch[1];
      rows = rows.filter(r => r[col] == args[0]);
    }

    // Sorting
    if (/ORDER\s+BY\s+([\w_]+)\s+DESC/i.test(sql)) {
      const orderCol = sql.match(/ORDER\s+BY\s+([\w_]+)\s+DESC/i)[1];
      rows = rows.sort((a, b) => (b[orderCol] || 0) - (a[orderCol] || 0));
    } else if (/ORDER\s+BY\s+([\w_]+)\s+ASC/i.test(sql)) {
      const orderCol = sql.match(/ORDER\s+BY\s+([\w_]+)\s+ASC/i)[1];
      rows = rows.sort((a, b) => (a[orderCol] || 0) - (b[orderCol] || 0));
    } else if (/ORDER\s+BY\s+([\w_]+)/i.test(sql)) {
      const orderCol = sql.match(/ORDER\s+BY\s+([\w_]+)/i)[1];
      rows = rows.sort((a, b) => (a[orderCol] || 0) - (b[orderCol] || 0));
    }

    // LIMIT ? (last ? arg)
    if (/LIMIT\s+\?/i.test(sql)) {
      const limitArgIndex = (sql.match(/\?/g) || []).length - 1;
      const limit = args[limitArgIndex];
      if (limit !== undefined) rows = rows.slice(0, limit);
    } else if (/LIMIT\s+(\d+)/i.test(sql)) {
      const limit = parseInt(sql.match(/LIMIT\s+(\d+)/i)[1], 10);
      rows = rows.slice(0, limit);
    }

    return rows;
  }
}

class MockDatabase {
  constructor(_path) {
    this._data = {};
  }

  exec(_sql) {
    // No-op: table creation is handled implicitly in run/all/get
    return this;
  }

  pragma(_statement) {
    return this;
  }

  prepare(sql) {
    return new MockStatement(this, sql);
  }

  close() {
    this._data = {};
  }
}

// Jest mock factory — creates a fresh MockDatabase instance each time
class Database extends MockDatabase {
  constructor(path) {
    super(path);
  }
}

module.exports = Database;
module.exports.default = Database;
