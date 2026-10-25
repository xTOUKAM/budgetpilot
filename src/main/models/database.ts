import Database from 'better-sqlite3';
import { app } from 'electron';
import { join } from 'path';
import { copyFileSync, existsSync, mkdirSync } from 'fs';
import { migrate } from './schema';

const DATABASE_FILE = 'budgetpilot.sqlite';

export function openDatabase() {
  const directory = join(app.getPath('userData'), 'data');
  mkdirSync(directory, { recursive: true });
  const databasePath = join(directory, DATABASE_FILE);
  migrateLegacyDatabase(databasePath);
  const db = new Database(databasePath);
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

function migrateLegacyDatabase(databasePath: string): void {
  if (existsSync(databasePath)) return;

  const legacyNames = ['BudgetPilot', 'budgetpilot'];
  for (const legacyName of legacyNames) {
    const legacyPath = join(app.getPath('appData'), legacyName, 'data', DATABASE_FILE);
    if (!existsSync(legacyPath)) continue;

    copyFileSync(legacyPath, databasePath);
    for (const suffix of ['-wal', '-shm']) {
      const sidecar = `${legacyPath}${suffix}`;
      if (existsSync(sidecar)) copyFileSync(sidecar, `${databasePath}${suffix}`);
    }
    return;
  }
}
