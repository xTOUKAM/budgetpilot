import Database from 'better-sqlite3';
import { app } from 'electron';
import { join } from 'path';
import { mkdirSync } from 'fs';
import { migrate } from './schema';

export function openDatabase() {
  const directory = join(app.getPath('userData'), 'data');
  mkdirSync(directory, { recursive: true });
  const db = new Database(join(directory, 'budgetpilot.sqlite'));
  db.pragma('busy_timeout = 5000');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migrate(db);
  const count = (db.prepare('SELECT COUNT(*) AS count FROM accounts').get() as { count: number }).count;
  if (count === 0) {
    db.prepare('INSERT INTO accounts (name, type, balance_cents) VALUES (?, ?, ?)').run('Compte courant', 'bank', 0);
  }
  return db;
}
