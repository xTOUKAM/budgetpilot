import type Database from 'better-sqlite3';

export function migrate(db: Database.Database) {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`);
  const current = (db.prepare('SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations').get() as { version: number }).version;
  if (current < 1) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('bank','cash','savings','other')),
        balance_cents INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1))
      );
      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT, account_id INTEGER NOT NULL REFERENCES accounts(id),
        type TEXT NOT NULL CHECK(type IN ('income','expense','transfer')),
        amount_cents INTEGER NOT NULL CHECK(amount_cents > 0), date TEXT NOT NULL,
        category TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', transfer_group TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS budgets (
        id INTEGER PRIMARY KEY AUTOINCREMENT, category TEXT NOT NULL,
        limit_cents INTEGER NOT NULL CHECK(limit_cents > 0), month TEXT NOT NULL,
        UNIQUE(category, month)
      );
      CREATE TABLE IF NOT EXISTS savings_goals (
        id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
        target_cents INTEGER NOT NULL CHECK(target_cents > 0),
        saved_cents INTEGER NOT NULL DEFAULT 0 CHECK(saved_cents >= 0)
      );
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE,
        type TEXT NOT NULL CHECK(type IN ('income','expense')),
        color TEXT NOT NULL DEFAULT '#8b7cff', active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1))
      );
      CREATE TABLE IF NOT EXISTS recurring_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT, label TEXT NOT NULL,
        account_id INTEGER NOT NULL REFERENCES accounts(id),
        type TEXT NOT NULL CHECK(type IN ('income','expense')),
        amount_cents INTEGER NOT NULL CHECK(amount_cents > 0), category TEXT NOT NULL,
        frequency TEXT NOT NULL CHECK(frequency IN ('daily','weekly','monthly','quarterly','yearly')),
        start_date TEXT NOT NULL, next_date TEXT NOT NULL, end_date TEXT,
        active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1))
      );
      CREATE TABLE IF NOT EXISTS recurrence_occurrences (
        recurring_id INTEGER NOT NULL REFERENCES recurring_transactions(id) ON DELETE CASCADE,
        due_date TEXT NOT NULL, transaction_id INTEGER NOT NULL UNIQUE REFERENCES transactions(id),
        PRIMARY KEY (recurring_id, due_date)
      );
      INSERT OR IGNORE INTO categories (name, type) VALUES
        ('Logement','expense'),('Alimentation','expense'),('Transport','expense'),
        ('Abonnements','expense'),('Santé','expense'),('Loisirs','expense'),
        ('Salaire','income'),('Aides','income'),('Autre','expense');
      CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
    `);
    db.prepare('INSERT INTO schema_migrations (version) VALUES (1)').run();
  }
  if (current < 2) {
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_transactions_account_date ON transactions(account_id, date);
      CREATE INDEX IF NOT EXISTS idx_transactions_type_date ON transactions(type, date);
      CREATE INDEX IF NOT EXISTS idx_recurring_next_date ON recurring_transactions(next_date, active);
      INSERT INTO schema_migrations (version) VALUES (2);
    `);
  }
  if (current < 3) {
    const goals = db.prepare('PRAGMA table_info(savings_goals)').all() as Array<{ name: string }>;
    if (!goals.some(column => column.name === 'target_date')) db.exec('ALTER TABLE savings_goals ADD COLUMN target_date TEXT');
    if (!goals.some(column => column.name === 'monthly_cents')) db.exec('ALTER TABLE savings_goals ADD COLUMN monthly_cents INTEGER');
    if (!goals.some(column => column.name === 'account_id')) db.exec('ALTER TABLE savings_goals ADD COLUMN account_id INTEGER REFERENCES accounts(id)');
    db.prepare('INSERT INTO schema_migrations (version) VALUES (3)').run();
  }
  if (current < 4) {
    const transactions = db.prepare('PRAGMA table_info(transactions)').all() as Array<{ name: string }>;
    if (!transactions.some(column => column.name === 'import_hash')) {
      db.exec('ALTER TABLE transactions ADD COLUMN import_hash TEXT');
      db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_import_hash ON transactions(import_hash) WHERE import_hash IS NOT NULL');
    }
    db.prepare('INSERT INTO schema_migrations (version) VALUES (4)').run();
  }
  if (current < 5) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS recurrence_skips (
        recurring_id INTEGER NOT NULL REFERENCES recurring_transactions(id) ON DELETE CASCADE,
        due_date TEXT NOT NULL,
        reason TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (recurring_id, due_date)
      );
    `);
    db.prepare('INSERT INTO schema_migrations (version) VALUES (5)').run();
  }
  const accounts = db.prepare('PRAGMA table_info(accounts)').all() as Array<{ name: string }>;
  if (!accounts.some(column => column.name === 'archived')) db.exec('ALTER TABLE accounts ADD COLUMN archived INTEGER NOT NULL DEFAULT 0');
  const transactions = db.prepare('PRAGMA table_info(transactions)').all() as Array<{ name: string }>;
  if (!transactions.some(column => column.name === 'transfer_group')) db.exec('ALTER TABLE transactions ADD COLUMN transfer_group TEXT');
}
